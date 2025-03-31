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

// 设备信息接口
interface DeviceInfo {
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  deviceType: string;
  isIOS: boolean;
  isAndroid: boolean;
  iphoneModel?: string;
  timestamp: number;
}

// 储存设备信息的映射表
const deviceInfoMap = new Map<string, DeviceInfo>();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // 设备信息API
  app.post("/api/device-info", (req, res) => {
    try {
      const { userAgent, screenWidth, screenHeight, deviceType, isIOS, isAndroid, iphoneModel, userId } = req.body;
      
      if (!userAgent) {
        return res.status(400).json({
          success: false,
          message: "用户代理信息缺失"
        });
      }
      
      // 创建设备信息对象
      const deviceInfo: DeviceInfo = {
        userAgent,
        screenWidth: screenWidth || 0,
        screenHeight: screenHeight || 0,
        deviceType: deviceType || "unknown",
        isIOS: isIOS || false,
        isAndroid: isAndroid || false,
        iphoneModel: iphoneModel,
        timestamp: Date.now()
      };
      
      // 使用用户ID或用户代理作为键
      const key = userId ? `user-${userId}` : `ua-${userAgent.slice(0, 50)}`;
      deviceInfoMap.set(key, deviceInfo);
      
      log(`设备信息已记录 [${deviceType}]: ${screenWidth}x${screenHeight}, iOS: ${isIOS}, iPhone型号: ${iphoneModel || 'N/A'}`);
      
      return res.status(200).json({
        success: true,
        message: "设备信息已记录",
        deviceCount: deviceInfoMap.size
      });
    } catch (error) {
      console.error("记录设备信息失败:", error);
      return res.status(500).json({
        success: false,
        message: "服务器错误"
      });
    }
  });
  
  // 获取设备信息API
  app.get("/api/device-info", (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "缺少用户标识"
        });
      }
      
      const key = `user-${userId}`;
      const deviceInfo = deviceInfoMap.get(key);
      
      if (!deviceInfo) {
        return res.status(404).json({
          success: false,
          message: "未找到设备信息"
        });
      }
      
      return res.status(200).json({
        success: true,
        deviceInfo
      });
    } catch (error) {
      console.error("获取设备信息失败:", error);
      return res.status(500).json({
        success: false,
        message: "服务器错误"
      });
    }
  });
  
  // 获取所有设备信息API (仅管理员)
  app.get("/api/device-info/all", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const role = req.query.role as string;
      
      // 检查是否是管理员
      if (!userId || role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "权限不足"
        });
      }
      
      const user = await storage.getUser(parseInt(userId));
      if (!user || user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "无权访问"
        });
      }
      
      // 将Map转换为数组
      const allDevices = Array.from(deviceInfoMap.entries()).map(([key, info]) => ({
        id: key,
        ...info
      }));
      
      return res.status(200).json({
        success: true,
        devices: allDevices,
        count: allDevices.length
      });
    } catch (error) {
      console.error("获取所有设备信息失败:", error);
      return res.status(500).json({
        success: false,
        message: "服务器错误"
      });
    }
  });
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
      const { userId, role } = req.query;
      if (!userId || isNaN(Number(userId))) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      
      const targetUserId = Number(userId);
      
      // 获取用户的所有聊天记录及其消息
      const chats = await storage.getUserChats(targetUserId, role === "admin");
      
      if (!chats || chats.length === 0) {
        return res.json({
          topics: [],
          progress: [],
          suggestions: []
        });
      }
      
      // 收集所有聊天消息内容
      const allMessages: string[] = [];
      for (const chat of chats) {
        const messages = await storage.getChatMessages(chat.id, targetUserId, role === "admin");
        // 只将用户发送的消息添加到分析中
        const userMessages = messages.filter(msg => msg.role === "user").map(msg => msg.content);
        allMessages.push(...userMessages);
      }
      
      // 提取关键主题
      // 简单实现：基于一些关键词匹配的主题提取
      const topicKeywords: Record<string, string[]> = {
        "人工智能": ["ai", "人工智能", "机器学习", "深度学习", "神经网络", "nlp", "自然语言处理"],
        "编程开发": ["编程", "开发", "代码", "程序", "软件", "工程", "前端", "后端", "全栈"],
        "数据科学": ["数据", "分析", "统计", "可视化", "大数据", "数据挖掘", "数据清洗"],
        "计算机科学": ["算法", "数据结构", "计算机", "操作系统", "网络", "安全", "计算理论"],
        "网络技术": ["网络", "http", "tcp", "ip", "协议", "互联网", "路由", "服务器"],
        "数学": ["数学", "微积分", "线性代数", "概率", "统计", "离散数学", "逻辑"]
      };
      
      // 计算主题出现次数
      const topicCounts: Record<string, number> = {};
      for (const message of allMessages) {
        for (const [topic, keywords] of Object.entries(topicKeywords)) {
          const messageLower = message.toLowerCase();
          for (const keyword of keywords) {
            if (messageLower.includes(keyword.toLowerCase())) {
              topicCounts[topic] = (topicCounts[topic] || 0) + 1;
              break; // 一条消息只计算一个关键词对应的主题
            }
          }
        }
      }
      
      // 排序并选择前3个主题
      const topics = Object.entries(topicCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 3)
        .map(([topic]) => topic);
      
      // 随机生成学习进度 (在实际应用中，这应该基于对话内容深度分析)
      const progress = topics.map(topic => ({
        topic,
        percentage: Math.floor(Math.random() * 60) + 20 // 20% 到 80%
      }));
      
      // 生成学习建议
      const suggestions = [
        "深入学习更多关于" + (topics[0] || "相关主题") + "的实际应用场景",
        "尝试实践一些小型项目，巩固理论知识",
        "探索更多关于" + (topics[1] || "感兴趣领域") + "的高级话题"
      ];
      
      res.json({
        topics,
        progress,
        suggestions
      });
    } catch (error) {
      log(`Error analyzing learning path: ${error}`);
      res.status(500).json({ message: "无法分析学习轨迹" });
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
        
        // 重新生成回复
        const response = await chatService.sendMessage(promptMessage);
        
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
        const response = await chatService.sendMessage(promptMessage);
        
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

      // 获取AI响应
      log(`处理来自用户 ${userId} 的聊天消息，聊天ID: ${chatId}`);
      const response = await chatService.sendMessage(message);
      
      // 存储消息到数据库
      try {
        // 先存储用户消息
        const userMsg = await storage.createMessage(chatId, message, "user");
        log(`已存储用户消息，ID: ${userMsg.id}`);
        
        // 再存储AI响应
        const aiMsg = await storage.createMessage(chatId, response.text, "assistant");
        log(`已存储AI响应，ID: ${aiMsg.id}`);
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

  const httpServer = createServer(app);
  return httpServer;
}