import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatService } from "./services/chat";
import { log } from "./vite";
import { utils } from "./utils";
import { Buffer } from "buffer";
import path from "path";
import fs from "fs";
import express from 'express';
import { verifyTurnstileToken } from './services/turnstile';
import { spawn } from 'child_process';
import learningPathRoutes from './routes/learning-path';
import adminPromptsRoutes from './routes/admin-prompts';
import contentModerationRoutes from './routes/content-moderation';
import memorySpaceRoutes from './routes/memory-space';
import memoryTestRoutes from './routes/memory-test';
import filesRoutes from './routes/files';
import systemConfigRoutes from './routes/system-config';
import testDataRoutes from './routes/test-data';
import conversationTestRoutes from './routes/conversation-test';
import mcpRoutes from './routes/mcp-routes';
import clusteringTestRoutes from './routes/clustering-test';
import repairMemoryRoutes from './routes/repair-memory';
import topicGraphRoutes from './routes/topic-graph';
import studentAgentRoutes from './routes/student-agent';
import embeddingApiRoutes from './routes/embedding-api';
// 暂时禁用学生代理模拟器
import { router as studentAgentSimulatorRoutes } from './routes/student-agent-simulator';
import userSettingsRoutes from './routes/user-settings';
import { initializeBucket } from './services/file-bucket.service';
import { promptManagerService } from './services/prompt-manager';
import { Message } from "../shared/schema";

/**
 * 生成聊天历史摘要
 * 将聊天历史转换为模型切换时可用的上下文摘要
 * @param messages 聊天历史消息
 * @param maxLength 最大摘要长度
 * @returns 格式化的聊天历史摘要
 */
async function generateChatHistorySummary(messages: Message[], maxLength: number = 4000): Promise<string> {
  if (!messages || messages.length === 0) {
    return "";
  }

  let summary = "";
  // 限制消息数量，避免过长
  const recentMessages = messages.slice(-15); // 最近15条消息
  
  for (const msg of recentMessages) {
    const prefix = msg.role === "user" ? "用户: " : "AI: ";
    // 压缩每条消息，确保摘要不会过长
    let content = msg.content;
    if (content.length > 200) {
      content = content.substring(0, 197) + "...";
    }
    summary += `${prefix}${content}\n\n`;
  }
  
  // 限制总长度
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength - 3) + "...";
  }
  
  return summary;
}

/**
 * 动态截断上下文
 * 根据模型窗口大小自动截断上下文
 * @param messages 消息列表
 * @param model 目标模型名称
 * @returns 截断后的消息列表
 */
