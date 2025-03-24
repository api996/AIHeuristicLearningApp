import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatService } from "./services/chat";
import { log } from "./vite";
import { Buffer } from "buffer";
import path from "path";
import fs from "fs";
import express from 'express';
import fetch from "node-fetch";

async function verifyTurnstileToken(token: string): Promise<boolean> {
  try {
    log(`开始验证Turnstile令牌...`);
    
    // 开发环境中的特殊处理
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // 在开发环境中的验证绕过逻辑
    if (isDevelopment) {
      // 如果没有设置密钥，或使用特定的测试令牌，默认通过验证
      if (!process.env.TURNSTILE_SECRET_KEY || token === 'DEV_BYPASS_TOKEN') {
        log(`开发环境: Turnstile验证已绕过`);
        return true;
      }
    }

    // 验证令牌格式 (生产环境中的完整验证)
    if (!token || typeof token !== 'string' || token.length < 10) {
      log(`无效的Turnstile令牌格式: ${token}`);
      return false;
    }

    // 发送验证请求
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    if (!response.ok) {
      log(`Turnstile API响应错误: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    log(`Turnstile验证结果: ${JSON.stringify(data)}`);
    
    if (!data.success) {
      log(`验证失败原因: ${data['error-codes']?.join(', ') || '未知'}`);
    }
    
    return data.success === true;
  } catch (error) {
    log(`Turnstile验证异常: ${error}`);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // User authentication routes
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, turnstileToken } = req.body;
      log(`Registering user: ${username}`);

      // Verify Turnstile token
      if (!await verifyTurnstileToken(turnstileToken)) {
        log(`人机验证失败: ${username}`);
        return res.status(400).json({
          success: false,
          message: "人机验证失败"
        });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        log(`用户名已存在: ${username}`);
        return res.status(400).json({ 
          success: false, 
          message: "用户名已存在" 
        });
      }

      // Create new user
      const user = await storage.createUser({ username, password });
      log(`User registered successfully: ${username}, ID: ${user.id}`);
      res.json({ success: true, userId: user.id });
    } catch (error) {
      log(`Registration error: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "注册失败，请稍后重试" 
      });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password, turnstileToken } = req.body;
      log(`Login attempt for user: ${username}`);

      // Verify Turnstile token
      if (!await verifyTurnstileToken(turnstileToken)) {
        log(`人机验证失败: ${username}`);
        return res.status(400).json({
          success: false,
          message: "人机验证失败"
        });
      }

      const user = await storage.getUserByUsername(username);
      log(`User lookup result: ${user ? 'found' : 'not found'}`);

      if (user && user.password === password) {
        log(`Login successful: ${username}, ID: ${user.id}, Role: ${user.role}`);
        res.json({ 
          success: true, 
          userId: user.id, 
          role: user.role 
        });
      } else {
        log(`Login failed: Invalid credentials for ${username}`);
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
      log(`获取聊天记录请求: userId=${userId}, role=${role}`);
      
      // 更详细的用户ID验证
      if (!userId) {
        log(`Missing userId in request: ${JSON.stringify(req.query)}`);
        return res.status(401).json({ message: "User ID is required" });
      }
      
      const parsedUserId = Number(userId);
      if (isNaN(parsedUserId) || parsedUserId <= 0) {
        log(`无效的userId格式: ${userId}`);
        return res.status(401).json({ message: "Invalid user ID format" });
      }
      
      const isAdmin = role === "admin";
      log(`用户角色: ${isAdmin ? 'admin' : 'user'}, ID: ${parsedUserId}`);
      
      // 如果是管理员，则获取请求中指定的用户的聊天记录
      // 如果是普通用户，则获取自己的聊天记录
      const targetUserId = parsedUserId;
      const chats = await storage.getUserChats(targetUserId, isAdmin);
      log(`成功获取聊天记录: ${chats.length} 条记录`);
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
      log("Chat error:", error);
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

  const httpServer = createServer(app);
  return httpServer;
}