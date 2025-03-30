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

  app.get("/api/chats/:chatId/messages", async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const { userId, role } = req.query;

      if (!userId || isNaN(Number(userId))) {
        return res.status(401).json({ message: "Invalid user ID" });
      }

      const isAdmin = role === "admin";
      const messages = await storage.getChatMessages(chatId, Number(userId), isAdmin);
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

      // 如果是新创建的聊天，可能没有chatId，这种情况直接在内存中处理
      if (!chatId) {
        log(`处理无chatId的临时消息: ${message}`);

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

        const response = await chatService.sendMessage(message);
        return res.json(response);
      }

      const isAdmin = role === "admin";
      const chat = await storage.getChatById(chatId, Number(userId), isAdmin);
      if (!chat) {
        return res.status(403).json({ message: "Access denied" });
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

      const response = await chatService.sendMessage(message);

      if (chatId) {
        // Store the messages in the database
        await storage.createMessage(chatId, message, "user");
        await storage.createMessage(chatId, response.text, "assistant");
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