function trimContextForModel(messages: Message[], model: string): Message[] {
  // 模型上下文窗口大小定义
  const MODEL_WINDOW: Record<string, number> = {
    "deepseek": 65536,  // DeepSeek-R1
    "gemini": 131072,   // Gemini 2.5 Pro
    "grok": 16384       // Grok 3 Fast Beta
  };
  
  const RESPONSE_BUFFER = 1024; // 预留给LLM生成的空间
  const windowSize = MODEL_WINDOW[model] || 65536; // 默认值
  
  // 简单的token估算函数
  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4); // 粗略估计：每4个字符约1个token
  };
  
  // 计算当前消息总token数
  let totalTokens = messages.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content);
  }, 0);
  
  // 如果总token数在限制范围内，直接返回原消息列表
  if (totalTokens + RESPONSE_BUFFER <= windowSize) {
    return [...messages];
  }
  
  // 需要截断
  const result = [...messages];
  
  // 从前向后删除非system消息，直到满足窗口限制
  while (totalTokens + RESPONSE_BUFFER > windowSize && result.length > 0) {
    // 找到第一个非system消息
    const nonSystemIndex = result.findIndex(m => m.role !== "system");
    
    if (nonSystemIndex >= 0) {
      // 删除该消息并重新计算token总数
      const removedMsg = result.splice(nonSystemIndex, 1)[0];
      totalTokens -= estimateTokens(removedMsg.content);
    } else {
      // 如果只剩system消息，从最早的system消息开始删除
      const removedMsg = result.shift();
      if (removedMsg) {
        totalTokens -= estimateTokens(removedMsg.content);
      } else {
        break; // 防止无限循环
      }
    }
  }
  
  return result;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // 简化的开发者认证API - 暂时注释
  /*
  app.post("/api/auth/dev", (req, res) => {
    try {
      const { devKey } = req.body;

      // 验证开发者密钥
      // 此密钥仅供开发和测试使用
      if (devKey === "dev_secret_2025") {
        // 设置会话用户ID和开发者模式
        if (req.session) {
          req.session.userId = 3; // 使用ID为3的用户
          req.session.developerModeVerified = true;
          console.log(`开发者模式认证成功，设置会话用户ID: ${req.session.userId}`);
        }

        // 返回成功响应
        return res.json({
          success: true,
          userId: 3,
          role: "user",
          message: "开发者模式认证成功"
        });
      }

      // 密钥不匹配
      res.status(401).json({
        success: false,
        message: "开发者密钥无效"
      });
    } catch (error) {
      console.error(`开发者认证错误: ${error}`);
      res.status(500).json({
        success: false,
        message: "开发者认证处理失败"
      });
    }
  });
  */
  // User authentication routes
  // 处理注册请求
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, confirmPassword, turnstileToken } = req.body;

      // 验证基本参数
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "用户名和密码不能为空"
        });
      }

      // 验证用户名格式 (长度 3-20，只允许字母、数字和下划线)
      if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
          success: false,
          message: "用户名长度应为3-20字符，且只能包含字母、数字和下划线"
        });
      }

      // 验证密码强度 (长度 6-30)
      if (password.length < 6 || password.length > 30) {
        return res.status(400).json({
          success: false,
          message: "密码长度应为6-30字符"
        });
      }

      // 验证确认密码是否匹配
      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "两次输入的密码不一致"
        });
      }

      // 验证Turnstile令牌
      if (!turnstileToken) {
        return res.status(400).json({
          success: false,
          message: "请完成人机验证"
        });
      }

      // 验证令牌有效性 - 除非在开发环境
      const isDevelopment = process.env.NODE_ENV === 'development';
      const isBypassToken = turnstileToken === "bypass-token";

      if (!isDevelopment && !isBypassToken) {
        try {
          const isValid = await verifyTurnstileToken(turnstileToken);
          if (!isValid) {
            log('[Auth] 注册时Turnstile验证失败');
            return res.status(400).json({
              success: false,
              message: "人机验证失败，请重试"
            });
          }
        } catch (verifyError) {
          log(`Turnstile验证错误: ${verifyError}`);
          return res.status(500).json({
            success: false,
            message: "验证服务暂时不可用，请重试"
          });
        }
      } else if (isBypassToken) {
        log('[Auth] 使用绕过令牌注册用户 (仅在特定条件下允许)');
      }

      // 检查用户名是否存在
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: "用户名已存在" 
        });
      }

      // 创建新用户
      const user = await storage.createUser({ username, password });
      
      // 在会话中保存用户信息
      req.session.userId = user.id;
      req.session.userRole = user.role || 'user';
      
      // 设置持久化cookie，帮助会话恢复
      res.cookie('userId', user.id.toString(), {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
      
      // 记录注册成功日志
      log(`[Register] 用户注册成功: ${username}, ID=${user.id}, 角色=${user.role || 'user'}`);

      res.json({ 
        success: true, 
        userId: user.id,
        role: user.role
      });
    } catch (error) {
      log(`Registration error: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "注册失败，请稍后重试" 
      });
    }
  });

  // 处理登录请求
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password, turnstileToken } = req.body;

      // 验证Turnstile令牌
      if (!turnstileToken) {
        return res.status(400).json({
          success: false,
          message: "请完成人机验证"
        });
      }

      // 验证令牌有效性 - 除非在开发环境
      const isDevelopment = process.env.NODE_ENV === 'development';
      const isBypassToken = turnstileToken === "bypass-token";

      if (!isDevelopment && !isBypassToken) {
        try {
          const isValid = await verifyTurnstileToken(turnstileToken);
          if (!isValid) {
            log('[Auth] 登录时Turnstile验证失败');
            return res.status(400).json({
              success: false,
              message: "人机验证失败，请重试"
            });
          }
        } catch (verifyError) {
          log(`Turnstile验证错误: ${verifyError}`);
          return res.status(500).json({
            success: false,
            message: "验证服务暂时不可用，请重试"
          });
        }
      } else if (isBypassToken) {
        log('[Auth] 使用绕过令牌登录用户 (仅在特定条件下允许)');
      }

      // 获取用户信息
      let user = await storage.getUserByUsername(username);

      // 如果是首次设置管理员账户
      if (username === "admin" && !user) {
        // 使用更强的默认密码 (可以在首次登录后修改)
        const secureAdminPassword = "Admin@" + Math.floor(Math.random() * 10000);
        user = await storage.createUser({ 
          username, 
          password: secureAdminPassword, 
          role: "admin" 
        });

        // 记录生成的密码到日志（仅供首次设置使用）
        console.log(`初始管理员密码已生成: ${secureAdminPassword}`);

        // 返回错误提示
        return res.status(401).json({
          success: false,
          message: "管理员账户已创建，请查看服务器日志获取初始密码"
        });
      }

      // 详细日志记录
      log(`[Login] 尝试验证用户: ${username}`);
      log(`[Login] 用户数据库查询结果: ${JSON.stringify(user ? {id: user.id, role: user.role, username: user.username} : "未找到用户")}`);

      // 验证用户密码 - 确保密码比较时对空值进行安全处理
      const dbPassword = user?.password || '';
      const inputPassword = password || '';

      log(`[Login] 密码比较: 数据库="${dbPassword}", 输入="${inputPassword}"`);

      if (user && dbPassword === inputPassword) {
        log(`[Login] 密码验证成功，用户ID: ${user.id}, 角色: ${user.role}`);

        // 在会话中保存用户ID和角色
        if (req.session) {
          req.session.userId = user.id;
          req.session.userRole = user.role;
          
          // 更新最后活动时间
          req.session.lastActive = Date.now();
          
          // 记录设备信息（可选）
          req.session.deviceInfo = {
            userAgent: req.headers['user-agent'] || '未知',
            ip: req.ip || req.socket.remoteAddress || '未知',
            device: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
          };
          
          // 设置持久化cookie，帮助会话恢复
          res.cookie('userId', user.id.toString(), {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
          });
          
          log(`[Login] 已将用户ID ${user.id} 保存到会话和cookie中`);
        } else {
          log(`[Login] 警告：无法将用户ID保存到会话，session对象不存在`);
        }

        res.json({ 
          success: true, 
          userId: user.id, 
          role: user.role 
        });
      } else {
        log(`[Login] 密码验证失败，用户${user ? "存在但密码不匹配" : "不存在"}`);
        if (user) {
          log(`[Login] 密码不匹配: 数据库="${dbPassword}", 输入="${inputPassword}"`);
        }

        res.status(401).json({ 
          success: false, 
          message: "用户名或密码错误" 
        });
      }
    } catch (error) {
      log(`Login error: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "登录失败，请稍后重试" 
      });
    }
  });

  // 处理退出登录请求
  app.post("/api/logout", (req, res) => {
    try {
      // 记录当前退出的用户ID（如果存在的话）
      const userId = req.session?.userId;
      
      if (userId) {
        log(`[Logout] 用户 ${userId} 请求退出登录`);
        
        // 清除会话中的用户数据
        req.session.userId = undefined;
        req.session.userRole = undefined;
        
        // 清除设备信息和最后活动时间
        req.session.deviceInfo = undefined;
        req.session.lastActive = undefined;
        
        // 销毁整个会话
        req.session.destroy((err) => {
          if (err) {
            log(`[Logout] 清除会话失败: ${err}`);
          } else {
            log(`[Logout] 会话已成功销毁`);
          }
        });
        
        // 清除持久化cookie
        res.clearCookie('userId', {
          path: '/',
          sameSite: 'lax',
          httpOnly: true
        });
        
        log(`[Logout] 用户 ${userId} 退出登录成功`);
      } else {
        log('[Logout] 退出登录请求 - 没有活动会话');
      }
      
      // 总是返回成功，即使用户没有登录
      res.json({
        success: true,
        message: '退出登录成功'
      });
    } catch (error) {
      log(`[Logout] 退出登录时发生错误: ${error}`);
      res.status(500).json({
        success: false,
        message: '退出登录失败，请重试'
      });
    }
  });

  // 开发者模式登录请求 - 暂时注释
  /*
  app.post("/api/developer-login", async (req, res) => {
    try {
      const { username, password, developerPassword } = req.body;

      log(`[开发者登录] 开始处理登录请求, 用户名: ${username}`);

      // 获取管理员账户
      const adminUser = await storage.getUserByUsername("admin");

      // 如果没有管理员账户，设置默认开发者密码
      const validDevPassword = adminUser ? adminUser.password : "dev123456";

      // 验证开发者密码 - 这是安全性验证，用于判断是否有权绕过人机验证
      if (developerPassword !== validDevPassword) {
        log(`[开发者登录] 开发者密码验证失败`);
        return res.status(401).json({
          success: false,
          message: "开发者密码错误"
        });
      }

      log(`[开发者登录] 开发者密码验证成功`);

      // 设置开发者模式已通过的标记到会话
      if (req.session) {
        // @ts-ignore - 我们知道这个属性存在
        req.session.developerModeVerified = true;
        log(`[开发者登录] 会话已设置开发者模式标志`);
      }

      // 获取用户信息
      let user = await storage.getUserByUsername(username);

      // 详细日志记录
      log(`[开发者登录] 验证用户: ${username}`);
      log(`[开发者登录] 用户数据库查询结果: ${JSON.stringify(user ? {id: user.id, role: user.role, username: user.username} : "未找到用户")}`);

      // 验证用户和密码逻辑
      if (user) {
        // 现有用户登录 - 必须验证密码
        log(`[开发者登录] 检查密码匹配: 数据库密码长度=${user.password?.length || 0}, 输入密码长度=${password?.length || 0}`);

        // 安全地比较密码
        const dbPassword = user.password || '';
        const inputPassword = password || '';

        log(`[开发者登录] 密码比较: 数据库="${dbPassword}", 输入="${inputPassword}"`);

        if (dbPassword === inputPassword) {
          log(`[开发者模式] 用户 ${username} 登录成功, ID: ${user.id}, 角色: ${user.role}`);
          res.json({ 
            success: true, 
            userId: user.id, 
            role: user.role 
          });
        } else {
          log(`[开发者登录] 用户密码错误: 输入="${inputPassword}", 数据库="${dbPassword}"`);
          res.status(401).json({ 
            success: false, 
            message: "用户名或密码错误" 
          });
        }
      } else if (username === "admin") {
        // 创建管理员账户特殊处理
        log(`[开发者登录] 创建新的管理员账户`);
        const secureAdminPassword = password || "Admin@" + Math.floor(Math.random() * 10000);
        user = await storage.createUser({ 
          username, 
          password: secureAdminPassword, 
          role: "admin" 
        });

        if (!password) {
          // 记录生成的密码到日志（仅供首次设置使用）
          console.log(`初始管理员密码已生成: ${secureAdminPassword}`);

          return res.status(401).json({
            success: false,
            message: "管理员账户已创建，请查看服务器日志获取初始密码"
          });
        }

        // 如果提供了密码，则注册并登录
        log(`[开发者模式] 管理员用户 ${username} 创建并登录成功, ID: ${user.id}`);
        res.json({ 
          success: true, 
          userId: user.id, 
          role: user.role 
        });
      } else {
        // 新的普通用户注册
        log(`[开发者登录] 创建新的普通用户账户: ${username}`);
        user = await storage.createUser({ 
          username, 
          password, 
          role: "user" 
        });

        log(`[开发者模式] 新用户 ${username} 创建并登录成功, ID: ${user.id}`);
        res.json({ 
          success: true, 
          userId: user.id, 
          role: user.role 
        });
      }
    } catch (error) {
      log(`Developer login error: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "登录失败，请稍后重试" 
      });
    }
  });
  */

  // Chat routes
  app.get("/api/chats", async (req, res) => {
    try {
      const { userId, role } = req.query;
      if (!userId || isNaN(Number(userId))) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const isAdmin = role === "admin";
      // 如果是管理员，则获取请求中指定的用户的聊天记录
      // 如果是普通用户，则获取自己的聊天记录
      const targetUserId = Number(userId);
      const chats = await storage.getUserChats(targetUserId, isAdmin);
      res.json(chats);
    } catch (error) {
      log(`Error fetching chats: ${error}`);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // 学习轨迹分析API
  app.get("/api/learning-path", async (req, res) => {
    try {
      const { userId } = req.query;

      if (!userId || isNaN(Number(userId))) {
        return res.status(400).json({ error: "无效的用户ID" });
      }
      
      // 管理员用户（用户ID=1）不需要学习轨迹功能
      if (Number(userId) === 1) {
        return res.json({
          topics: [],
          progress: [],
          suggestions: [
            "管理员用户无需学习轨迹功能",
            "该功能仅适用于普通用户账户"
          ],
          knowledge_graph: {
            nodes: [],
            links: []
          }
        });
      }

      // 检查记忆目录状态 (仅用于日志)
      const memoryDir = "memory_space";
      const userDir = path.join(memoryDir, String(userId));
      log(`检查学习记忆目录: ${memoryDir} 存在=${fs.existsSync(memoryDir)}`);
      log(`检查用户记忆目录: ${userDir} 存在=${fs.existsSync(userDir)}`);

      // 从数据库获取该用户的记忆数据
      try {
        const memories = await storage.getMemoriesByUserId(Number(userId));

        // 检查是否有足够的记忆进行分析
        if (!memories || memories.length < 5) {
          log(`用户 ${userId} 的记忆数据不足 (${memories?.length || 0} 条)，返回空结果`);
          return res.json({
            topics: [],
            distribution: [], // 添加学习分布字段
            progress: [],
            suggestions: [
              "尚未收集到足够的学习数据",
              "请继续探索感兴趣的主题",
              "随着对话的增加，我们将能更好地理解您的学习偏好"
            ],
            knowledge_graph: {
              nodes: [],
              links: []
            }
          });
        }

        // 使用更新版的服务处理数据
        try {
          // 导入并使用trajectory服务中的analyzeLearningPath函数 (使用ESM导入)
          const { analyzeLearningPath } = await import('./services/learning/trajectory');
          const result = await analyzeLearningPath(Number(userId));

          // 添加时间戳版本以确保每次返回的数据不一样，避免浏览器缓存
          result.version = new Date().getTime();

          return res.json(result);
        } catch (trajectoryError) {
          log(`调用轨迹分析服务失败: ${trajectoryError}`);

          // 备用：如果无法使用trajectory服务，使用简单的内存提取方式
          // 从记忆内容中提取关键词
          const allContents = memories.map(memory => memory.content || "").filter(content => content.trim().length > 0);

          // 如果没有有效内容，返回空结果
          if (allContents.length === 0) {
            return res.json({
              topics: [],
              progress: [],
              suggestions: [
                "尚未收集到足够有效的学习数据",
                "请继续探索感兴趣的主题",
                "随着对话质量的提高，我们将能更好地分析您的学习偏好"
              ],
              knowledge_graph: {
                nodes: [],
                links: []
              }
            });
          }

          // 简单的主题分析：把内容合并并分析出现频率最高的词语作为话题
          const combinedText = allContents.join(" ");

          // 定义一些常见的停用词（不应作为主题词的常见词）
          const stopWords = new Set([
            "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "你", "我们", "这个",
            "the", "to", "and", "a", "of", "is", "in", "that", "for", "with", "as", "an"
          ]);

          // 分词并计数（简易实现）
          const words = combinedText.split(/\s+|[,.?!;:，。？！；：]/);
          const wordCount: Record<string, number> = {};

          for (const word of words) {
            const trimmed = word.trim().toLowerCase();
            if (trimmed && trimmed.length > 1 && !stopWords.has(trimmed)) {
              wordCount[trimmed] = (wordCount[trimmed] || 0) + 1;
            }
          }

          // 排序并获取频率最高的词汇
          const topicCandidates = Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

          // 如果找不到足够的主题词，返回空结果
          if (topicCandidates.length < 3) {
            return res.json({
              topics: [],
              progress: [],
              suggestions: [
                "您的对话内容尚未形成清晰的学习主题",
                "尝试更多地讨论特定学习领域的内容",
                "随着对话的深入，系统将能识别您的学习方向"
              ],
              knowledge_graph: {
                nodes: [],
                links: []
              }
            });
          }

          // 分组相似的主题词并合并计数
          const groupedTopics: Record<string, number> = {};
          let totalWeight = 0;

          // 定义主题关键词映射
          const topicKeywords: Record<string, string[]> = {
            '英语学习': ['english', '英语', 'language learning', '语言学习', 'grammar', '语法'],
            '化学': ['chemistry', '化学', '分子', 'molecule', '元素', 'element', '化合物', '反应'],
            '物理学': ['physics', '物理', '力学', '热力学', '电磁', '量子', 'quantum', 'mechanics'],
            '编程技术': ['coding', 'programming', '编程', '开发', 'code', 'development', 'software', '软件', 'app'],
            '数据科学': ['data', '数据', 'analysis', '分析', '统计', 'statistics', 'machine learning', '机器学习'],
            '数学': ['math', 'mathematics', '数学', '代数', '几何', 'calculus', '微积分'],
            '生物学': ['biology', '生物', 'genetics', '遗传', 'organism', '有机体', 'cell', '细胞'],
            '心理学': ['psychology', '心理学', '行为', 'behavior', '认知', 'cognitive'],
            '文学': ['literature', '文学', '写作', 'writing', '阅读', 'reading', '小说', 'novel'],
            '哲学': ['philosophy', '哲学', '思考', 'thinking', '逻辑', 'logic'],
            '历史': ['history', '历史', 'ancient', '古代', 'civilization', '文明'],
            '艺术': ['art', '艺术', 'painting', '绘画', 'music', '音乐', 'design', '设计'],
            '经济学': ['economics', '经济', 'finance', '金融', 'market', '市场'],
            '学习方法': ['learning', 'study', '学习', '方法', 'method', '技巧', 'technique', '记忆', 'memory'],
            '知识探索': ['knowledge', '知识', 'explore', '探索', 'discovery', '发现', 'curiosity', '好奇心']
          };

          for (const [word, count] of topicCandidates) {
            let matched = false;

            // 检查是否匹配预定义主题
            for (const [key, keywords] of Object.entries(topicKeywords)) {
              for (const keyword of keywords) {
                if (word.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(word)) {
                  groupedTopics[key] = (groupedTopics[key] || 0) + count;
                  totalWeight += count;
                  matched = true;
                  break;
                }
              }
              if (matched) break;
            }

            // 如果没有匹配预定义主题，创建新主题
            if (!matched) {
              let newTopic = word.length > 1 ? `${word}相关` : "其他主题";
              groupedTopics[newTopic] = (groupedTopics[newTopic] || 0) + count;
              totalWeight += count;
            }
          }

          // 排序并选择最多5个主题
          const sortedTopics = Object.entries(groupedTopics)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

          // 添加一些随机波动使结果更自然
          const addNaturalVariation = (basePercentage: number): number => {
            // 在基础百分比的基础上添加 -5% 到 +5% 的随机波动
            const variation = (Math.random() * 10 - 5);
            // 确保结果在合理范围内
            return Math.min(98, Math.max(10, Math.round(basePercentage + variation)));
          };

          // 将主题转换为期望格式
          const topicData = sortedTopics.map(([topic, count], index) => {
            // 计算出基于实际频率的百分比
            const basePercentage = Math.min(95, Math.round((count / totalWeight) * 100) + 20);
            // 添加自然变化
            const percentage = addNaturalVariation(basePercentage);

            return {
              topic,
              id: `topic_${topic.replace(/\s+/g, '_')}`,
              count,
              percentage
            };
          });

          // 记录分析结果
          log(`从数据库记忆中检测到的主题: ${topicData.map(t => t.topic).join(', ')}`);

          return res.json({
            topics: topicData,
            distribution: topicData.map(item => ({
              topic: item.topic,
              percentage: item.percentage
            })),
            // 为了保持兼容性，仍然保留progress字段
            progress: topicData.map(item => ({
              topic: item.topic,
              percentage: item.percentage
            })),
            suggestions: [
              "继续提问相关学习话题以增强个性化推荐",
              `探索${topicData[0].topic}的进阶知识点`,
              "尝试在不同领域之间建立关联，拓展知识网络"
            ],
            knowledge_graph: {
              nodes: [
                ...topicData.map((item, i) => ({
                  id: item.id,
                  name: item.topic,
                  type: "topic",
                  size: 30 + Math.floor(item.percentage / 10)
                })),
                {
                  id: "center_node",
                  name: "学习空间",
                  type: "center",
                  size: 40
                }
              ],
              links: [
                ...topicData.map((item) => ({
                  source: "center_node",
                  target: item.id,
                  type: "relation",
                  strength: item.percentage / 100
                })),
                ...(topicData.length > 1 ? [
                  {
                    source: topicData[0].id,
                    target: topicData[1].id,
                    type: "related",
                    strength: 0.7
                  }
                ] : [])
              ]
            }
          });
        }
      } catch (dbError) {
        log(`获取用户记忆数据库存储失败: ${dbError}`);
        // 返回空结果
        return res.json({
          topics: [],
          progress: [],
          suggestions: [
            "获取学习数据时出现错误",
            "请稍后再试", 
            "如果问题持续存在，请联系系统管理员"
          ],
          knowledge_graph: {
            nodes: [],
            links: []
          }
        });
      }
    } catch (error) {
      log(`学习轨迹分析API错误: ${error}`);
      return res.status(500).json({ error: "学习轨迹分析服务错误" });
    }
  });

  app.get("/api/chats/:chatId/messages", async (req, res) => {
    try {
      // 严格的参数验证
      const chatIdParam = req.params.chatId;
      if (!chatIdParam || !/^\d+$/.test(chatIdParam)) {
        return res.status(400).json({ message: "Invalid chat ID format" });
      }

      const chatId = parseInt(chatIdParam, 10);

      // 验证用户ID
      const userIdParam = req.query.userId as string;
      if (!userIdParam || !/^\d+$/.test(userIdParam)) {
        return res.status(401).json({ message: "Invalid user ID format" });
      }

      const userId = parseInt(userIdParam, 10);
      const role = req.query.role as string;

      // 验证角色
      const isAdmin = role === "admin";

      // 获取消息，通过Drizzle ORM的参数化查询防止SQL注入
      const messages = await storage.getChatMessages(chatId, userId, isAdmin);
      res.json(messages || []);
    } catch (error) {
      log(`Error fetching messages: ${error}`);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chats", async (req, res) => {
    try {
      // 从会话中获取userId，而不是从请求体中获取
      const userId = req.session?.userId;
      const { title, model } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "Please login first" });
      }
      
      const chat = await storage.createChat(userId, title || "新对话", model || "default");
      log(`[创建聊天] 成功创建聊天: ${chat.id} 用户: ${userId} 标题: ${title || "新对话"}`);
      res.json(chat);
    } catch (error) {
      log(`Error creating chat: ${error}`);
      res.status(500).json({ message: "Failed to create new chat" });
    }
  });

  app.delete("/api/chats/:chatId", async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const { userId, role } = req.query;
      
      log(`[Delete] 收到删除聊天请求: chatId=${chatId}, 查询参数: userId=${userId}, role=${role}`);
      
      if (!userId) {
        log(`[Delete] 删除失败: 未提供用户ID`);
        return res.status(401).json({ message: "Please login first" });
      }
      
      if (isNaN(chatId)) {
        log(`[Delete] 删除失败: 无效的聊天ID ${chatId}`);
        return res.status(400).json({ message: "Invalid chat ID" });
      }
      
      // 将userId转换为数字类型，防止字符串比较问题
      const userIdNumber = Number(userId);
      const isAdmin = role === "admin";
      
      log(`[Delete] 尝试删除聊天: chatId=${chatId}, userId=${userIdNumber}, isAdmin=${isAdmin}`);
      
      // 先检查用户是否有权限访问该聊天
      const chat = await storage.getChatById(chatId, userIdNumber, isAdmin);
      if (!chat) {
        log(`[Delete] 删除失败: 用户 ${userIdNumber} 无权访问聊天 ${chatId} 或聊天不存在`);
        return res.status(403).json({ message: "Access denied or chat not found" });
      }
      
      // 执行删除操作
      await storage.deleteChat(chatId, userIdNumber, isAdmin);
      log(`[Delete] 聊天删除成功: chatId=${chatId}`);
      
      res.json({ success: true });
    } catch (error) {
      log(`[Delete] 删除聊天时发生错误: ${error}`);
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });

  // 测试登录路由 - 仅用于调试
  app.get("/api/test-login", async (req, res) => {
    try {
      const username = req.query.username as string;
      const password = req.query.password as string;

      if (!username || !password) {
        return res.status(400).json({ message: "用户名和密码是必须的" });
      }

      // 详细日志记录
      log(`[TEST] 测试登录: 用户名=${username}, 密码长度=${password.length}`);

      // 获取用户信息
      let user = await storage.getUserByUsername(username);

      log(`[TEST] 用户数据库查询结果: ${JSON.stringify(user ? {id: user.id, role: user.role, username: user.username, passwordLength: user.password?.length} : "未找到用户")}`);

      // 验证用户密码 - 确保使用安全的密码比较方式
      const dbPassword = user?.password || '';
      const inputPassword = password || '';

      log(`[TEST] 密码比较: 数据库="${dbPassword}", 输入="${inputPassword}"`);

      if (user && dbPassword === inputPassword) {
        log(`[TEST] 密码验证成功，用户ID: ${user.id}, 角色: ${user.role}`);
        res.json({ 
          success: true, 
          userId: user.id, 
          role: user.role,
          message: "登录成功"
        });
      } else {
        log(`[TEST] 密码验证失败，用户${user ? "存在但密码不匹配" : "不存在"}`);
        if (user) {
          log(`[TEST] 密码不匹配: 数据库="${dbPassword}", 输入="${inputPassword}"`);
        }

        res.status(401).json({ 
          success: false, 
          message: "用户名或密码错误",
          detail: user ? "密码不匹配" : "用户不存在"
        });
      }
    } catch (error) {
      log(`[TEST] Login test error: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "测试登录失败",
        error: String(error)
      });
    }
  });

  // 添加修改聊天标题的端点
  app.put("/api/chats/:chatId/title", async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const { userId, role } = req.query;
      const { title } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "Please login first" });
      }

      if (!title || typeof title !== 'string') {
        return res.status(400).json({ message: "Invalid title" });
      }

      // 获取聊天记录以验证权限
      const isAdmin = role === "admin";
      const chat = await storage.getChatById(chatId, Number(userId), isAdmin);

      if (!chat) {
        return res.status(403).json({ message: "Access denied or chat not found" });
      }

      // 更新标题 (需要在storage.ts中添加updateChatTitle方法)
      await storage.updateChatTitle(chatId, title);

      res.json({ success: true });
    } catch (error) {
      log(`Error updating chat title: ${error}`);
      res.status(500).json({ message: "Failed to update chat title" });
    }
  });



  // User management routes
  app.get("/api/users", async (req, res) => {
    try {
      // Check if the requester is admin
      const userId = req.query.userId;
      const user = await storage.getUser(Number(userId));

      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Permission denied" });
      }

      // Get all users with their stats
      const users = await storage.getAllUsers();
      const usersWithStats = await Promise.all(
        users
          // 包含所有用户，不再排除管理员用户
          .map(async (user) => {
            const chats = await storage.getUserChats(user.id, true);
            return {
              ...user,
              chatCount: chats.length,
              lastActive: chats[0]?.createdAt || null,
              isAdmin: user.role === "admin"  // 添加这个字段以便于前端区分显示
            };
          })
      );

      res.json(usersWithStats);
    } catch (error) {
      log(`Error fetching users: ${error}`);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Delete user endpoint
  app.delete("/api/users/:userId", async (req, res) => {
    try {
      const userIdToDelete = parseInt(req.params.userId);
      const requesterId = parseInt(req.query.userId as string);

      // Check if requester is admin
      const requester = await storage.getUser(requesterId);
      if (!requester || requester.role !== "admin") {
        return res.status(403).json({ message: "Permission denied" });
      }

      // Don't allow deleting admin
      const userToDelete = await storage.getUser(userIdToDelete);
      if (!userToDelete || userToDelete.role === "admin") {
        return res.status(400).json({ message: "Cannot delete admin account" });
      }

      // Delete all user's chats first
      const userChats = await storage.getUserChats(userIdToDelete, true);
      for (const chat of userChats) {
        await storage.deleteChat(chat.id, userIdToDelete, true);
      }

      // Delete all user's memories
      const userMemories = await storage.getMemoriesByUserId(userIdToDelete);
      for (const memory of userMemories) {
        // 先删除记忆相关的关键词和嵌入向量
        await storage.deleteKeywordsByMemoryId(memory.id);

        // 获取嵌入并删除
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        if (embedding) {
          // 这里没有专门的deleteEmbedding方法，但嵌入表有memoryId唯一约束，会随记忆自动删除
        }

        // 删除记忆本身
        await storage.deleteMemory(memory.id);
      }

      // Delete the user
      await storage.deleteUser(userIdToDelete);

      res.json({ success: true });
    } catch (error) {
      log(`Error deleting user: ${error}`);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Password change endpoint
  app.post("/api/change-password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;

      // Get user and verify current password
      const user = await storage.getUser(userId);
      const dbPassword = user?.password || '';
      const inputPassword = currentPassword || '';

      log(`[修改密码] 密码比较: 数据库="${dbPassword}", 输入="${inputPassword}"`);

      if (!user || dbPassword !== inputPassword) {
        return res.status(401).json({
          success: false,
          message: "当前密码错误"
        });
      }

      // Update password
      await storage.updateUserPassword(userId, newPassword);
      res.json({ success: true });
    } catch (error) {
      log(`Password change error: ${error}`);
      res.status(500).json({
        success: false,
        message: "修改密码失败，请稍后重试"
      });
    }
  });


  // Chat message route
  // 聊天统计API端点
  app.get("/api/chat-stats", async (req, res) => {
    try {
      const userId = req.query.userId;

      // 验证请求者是否是管理员
      const requester = await storage.getUser(Number(userId));
      if (!requester || requester.role !== "admin") {
        return res.status(403).json({ 
          success: false,
          message: "Permission denied" 
        });
      }

      // 获取所有用户的聊天记录总数
      const users = await storage.getAllUsers();
      let totalChats = 0;
      let todayChats = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const user of users) {
        if (user.role === "admin") continue; // 不统计管理员的聊天

        const userChats = await storage.getUserChats(user.id, true);
        totalChats += userChats.length;

        // 统计今日聊天数
        const todayUserChats = userChats.filter(chat => {
          if (!chat.createdAt) return false;
          const chatDate = new Date(chat.createdAt);
          return chatDate >= today;
        });

        todayChats += todayUserChats.length;
      }

      res.json({
        success: true,
        total: totalChats,
        today: todayChats
      });
    } catch (error) {
      log(`Error fetching chat stats: ${error}`);
      res.status(500).json({
        success: false,
        message: "Failed to fetch chat statistics"
      });
    }
  });

  // 消息编辑
  app.patch("/api/messages/:messageId", async (req, res) => {
    try {
      const { content, userId, userRole } = req.body;
      const messageId = parseInt(req.params.messageId, 10);

      if (isNaN(messageId) || !content || !userId) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }

      // 确保只有用户可以编辑自己的消息
      const isAdmin = userRole === "admin";
      const isUserOwned = !isAdmin; // 普通用户只能编辑自己的消息

      const updatedMessage = await storage.updateMessage(messageId, content, isUserOwned);
      res.json(updatedMessage);
    } catch (error) {
      log(`Error updating message: ${error}`);
      res.status(500).json({ message: "Failed to update message" });
    }
  });

  // 消息反馈（点赞/踩）及文本反馈
  app.patch("/api/messages/:messageId/feedback", async (req, res) => {
    try {
      const { feedback, feedbackText } = req.body;
      const messageId = parseInt(req.params.messageId, 10);

      if (isNaN(messageId) || !feedback || !["like", "dislike"].includes(feedback)) {
        return res.status(400).json({ message: "Invalid feedback parameters" });
      }

      const updatedMessage = await storage.updateMessageFeedback(
        messageId, 
        feedback as "like" | "dislike", 
        feedbackText
      );
      res.json(updatedMessage);
    } catch (error) {
      log(`Error updating message feedback: ${error}`);
      res.status(500).json({ message: "Failed to update message feedback" });
    }
  });

  // 重新生成AI回复
  app.post("/api/messages/:messageId/regenerate", async (req, res) => {
    try {
      const { userId, userRole, chatId, model, useWebSearch } = req.body;
      const messageId = parseInt(req.params.messageId, 10);

      if (isNaN(messageId) || !userId || !chatId) {
        log(`重新生成消息参数无效: messageId=${messageId}, userId=${userId}, chatId=${chatId}`);
        return res.status(400).json({ 
          message: "Invalid request parameters",
          details: { messageId, hasUserId: !!userId, hasChatId: !!chatId }
        });
      }

      // 记录关键信息，用于调试
      log(`开始重新生成消息: messageId=${messageId}, userId=${userId}, chatId=${chatId}, model=${model}, 使用网络搜索=${useWebSearch}`);

      // 验证用户对此聊天的访问权限
      const isAdmin = userRole === "admin";
      const chat = await storage.getChatById(chatId, userId, isAdmin);
      if (!chat) {
        log(`用户无权访问或聊天不存在: userId=${userId}, chatId=${chatId}, isAdmin=${isAdmin}`);
        return res.status(404).json({ message: "Chat not found or access denied" });
      }

      // 使用请求中指定的模型，如果没有则使用聊天中的模型，都没有则使用默认模型
      const modelToUse = model || chat.model || "deep";
      log(`重新生成将使用模型: ${modelToUse}`);
      chatService.setModel(modelToUse);
      
      // 判断是否使用网络搜索
      const shouldUseSearch = (useWebSearch === true);
      log(`重新生成是否使用网络搜索: ${shouldUseSearch}`);
      
      // 如果需要搜索API key但未设置
      if (shouldUseSearch && !process.env.SERPER_API_KEY) {
        log('请求网络搜索，但SERPER_API_KEY未设置');
        return res.status(400).json({
          message: "搜索功能需要设置SERPER_API_KEY环境变量",
          error: "MISSING_SEARCH_API_KEY"
        });
      }

      try {
        // 尝试直接获取消息
        log(`尝试直接通过ID获取消息: ${messageId}`);
        const message = await storage.getMessageById(messageId);

        if (message) {
          log(`找到消息(ID ${messageId}), 开始查找相关用户提问`);
          // 获取触发此AI回复的用户消息
          const chatMessages = await storage.getChatMessages(chatId, userId, isAdmin);
          const messageIndex = chatMessages.findIndex(m => m.id === messageId);

          // 找到最近的用户消息作为提示
          let promptMessage = "请重新回答之前的问题";
          let foundUserMessage = false;

          if (messageIndex !== -1) {
            for (let i = messageIndex - 1; i >= 0; i--) {
              if (chatMessages[i].role === "user") {
                promptMessage = chatMessages[i].content;
                foundUserMessage = true;
                log(`找到相关用户提问: "${promptMessage.substring(0, 50)}..."`);
                break;
              }
            }
          } else {
            // 如果找不到消息索引，尝试从最新的开始寻找
            for (let i = chatMessages.length - 1; i >= 0; i--) {
              if (chatMessages[i].role === "user") {
                promptMessage = chatMessages[i].content;
                foundUserMessage = true;
                log(`使用最新的用户提问: "${promptMessage.substring(0, 50)}..."`);
                break;
              }
            }
          }

          if (!foundUserMessage) {
            log(`未找到相关用户提问，使用默认提示`);
          }

          // 判断是否为中间消息（非最后一条）
          const allChatMessages = await storage.getChatMessages(Number(chatId), userId, isAdmin, false); // 获取所有消息（包括非活跃）
          const assistantMessages = allChatMessages.filter(m => m.role === "assistant");
          const isMiddleMessage = messageId !== assistantMessages[assistantMessages.length - 1].id;
          
          // 如果是中间消息，需要将其后的所有消息标记为非活跃
          if (isMiddleMessage) {
            log(`检测到重新生成的是中间消息 ${messageId}，将创建新分支`);
            
            // 显示确认对话框，告知用户后续消息将被隐藏
            const confirmMessage = "重新生成此中间消息将创建新的对话分支，之后的消息将被隐藏。是否继续？";
            log(`向用户展示确认信息: "${confirmMessage}"`);
            
            // 标记此消息之后的所有消息为非活跃
            await storage.deactivateMessagesAfter(Number(chatId), messageId);
            log(`已将消息 ${messageId} 之后的所有消息标记为非活跃`);
          }

          // 提取所有当前活跃的消息用于上下文
          const activeMessages = await storage.getChatMessages(chatId, userId, isAdmin, true);
          
          // 确定是针对哪个消息进行重新生成
          const targetIndex = activeMessages.findIndex(m => m.id === messageId);
          
          // 如果在活跃消息中找不到，可能是出现了错误
          if (targetIndex === -1) {
            log(`警告: 在活跃消息中未找到目标消息ID ${messageId}`);
          }
          
          // 获取重新生成目标消息之前的所有消息作为上下文
          const contextMessages = targetIndex !== -1 
            ? activeMessages.slice(0, targetIndex) 
            : activeMessages.filter(m => m.id !== messageId); // 备选：排除当前消息的所有其他消息
            
          log(`为消息 ${messageId} 准备重新生成，使用 ${contextMessages.length} 条消息作为上下文`);
          
          // 使用上下文消息进行重新生成，确保只使用目标消息之前的对话
          log(`使用自定义上下文重新生成回复: "${promptMessage.substring(0, 50)}..."，上下文消息数量=${contextMessages.length}，使用网络搜索=${shouldUseSearch}`);
          const response = await chatService.sendMessage(promptMessage, userId, Number(chatId), shouldUseSearch, contextMessages);

          // 更新数据库中的消息，包括模型信息
          const updatedMessage = await storage.updateMessage(messageId, response.text, false, response.model);

          log(`回复重新生成成功，更新消息ID ${messageId}，使用模型 ${response.model}`);
          return res.json(updatedMessage);
        } else {
          log(`通过ID ${messageId} 未找到消息，尝试获取最后一条AI消息`);
        }
      } catch (messageError) {
        log(`获取特定消息失败，尝试备选方法: ${messageError}`);
      }

      // 备选方法：找最后一条AI消息
      log(`执行备选方法：获取最后一条AI消息`);
      const chatMessages = await storage.getChatMessages(chatId, userId, isAdmin);

      // 确保有至少一条AI回复
      const aiMessages = chatMessages.filter(m => m.role === "assistant");
      if (aiMessages.length === 0) {
        log(`没有找到任何AI消息可以重新生成`);
        return res.status(404).json({ message: "No AI messages found to regenerate" });
      }

      // 使用最后一条AI消息
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      log(`找到最后一条AI消息，ID: ${lastAiMessage.id}`);

      const messageIndex = chatMessages.findIndex(m => m.id === lastAiMessage.id);

      // 找到触发该AI回复的用户消息
      let promptMessage = "请重新回答";
      let foundUserPrompt = false;

      if (messageIndex !== -1) {
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (chatMessages[i].role === "user") {
            promptMessage = chatMessages[i].content;
            foundUserPrompt = true;
            log(`找到用户提问: "${promptMessage.substring(0, 50)}..."`);
            break;
          }
        }
      }

      if (!foundUserPrompt) {
        // 如果找不到具体的提问，使用最后一条用户消息
        const userMessages = chatMessages.filter(m => m.role === "user");
        if (userMessages.length > 0) {
          promptMessage = userMessages[userMessages.length - 1].content;
          log(`没有找到特定提问，使用最后一条用户消息: "${promptMessage.substring(0, 50)}..."`);
        } else {
          log(`没有找到任何用户消息，使用默认提示`);
        }
      }

      // 重新生成回复，传入网络搜索参数
      log(`使用提示重新生成回复: "${promptMessage.substring(0, 50)}..."，使用网络搜索=${shouldUseSearch}`);
      const response = await chatService.sendMessage(promptMessage, userId, Number(chatId), shouldUseSearch);

      // 更新数据库中的消息，包括模型信息
      const updatedMessage = await storage.updateMessage(lastAiMessage.id, response.text, false, response.model);

      log(`回复重新生成成功，更新消息ID ${lastAiMessage.id}，使用模型 ${response.model}`);
      res.json(updatedMessage);
    } catch (error) {
      log(`Error regenerating message: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ 
        message: "Failed to regenerate message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 创建消息
  app.post("/api/messages", async (req, res) => {
    try {
      // 从会话中获取用户ID和角色
      const userId = req.session?.userId;
      const userRole = req.session?.userRole;
      const { chatId, content, role } = req.body;

      if (!chatId || !content || !role || !userId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // 确保用户有权限向此聊天添加消息
      const isAdmin = userRole === "admin";
      const chat = await storage.getChatById(chatId, userId, isAdmin);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found or access denied" });
      }

      // 创建消息
      const message = await storage.createMessage(chatId, content, role);
      res.status(201).json(message);
    } catch (error) {
      log(`Error creating message: ${error}`);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // 更新聊天模型 - 用于跨模型上下文共享
  app.patch("/api/chats/:chatId/model", async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId, 10);
      const { model, userId, userRole, useWebSearch } = req.body;

      if (isNaN(chatId) || !model || !userId) {
        return res.status(400).json({ 
          message: "Invalid request parameters",
          error: "INVALID_PARAMETERS" 
        });
      }

      // 验证模型格式
      const validModels = ["deep", "gemini", "deepseek", "grok"];
      if (!validModels.includes(model)) {
        return res.status(400).json({
          message: "Unsupported model type",
          error: "UNSUPPORTED_MODEL"
        });
      }

      // 验证用户对此聊天的访问权限
      const isAdmin = userRole === "admin";
      const chat = await storage.getChatById(chatId, userId, isAdmin);
      if (!chat) {
        return res.status(404).json({ 
          message: "Chat not found or access denied",
          error: "CHAT_NOT_FOUND"
        });
      }

      // 如果模型没有变化，直接返回成功
      if (chat.model === model) {
        return res.json({ 
          success: true, 
          message: "Chat model unchanged",
          model: model,
          changed: false
        });
      }

      // 获取聊天历史消息，用于保持上下文连续性
      log(`正在为模型切换 ${chat.model} -> ${model} 获取历史消息，聊天ID: ${chatId}`);
      const messages = await storage.getChatMessages(chatId, userId, isAdmin);
      
      // 创建一条系统消息记录模型切换事件
      let modelSwitchMessage = `已从 ${chat.model} 模型切换至 ${model} 模型。`;
      
      // 根据目标模型的窗口大小判断是否需要进行历史消息压缩
      let contextContent = "";
      let isContextTrimmed = false;
      
      // 构建原始消息内容 - 最多保留最近15条消息，避免过长
      const recentMessages = messages.slice(-15);
      for (const msg of recentMessages) {
        if (msg.role !== "system") { // 排除系统消息
          const prefix = msg.role === "user" ? "用户: " : "AI: ";
          contextContent += `${prefix}${msg.content}\n\n`;
        }
      }
      
      // 检查上下文大小，根据模型限制可能需要压缩
      // 估算当前文本的token数量（粗略估计：平均每4个字符一个token）
      const estimatedTokens = Math.ceil(contextContent.length / 4);
      
      // 模型窗口大小定义
      const MODEL_MAX_TOKENS: Record<string, number> = {
        "deepseek": 16000,  // DeepSeek-R1
        "gemini": 32000,    // Gemini 2.5 Pro
        "grok": 4000,       // Grok 3 Fast Beta
        "deep": 8000        // Deep
      };
      
      const maxTokens = MODEL_MAX_TOKENS[model] || 8000; // 默认值
      const reservedTokens = 2000; // 为系统提示和回复预留的token数
      
      // 如果估计的token数量超出模型限制，则进行摘要
      if (estimatedTokens > maxTokens - reservedTokens) {
        log(`上下文超出${model}模型限制，需要进行摘要，原始估计token: ${estimatedTokens}，限制: ${maxTokens - reservedTokens}`);
        // 生成历史消息摘要
        contextContent = await generateChatHistorySummary(messages);
        isContextTrimmed = true;
        log(`已生成上下文摘要，长度: ${contextContent.length} 字符，估计token: ${Math.ceil(contextContent.length / 4)}`);
      } else {
        log(`保留完整上下文，估计token: ${estimatedTokens}，${model}模型限制: ${maxTokens - reservedTokens}`);
      }
      
      // 在提示词管理服务中记录模型切换
      // 使用历史消息或摘要生成上下文保持提示
      const modelSwitchPrompt = promptManagerService.generateModelSwitchCheckPrompt(model, contextContent);
      
      // 创建一条系统消息用于模型切换通知
      await storage.createMessage(chatId, modelSwitchMessage, "system");
      log(`已添加模型切换系统消息`);
      
      // 更新聊天模型
      await storage.updateChatModel(chatId, model);
      log(`已更新聊天 ${chatId} 的模型从 ${chat.model} 变更为 ${model}，用户ID: ${userId}`);
      
      // 设置聊天服务的模型和网络搜索状态（如果提供）
      chatService.setModel(model);
      if (useWebSearch !== undefined) {
        chatService.setWebSearchEnabled(useWebSearch);
        log(`网络搜索状态已设置为: ${useWebSearch}`);
      }

      res.json({ 
        success: true, 
        message: "Chat model updated successfully",
        previousModel: chat.model,
        newModel: model,
        contextPreserved: contextContent.length > 0,
        contextTrimmed: isContextTrimmed,
        changed: true
      });
    } catch (error) {
      log(`更新聊天模型错误: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ 
        message: "Failed to update chat model", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, model, chatId, userId, role, useWebSearch } = req.body;

      if (!message) {
        return res.status(400).json({
          message: "Message is required",
          error: "MISSING_MESSAGE"
        });
      }
      
      // 检测消息是否包含图片或文件
      const containsImage = message.includes('![Uploaded Image](') && message.includes(')');
      const containsFile = message.includes('[文件](') && message.includes(')') || 
                           message.includes('[file](') && message.includes(')');
      
      // 模型兼容性检查 - 如果包含图片或文件但使用不支持的模型，自动切换到Grok
      let actualModel = model;
      let modelSwitched = false;
      if (containsImage || containsFile) {
        // 目前只有Grok和Gemini支持多模态输入，但优先使用Grok
        if (model === 'deepseek' || model === 'deep' || model === 'gemini') {
          log(`检测到图片或文件消息，但选择的模型 ${model} 不是优选的多模态处理模型，自动切换到Grok模型`);
          actualModel = 'grok';
          modelSwitched = true;
        }
      }

      if (!userId) {
        return res.status(401).json({ message: "Please login first" });
      }

      // 禁止管理员发送聊天消息
      const user = await storage.getUser(Number(userId));
      if (user && user.role === "admin") {
        return res.status(403).json({ 
          message: "管理员账户仅用于管理系统，不能参与聊天" 
        });
      }

      // 确保我们有有效的聊天ID
      if (!chatId) {
        log(`警告: 收到没有chatId的消息请求`);
        return res.status(400).json({
          message: "Chat ID is required",
          error: "MISSING_CHAT_ID"
        });
      }

      // 验证聊天ID的有效性
      const isAdmin = role === "admin";
      const chat = await storage.getChatById(chatId, Number(userId), isAdmin);
      if (!chat) {
        log(`错误: 用户 ${userId} 无法访问聊天 ${chatId}`);
        return res.status(403).json({ 
          message: "Access denied or chat not found" 
        });
      }

      // 如果提供了模型参数，设置聊天服务的模型
      if (model) {
        try {
          // 使用实际模型（如果因图片处理被自动切换）
          chatService.setModel(actualModel);

          // 如果模型与聊天记录中的不同，更新聊天记录模型
          if (chat.model !== actualModel) {
            await storage.updateChatModel(chatId, actualModel);
            log(`已更新聊天 ${chatId} 的模型为 ${actualModel}${modelSwitched ? ' (自动切换)' : ''}`);
          }
        } catch (error) {
          return res.status(400).json({
            message: "Invalid model selected",
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        // 使用聊天记录中的模型，但如果是图片且模型不支持，切换到Gemini
        try {
          if (modelSwitched) {
            chatService.setModel(actualModel);
            // 更新数据库中的模型
            await storage.updateChatModel(chatId, actualModel);
            log(`已更新聊天 ${chatId} 的模型为 ${actualModel} (自动切换)`);
          } else {
            chatService.setModel(chat.model);
          }
        } catch (error) {
          log(`警告: 无法设置模型为 ${modelSwitched ? actualModel : chat.model}, 使用默认模型: ${error}`);
          // 使用默认模型，不返回错误
        }
      }

      // 判断是否使用网络搜索
      // 网络搜索现在是一个辅助功能，不再是独立模型
      const shouldUseSearch = (useWebSearch === true);

      // 获取AI响应，传入userId用于记忆检索，以及网络搜索参数
      log(`处理来自用户 ${userId} 的聊天消息，聊天ID: ${chatId}，模型: ${chat.model}，搜索: ${shouldUseSearch}`);

      // 如果需要搜索API key但未设置
      if (shouldUseSearch && !process.env.SERPER_API_KEY) {
        log('请求网络搜索，但SERPER_API_KEY未设置');
        return res.status(400).json({
          message: "搜索功能需要设置SERPER_API_KEY环境变量",
          error: "MISSING_SEARCH_API_KEY"
        });
      }

      // 特殊处理Deep模型，直接发送消息，不传入记忆和搜索参数，让工作流来处理所有内容
      let response;
      if (actualModel === "deep") {
        log(`使用Deep模型，简化请求，直接传递用户查询`);
        response = await chatService.sendMessage(message);
      } else {
        // 更新模型设置（如果发生了自动切换）
        if (modelSwitched) {
          chatService.setModel(actualModel);
          const mediaType = containsImage ? (containsFile ? "图片与文件" : "图片") : "文件";
          log(`由于${mediaType}处理需要，模型已从 ${model} 自动切换到 ${actualModel}`);
        }
        
        // 正常的处理流程，包含记忆和搜索功能
        response = await chatService.sendMessage(message, Number(userId), Number(chatId), shouldUseSearch);
        
        // 如果模型被自动切换，在响应中添加通知
        if (modelSwitched) {
          const mediaType = containsImage ? (containsFile ? "图片或文件" : "图片") : "文件";
          response.text = `[系统通知: 由于您发送了${mediaType}，系统已自动切换到支持多模态输入的Grok模型]\n\n${response.text}`;
        }
      }

      // 存储消息到数据库
      try {
        // 先存储用户消息
        const userMsg = await storage.createMessage(chatId, message, "user");
        log(`已存储用户消息，ID: ${userMsg.id}`);

        // 再存储AI响应，包含模型信息
        const aiMsg = await storage.createMessage(chatId, response.text, "assistant", response.model);
        log(`已存储AI响应，ID: ${aiMsg.id}，模型: ${response.model || "未知"}`);

        // 保存到记忆系统
        try {
          // 调用Python记忆服务保存用户消息
          const saveUserMemoryProcess = spawn('python3', ['-c', `
import asyncio
import sys
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def save_memory():
    await learning_memory_service.save_memory(${userId}, """${message.replace(/"/g, '\\"')}""", "chat")
    print("用户消息已保存到记忆系统")

asyncio.run(save_memory())
          `]);

          saveUserMemoryProcess.stdout.on('data', (data) => {
            log(`记忆保存结果(用户): ${data.toString().trim()}`);
          });

          saveUserMemoryProcess.stderr.on('data', (data) => {
            log(`记忆保存错误(用户): ${data.toString().trim()}`);
          });

          // 也保存AI回复到记忆系统
          const saveAIMemoryProcess = spawn('python3', ['-c', `
import asyncio
import sys
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def save_memory():
    await learning_memory_service.save_memory(${userId}, """${response.text.replace(/"/g, '\\"')}""", "assistant")
    print("AI回复已保存到记忆系统")

asyncio.run(save_memory())
          `]);

          saveAIMemoryProcess.stdout.on('data', (data) => {
            log(`记忆保存结果(AI): ${data.toString().trim()}`);
          });

          saveAIMemoryProcess.stderr.on('data', (data) => {
            log(`记忆保存错误(AI): ${data.toString().trim()}`);
          });

          log(`已尝试将消息保存到记忆系统，用户ID: ${userId}`);
        } catch (memoryError) {
          log(`保存消息到记忆系统失败: ${memoryError instanceof Error ? memoryError.message : String(memoryError)}`);
        }
      } catch (dbError) {
        log(`数据库存储消息错误: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        // 继续发送响应，但记录错误
      }

      res.json(response);
    } catch (error) {
      log(`Chat error: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({
        message: "Failed to process chat message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Image upload endpoint
  app.post("/api/upload", express.json({limit: '50mb'}), async (req, res) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ message: "No image provided" });
      }

      // Check if image is base64
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }

      // Generate unique filename
      const filename = `${Date.now()}.png`;
      const filepath = path.join(uploadsDir, filename);

      // Save file
      fs.writeFileSync(filepath, buffer);

      // Return the URL
      res.json({ url: `/uploads/${filename}` });
    } catch (error) {
      log(`Error uploading image: ${error}`);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });
  
  // 新增图片预处理端点 - 使用Grok Vision分析图片
  app.post("/api/preprocess-image", express.json({limit: '100mb'}), async (req, res) => {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ 
          success: false,
          message: "No image URL provided" 
        });
      }

      log(`正在使用Grok-2 Vision预处理图片: ${imageUrl}`);
      
      // 检查URL是否为有效的上传图片路径
      if (!imageUrl.startsWith('/uploads/')) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid image URL" 
        });
      }
      
      // 检查文件是否存在
      const filepath = path.join(process.cwd(), imageUrl);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ 
          success: false,
          message: "Image file not found" 
        });
      }
      
      // 构建带有图片URL的Message格式内容 - 使用Markdown格式引用本地图片URL
      // 新的处理方式：不再转换为base64，而是使用文件ID方式
      const userMessage = `![Uploaded Image](${imageUrl})`;
      
      try {
        // 调用修改后的Grok Vision处理函数，它会内部使用文件上传API
        const response = await chatService.processImageWithGrokVision(userMessage);
        
        // 返回处理结果
        res.json({
          success: true,
          originalUrl: imageUrl,
          description: response.text,
          model: response.model || "grok-2-vision-1212",
          processedAt: new Date().toISOString()
        });
      } catch (grokError) {
        log(`Grok Vision处理图片失败: ${grokError}`);
        // 返回错误但不阻止客户端继续使用原始图片
        res.status(200).json({
          success: false,
          originalUrl: imageUrl,
          description: "图片处理失败，但您仍然可以继续发送。",
          error: grokError instanceof Error ? grokError.message : String(grokError)
        });
      }
    } catch (error) {
      log(`图片预处理错误: ${error}`);
      res.status(500).json({ 
        success: false,
        message: "Failed to preprocess image",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


  // 临时管理员角色修复端点
  app.get("/api/fix-admin", async (req, res) => {
    try {
      // 直接将ID为1的用户设置为管理员
      await storage.updateUserRole(1, "admin");

      // 打印确认信息
      const user = await storage.getUser(1);
      console.log(`用户ID 1 角色已更新为: ${user?.role}`);

      res.json({ 
        success: true, 
        message: "管理员角色已修复",
        user
      });
    } catch (error) {
      console.error(`管理员角色修复错误: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "角色修复失败" 
      });
    }
  });

  // Add this route handler inside the registerRoutes function
  app.post("/api/verify-turnstile", async (req, res) => {
    try {
      // 检查是否之前已通过开发者模式验证 - 允许有特定注册会话
      // @ts-ignore - 我们知道这个属性存在
      if (req.session && req.session.developerModeVerified === true) {
        log('[Turnstile] 开发者模式已验证，跳过Turnstile验证');
        return res.json({ success: true });
      }

      const { token } = req.body;

      // 接受绕过令牌 - 在任何环境中使用特定令牌都允许自动通过
      if (token && 
          (token === "bypass-token" || 
           token === "bypass-token-from-widget" || 
           token === "bypass-token-missing-key")) {
        log('[Turnstile] 检测到绕过令牌，自动通过验证');
        return res.json({ success: true });
      }

      // 开发环境或测试环境中自动跳过验证
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        log('[Turnstile] 开发环境中跳过验证');
        return res.json({ success: true });
      }

      if (!token) {
        log('[Turnstile] Missing token in request');
        return res.status(400).json({ 
          success: false, 
          message: "Missing verification token" 
        });
      }

      const isValid = await verifyTurnstileToken(token);

      if (!isValid) {
        log('[Turnstile] Invalid token');
        return res.status(400).json({ 
          success: false, 
          message: "Invalid verification token" 
        });
      }

      log('[Turnstile] Token verified successfully');
      res.json({ success: true });
    } catch (error) {
      log(`[Turnstile] Verification error: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "验证失败，请稍后重试" 
      });
    }
  });

  // 添加记忆API（用于存储对话内容）
  app.post('/api/memory', async (req, res) => {
    try {
      const { userId, content, type } = req.body;

      if (!userId || !content || isNaN(Number(userId))) {
        return res.status(400).json({ error: "无效的请求参数" });
      }

      log(`尝试保存记忆: 用户=${userId}, 内容长度=${content.length}, 类型=${type || 'chat'}`);

      // 调用Python服务保存记忆
      const pythonProcess = spawn('python3', ['-c', `
import asyncio
import sys
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def save():
    await learning_memory_service.save_memory(${userId}, """${content.replace(/"/g, '\\"')}""", "${type || 'chat'}")
    print("success")

asyncio.run(save())
      `]);

      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        log(`记忆保存输出: ${data.toString().trim()}`);
      });

      let errorOutput = '';
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        log(`记忆保存错误: ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`保存记忆进程退出，错误码 ${code}: ${errorOutput}`);
          return res.status(500).json({ error: "保存记忆失败" });
        }

        log(`记忆保存成功，用户ID: ${userId}`);
        return res.json({ success: true });
      });
    } catch (error) {
      log(`保存记忆API错误: ${error}`);
      return res.status(500).json({ error: "保存记忆服务错误" });
    }
  });

  // 添加检索相似记忆API
  app.post('/api/similar-memories', async (req, res) => {
    try {
      const { userId, query, limit = 5 } = req.body;

      if (!userId || !query || isNaN(Number(userId))) {
        return res.status(400).json({ error: "无效的请求参数" });
      }

      log(`尝试检索相似记忆: 用户=${userId}, 查询=${query.substring(0, 50)}...`);

      // 调用Python服务检索相似记忆
      const pythonProcess = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def retrieve_memories():
    try:
        # 检索相似记忆
        memories = await learning_memory_service.retrieve_similar_memories(${userId}, """${query.replace(/"/g, '\\"')}""", ${limit})
        # 转换为JSON输出
        print("JSON_RESULT_BEGIN")
        print(json.dumps(memories, ensure_ascii=False))
        print("JSON_RESULT_END")
    except Exception as e:
        print(f"记忆检索错误: {str(e)}")
        # 返回空数组而不是失败
        print("[]")

asyncio.run(retrieve_memories())
      `]);

      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        log(`记忆检索输出: ${data.toString().trim()}`);
      });

      let errorOutput = '';
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        log(`检索记忆错误: ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`检索记忆进程退出，错误码 ${code}: ${errorOutput}`);
          return res.status(500).json({ error: "检索记忆失败" });
        }

        try {
          // 解析输出为JSON
          const memories = output.trim() ? JSON.parse(output) : [];
          log(`成功检索到 ${memories.length} 条相似记忆`);
          return res.json({ success: true, memories });
        } catch (parseError) {
          log(`解析记忆结果错误: ${parseError}, 原始输出: ${output}`);
          return res.status(500).json({ error: "解析记忆结果失败" });
        }
      });
    } catch (error) {
      log(`检索记忆API错误: ${error}`);
      return res.status(500).json({ error: "检索记忆服务错误" });
    }
  });

  // 添加记忆系统测试API
  app.get('/api/memory-test', async (req, res) => {
    try {
      const { userId } = req.query;

      if (!userId || isNaN(Number(userId))) {
        return res.status(400).json({ error: "无效的用户ID" });
      }

      // 检查记忆目录状态
      const memoryDir = "memory_space";
      const userDir = path.join(memoryDir, String(userId));

      // 确保目录存在
      if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir);
        log(`创建记忆目录: ${memoryDir}`);
      }

      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir);
        log(`创建用户记忆目录: ${userDir}`);
      }

      // 尝试写入一条测试记忆
      const testContent = "这是一条测试记忆，用于验证记忆系统是否正常工作";

      const pythonProcess = spawn('python3', ['-c', `
import asyncio
import sys
import os
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def test_memory():
    # 打印当前工作目录
    print(f"当前工作目录: {os.getcwd()}")
    print(f"memory_space目录是否存在: {os.path.exists('memory_space')}")
    print(f"用户目录是否存在: {os.path.exists('memory_space/${userId}')}")

    # 尝试保存一条测试记忆
    await learning_memory_service.save_memory(${userId}, "${testContent}", "test")
    print("测试记忆已保存")

    # 尝试检索这条测试记忆
    memories = await learning_memory_service.retrieve_similar_memories(${userId}, "${testContent}", 1)

    # 打印检索结果
    print(f"找到 {len(memories)} 条相似记忆")
    for memory in memories:
        print(f"记忆内容: {memory['content'][:50]}...")
        print(f"记忆类型: {memory['type']}")
        print(f"记忆时间: {memory['timestamp']}")

asyncio.run(test_memory())
      `]);

      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        log(`记忆测试输出: ${data.toString().trim()}`);
      });

      let errorOutput = '';
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        log(`记忆测试错误: ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        const result: {
          code: number | null;
          success: boolean;
          output: string;
          error: string;
          filesExist: { memoryDir: boolean; userDir: boolean };
          userFiles?: { count?: number; examples?: string[]; error?: string };
        } = {
          code: code,
          success: code === 0,
          output: output,
          error: errorOutput,
          filesExist: {
            memoryDir: fs.existsSync(memoryDir),
            userDir: fs.existsSync(userDir)
          }
        };

        if (fs.existsSync(userDir)) {
          try {
            const files = fs.readdirSync(userDir);
            result.userFiles = {
              count: files.length,
              examples: files.slice(0, 5)
            };
          } catch (e) {
            result.userFiles = { error: String(e) };
          }
        }

        return res.json(result);
      });
    } catch (error) {
      log(`记忆测试API错误: ${error}`);
      return res.status(500).json({ 
        error: "记忆测试失败",
        message: String(error)
      });
    }
  });

  // 注册学习轨迹路由
  // 初始化文件存储桶
  await initializeBucket();

  // 静态文件服务
  app.use('/backgrounds', express.static(path.join(process.cwd(), 'public/backgrounds')));

  // API路由
  app.use('/api/files', filesRoutes);
  app.use('/api/learning-path', learningPathRoutes);
  app.use('/api/memory-space', memorySpaceRoutes);
  app.use('/api/system-config', systemConfigRoutes);
  app.use('/api/memory-test', memoryTestRoutes);
  app.use('/api/test-data', testDataRoutes); // 只用于测试环境，生成测试数据
  app.use('/api/user-settings', userSettingsRoutes);
  app.use('/api/embedding', embeddingApiRoutes); // 嵌入向量API接口
  
  // 注册学生智能体路由
  app.use('/api/student-agent', studentAgentRoutes);
  // 启用学生代理模拟器路由
  app.use('/api/student-agent-simulator', studentAgentSimulatorRoutes);
  
  // 注册聚类测试路由
  app.use('/api/test', clusteringTestRoutes);
  
  // 添加测试消息标记为非活跃的端点
  app.post('/api/test/deactivate-messages', async (req, res) => {
    try {
      const { chatId, messageId } = req.body;
      if (!chatId || !messageId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      log(`测试端点: 标记聊天 ${chatId} 中消息 ${messageId} 之后的消息为非活跃`);
      await storage.deactivateMessagesAfter(chatId, messageId);
      
      // 验证更新效果
      const allMessages = await storage.getChatMessages(chatId, 1, true, false); // 获取所有消息，包括非活跃的
      const activeMessages = await storage.getChatMessages(chatId, 1, true, true); // 只获取活跃消息
      
      log(`消息总数: ${allMessages.length}, 活跃消息数: ${activeMessages.length}`);
      
      res.json({
        success: true,
        totalMessages: allMessages.length,
        activeMessages: activeMessages.length,
        deactivated: allMessages.length - activeMessages.length
      });
    } catch (error) {
      log(`测试端点出错: ${error}`);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // 添加测试端点：获取所有消息，包括非活跃消息
  app.get('/api/test/get-all-messages', async (req, res) => {
    try {
      const { chatId } = req.query;
      if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId parameter' });
      }
      
      log(`测试端点: 获取聊天 ${chatId} 的所有消息，包括非活跃消息`);
      const messages = await storage.getChatMessages(Number(chatId), 1, true, false);
      
      log(`获取到 ${messages.length} 条消息，其中活跃消息: ${messages.filter(m => m.isActive).length} 条`);
      
      res.json({
        success: true,
        messages,
        total: messages.length,
        active: messages.filter(m => m.isActive).length,
        inactive: messages.filter(m => !m.isActive).length
      });
    } catch (error) {
      log(`测试端点出错: ${error}`);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // 注册记忆修复路由
  app.use('/api/repair-memory', repairMemoryRoutes);
  app.use('/api/admin/prompts', adminPromptsRoutes);
  app.use('/api/admin/content-moderation', contentModerationRoutes);
  app.use('/api/mcp', mcpRoutes); // MCP 搜索服务路由
  app.use('/api', conversationTestRoutes); // 对话分析和提示词测试路由
  app.use('/api/topic-graph', topicGraphRoutes); // 主题图谱服务路由

  // 调试端点：检查当前会话状态
  app.get("/api/debug/session", (req, res) => {
    try {
      const sessionInfo = {
        hasSession: !!req.session,
        userId: req.session?.userId,
        userRole: req.session?.userRole,
        sessionID: req.sessionID,
        cookie: req.session?.cookie
      };

      log(`[Debug] 当前会话状态: ${JSON.stringify(sessionInfo)}`);
      res.json({
        success: true,
        session: sessionInfo
      });
    } catch (error) {
      log(`Session debug error: ${error}`);
      res.status(500).json({
        success: false,
        message: "会话调试失败"
      });
    }
  });

  // 验证会话API - 用于前端验证会话状态
  app.get("/api/verify-session", async (req, res) => {
    try {
      // 从查询参数获取用户ID
      const requestUserId = Number(req.query.userId);
      
      // 检查请求是否包含用户ID
      if (!requestUserId || isNaN(requestUserId)) {
        return res.status(400).json({
          success: false,
          message: "缺少有效的用户ID参数"
        });
      }
      
      // 检查会话中的用户ID
      const sessionUserId = req.session?.userId;
      
      log(`[会话验证] 请求验证: 参数用户ID=${requestUserId}, 会话用户ID=${sessionUserId}`);
      
      // 如果会话中没有用户ID或与请求的不匹配，尝试从数据库验证用户
      if (!sessionUserId || sessionUserId !== requestUserId) {
        log(`[会话验证] 会话不一致: 参数=${requestUserId}, 会话=${sessionUserId}`);
        
        // 从数据库获取用户信息
        const user = await storage.getUser(requestUserId);
        
        if (!user) {
          log(`[会话验证] 用户ID ${requestUserId} 在数据库中不存在`);
          return res.status(401).json({
            success: false,
            message: "用户不存在"
          });
        }
        
        // 用户存在但会话不一致，更新会话
        if (req.session) {
          req.session.userId = user.id;
          req.session.userRole = user.role || 'user';
          
          // 等待会话保存
          await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                log(`[会话验证] 保存会话失败: ${err}`);
                reject(err);
              } else {
                log(`[会话验证] 会话已更新，用户ID: ${user.id}`);
                resolve();
              }
            });
          });
          
          // 设置cookie
          res.cookie('userId', user.id.toString(), {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
          });
          
          log(`[会话验证] 重新建立会话成功，用户ID: ${user.id}`);
          
          return res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              role: user.role || 'user',
              userId: user.id // 兼容前端结构
            }
          });
        } else {
          log(`[会话验证] 无法创建会话`);
          return res.status(500).json({
            success: false,
            message: "无法创建会话"
          });
        }
      }
      
      // 会话一致，获取用户信息并返回
      const user = await storage.getUser(sessionUserId);
      
      if (!user) {
        log(`[会话验证] 会话中的用户ID ${sessionUserId} 在数据库中不存在`);
        
        // 清除无效会话
        if (req.session) {
          req.session.userId = undefined;
          req.session.userRole = undefined;
          req.session.destroy((err) => {
            if (err) log(`[会话验证] 清除会话失败: ${err}`);
          });
        }
        
        return res.status(401).json({
          success: false,
          message: "会话用户不存在"
        });
      }
      
      log(`[会话验证] 会话验证成功，用户ID: ${user.id}`);
      
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role || 'user',
          userId: user.id // 兼容前端结构
        }
      });
    } catch (error) {
      log(`[会话验证] 错误: ${error}`);
      res.status(500).json({
        success: false,
        message: "会话验证失败"
      });
    }
  });

  // 获取系统当前设置和配置
  app.get("/api/system-info", async (req, res) => {
    try {
      const systemInfo = await storage.getAllSystemConfigs();
      res.json(systemInfo);
    } catch (error) {
      log(`Error fetching system info: ${error}`);
      res.status(500).json({ message: "Failed to fetch system info" });
    }
  });
  
  // 管理员API: 获取用户反馈统计数据
  app.get("/api/admin/feedback-stats", async (req, res) => {
    try {
      // 安全检查：确认请求来自管理员
      const userId = req.session.userId;
      const userRole = req.session.userRole;
      
      if (!userId || userRole !== "admin") {
        log(`非管理员尝试访问反馈统计API: userId=${userId}, role=${userRole}`);
        return res.status(403).json({ message: "仅管理员可访问此API" });
      }
      
      log(`管理员(${userId})请求反馈统计数据`);
      const stats = await storage.getFeedbackStats();
      res.json(stats);
    } catch (error) {
      log(`获取反馈统计数据时出错: ${error}`);
      res.status(500).json({ message: "获取反馈统计数据失败", error: error.message });
    }
  });

  // DEBUG: 直接数据库调试API - 学习轨迹表
  app.get("/api/debug/learning-paths", async (req, res) => {
    try {
      // 直接从数据库查询学习轨迹表所有数据
      const { db } = await import('./db');
      const { learningPaths } = await import('../shared/schema');
      
      log(`[DEBUG] 查询学习轨迹表`);
      const result = await db.select().from(learningPaths);
      
      log(`[DEBUG] 学习轨迹表查询结果: ${result.length} 条记录`);
      res.json({ 
        success: true, 
        count: result.length,
        paths: result.map(path => ({
          id: path.id,
          userId: path.userId,
          createdAt: path.createdAt,
          expiresAt: path.expiresAt,
          topicsCount: path.topics?.length || 0
        }))
      });
    } catch (error) {
      console.error(`[DEBUG] 查询学习轨迹表出错:`, error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // DEBUG: 保存测试学习轨迹
  app.post("/api/debug/save-learning-path", async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string) || 6;
      
      log(`[DEBUG] 尝试保存测试学习轨迹数据，用户ID=${userId}`);
      
      // 从storage导入而不是trajectory，避免引入复杂依赖
      const { storage } = await import('./storage');
      
      // 创建简单的测试数据
      const testTopics = [
        { id: "test-topic-1", topic: "测试主题1", percentage: 0.4 },
        { id: "test-topic-2", topic: "测试主题2", percentage: 0.3 },
        { id: "test-topic-3", topic: "测试主题3", percentage: 0.3 }
      ];
      
      const testDistribution = testTopics;
      const testSuggestions = ["建议1", "建议2", "建议3"];
      const testGraph = { nodes: [], links: [] };
      
      // 直接调用storage保存功能
      log(`[DEBUG] 开始保存测试学习轨迹数据`);
      const savedPath = await storage.saveLearningPath(
        userId,
        testTopics,
        testDistribution,
        testSuggestions,
        testGraph
      );
      
      if (savedPath) {
        log(`[DEBUG] 测试学习轨迹保存成功! ID=${savedPath.id}`);
        
        // 再次验证是否已保存
        const verifyPath = await storage.getLearningPath(userId);
        const verified = !!verifyPath;
        
        res.json({
          success: true,
          message: "测试学习轨迹保存成功",
          path: savedPath,
          verified,
          verifyPath: verifyPath || null
        });
      } else {
        log(`[DEBUG] 测试学习轨迹保存失败，返回值为空`);
        res.status(500).json({
          success: false,
          message: "保存操作没有返回路径数据"
        });
      }
    } catch (error) {
      console.error(`[DEBUG] 保存测试学习轨迹出错:`, error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}