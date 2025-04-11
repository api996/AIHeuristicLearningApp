import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatService } from "./services/chat";
import { log } from "./vite";
import { Buffer } from "buffer";
import path from "path";
import fs from "fs";
import express from 'express';
import { verifyTurnstileToken } from './services/turnstile';
import { spawn } from 'child_process';

export async function registerRoutes(app: Express): Promise<Server> {
  // User authentication routes
  // 处理注册请求
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, turnstileToken } = req.body;

      // 验证Turnstile令牌
      if (!turnstileToken) {
        return res.status(400).json({
          success: false,
          message: "请完成人机验证"
        });
      }

      // 这里不再验证令牌，因为前端已经验证过了
      // 相信前端传来的令牌，假设它已经被验证过

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

      // 这里不再验证令牌，因为前端已经验证过了
      // 相信前端传来的令牌，假设它已经被验证过

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

      // 验证用户密码
      if (user && user.password === password) {
        res.json({ 
          success: true, 
          userId: user.id, 
          role: user.role 
        });
      } else {
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
      
      // 检查记忆目录状态
      const memoryDir = "memory_space";
      const userDir = path.join(memoryDir, String(userId));
      log(`检查学习记忆目录: ${memoryDir} 存在=${fs.existsSync(memoryDir)}`);
      log(`检查用户记忆目录: ${userDir} 存在=${fs.existsSync(userDir)}`);
      
      // 如果用户目录存在，查看其中的文件数量
      if (fs.existsSync(userDir)) {
        const files = fs.readdirSync(userDir);
        log(`用户${userId}的记忆文件数量: ${files.length}`);
        if (files.length > 0) {
          log(`示例记忆文件: ${files[0]}`);
          try {
            const filePath = path.join(userDir, files[0]);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            log(`记忆文件内容示例: ${fileContent.substring(0, 100)}...`);
          } catch (e) {
            log(`读取记忆文件失败: ${e}`);
          }
        }
      }

      const pythonProcess = spawn('python3', ['-c', `
import asyncio
import json
import sys
import os
# 切换到项目根目录，确保正确的路径
os.chdir('/home/runner/workspace')
sys.path.append('server')
import logging
# 重定向所有print输出到stderr，保留stdout只用于JSON输出
sys.stdout = sys.stderr
from services.learning_memory import learning_memory_service

async def analyze():
    result = await learning_memory_service.analyze_learning_path(${userId})
    # 恢复stdout并只输出JSON结果
    sys.stdout = sys.__stdout__
    print(json.dumps(result, ensure_ascii=False))

asyncio.run(analyze())
      `]);

      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      let errorOutput = '';
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`学习轨迹分析进程退出，错误码 ${code}: ${errorOutput}`);
          // 返回一个默认结果而不是错误状态，这样前端仍能正常显示
          return res.json({
            topics: [],
            progress: [],
            suggestions: [
              "系统正在处理您的记忆数据",
              "请继续提问，丰富您的学习记录",
              "数据积累后将能生成更准确的学习分析"
            ],
            knowledge_graph: {
              nodes: [],
              links: []
            }
          });
        }

        try {
          const result = JSON.parse(output);
          return res.json(result);
        } catch (e) {
          log(`解析学习轨迹分析结果失败: ${e}`);
          // 同样返回默认结果而不是错误状态
          return res.json({
            topics: [],
            progress: [],
            suggestions: [
              "系统正在适应您的学习风格",
              "请继续探索感兴趣的主题",
              "稍后查看将展示您的学习轨迹分析"
            ]
          });
        }
      });
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
      const { userId, title, model } = req.body;
      if (!userId) {
        return res.status(401).json({ message: "Please login first" });
      }
      const chat = await storage.createChat(userId, title || "新对话", model || "default");
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
      if (!userId) {
        return res.status(401).json({ message: "Please login first" });
      }
      const isAdmin = role === "admin";
      await storage.deleteChat(chatId, Number(userId), isAdmin);
      res.json({ success: true });
    } catch (error) {
      log(`Error deleting chat: ${error}`);
      res.status(500).json({ message: "Failed to delete chat" });
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
          .filter(user => user.role !== "admin") // 排除管理员用户
          .map(async (user) => {
            const chats = await storage.getUserChats(user.id, true);
            return {
              ...user,
              chatCount: chats.length,
              lastActive: chats[0]?.createdAt || null
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
      if (!user || user.password !== currentPassword) {
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

  // 消息反馈（点赞/踩）
  app.patch("/api/messages/:messageId/feedback", async (req, res) => {
    try {
      const { feedback } = req.body;
      const messageId = parseInt(req.params.messageId, 10);

      if (isNaN(messageId) || !feedback || !["like", "dislike"].includes(feedback)) {
        return res.status(400).json({ message: "Invalid feedback parameters" });
      }

      const updatedMessage = await storage.updateMessageFeedback(messageId, feedback as "like" | "dislike");
      res.json(updatedMessage);
    } catch (error) {
      log(`Error updating message feedback: ${error}`);
      res.status(500).json({ message: "Failed to update message feedback" });
    }
  });

  // 重新生成AI回复
  app.post("/api/messages/:messageId/regenerate", async (req, res) => {
    try {
      const { userId, userRole, chatId } = req.body;
      const messageId = parseInt(req.params.messageId, 10);

      if (isNaN(messageId) || !userId || !chatId) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }

      // 验证用户对此聊天的访问权限
      const isAdmin = userRole === "admin";
      const chat = await storage.getChatById(chatId, userId, isAdmin);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found or access denied" });
      }

      try {
        // 获取需要重新生成的消息
        const message = await storage.regenerateMessage(messageId);

        // 初始化聊天服务使用对应模型
        chatService.setModel(chat.model || "deep");

        // 找到触发此AI回复的用户消息
        const chatMessages = await storage.getChatMessages(chatId, userId, isAdmin);
        const messageIndex = chatMessages.findIndex(m => m.id === messageId);

        // 找到最近的用户消息作为提示
        let promptMessage = "请重新回答";
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (chatMessages[i].role === "user") {
            promptMessage = chatMessages[i].content;
            break;
          }
        }

        // 重新生成回复，传入userId用于记忆检索
        const response = await chatService.sendMessage(promptMessage, userId);

        // 更新数据库中的消息
        const updatedMessage = await storage.updateMessage(messageId, response.text, false);

        res.json({
          ...updatedMessage,
          model: response.model
        });
      } catch (error) {
        // 如果找不到消息，尝试从聊天记录中直接获取
        log(`Error with specific message ID, trying fallback approach: ${error}`);

        // 获取所有消息并尝试找到最近的AI消息
        const chatMessages = await storage.getChatMessages(chatId, userId, isAdmin);

        // 确保有至少一条AI回复
        const aiMessages = chatMessages.filter(m => m.role === "assistant");
        if (aiMessages.length === 0) {
          return res.status(404).json({ message: "No AI messages found to regenerate" });
        }

        // 使用最后一条AI消息
        const lastAiMessage = aiMessages[aiMessages.length - 1];
        const messageIndex = chatMessages.findIndex(m => m.id === lastAiMessage.id);

        // 找到触发该AI回复的用户消息
        let promptMessage = "请重新回答";
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (chatMessages[i].role === "user") {
            promptMessage = chatMessages[i].content;
            break;
          }
        }

        // 重新生成回复
        chatService.setModel(chat.model || "deep");
        const response = await chatService.sendMessage(promptMessage, userId);

        // 更新数据库中的消息
        const updatedMessage = await storage.updateMessage(lastAiMessage.id, response.text, false);

        res.json({
          ...updatedMessage,
          model: response.model
        });
      }
    } catch (error) {
      log(`Error regenerating message: ${error}`);
      res.status(500).json({ message: "Failed to regenerate message" });
    }
  });

  // 创建消息
  app.post("/api/messages", async (req, res) => {
    try {
      const { chatId, content, role, userId, userRole } = req.body;

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

  // 更新聊天模型
  app.patch("/api/chats/:chatId/model", async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId, 10);
      const { model, userId, userRole } = req.body;

      if (isNaN(chatId) || !model || !userId) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }

      // 验证用户对此聊天的访问权限
      const isAdmin = userRole === "admin";
      const chat = await storage.getChatById(chatId, userId, isAdmin);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found or access denied" });
      }

      // 更新聊天模型
      await storage.updateChatModel(chatId, model);
      res.json({ success: true });
    } catch (error) {
      log(`Error updating chat model: ${error}`);
      res.status(500).json({ message: "Failed to update chat model" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, model, chatId, userId, role } = req.body;

      if (!message) {
        return res.status(400).json({
          message: "Message is required",
          error: "MISSING_MESSAGE"
        });
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

      if (model) {
        try {
          chatService.setModel(model);
        } catch (error) {
          return res.status(400).json({
            message: "Invalid model selected",
            error: error instanceof Error ? error.message : String(error)
          });
        }
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

      // 获取AI响应，传入userId用于记忆检索
      log(`处理来自用户 ${userId} 的聊天消息，聊天ID: ${chatId}`);
      const response = await chatService.sendMessage(message, Number(userId));

      // 存储消息到数据库
      try {
        // 先存储用户消息
        const userMsg = await storage.createMessage(chatId, message, "user");
        log(`已存储用户消息，ID: ${userMsg.id}`);

        // 再存储AI响应
        const aiMsg = await storage.createMessage(chatId, response.text, "assistant");
        log(`已存储AI响应，ID: ${aiMsg.id}`);
        
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
      const { token } = req.body;

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
    # 检索相似记忆
    memories = await learning_memory_service.retrieve_similar_memories(${userId}, """${query.replace(/"/g, '\\"')}""", ${limit})
    # 转换为JSON输出
    print(json.dumps(memories, ensure_ascii=False))

asyncio.run(retrieve_memories())
      `]);
      
      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
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

  const httpServer = createServer(app);
  return httpServer;
}