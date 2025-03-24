import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatService } from "./services/chat";
import { log } from "./vite";
import { Buffer } from "buffer";
import path from "path";
import fs from "fs";
import express from 'express';

export async function registerRoutes(app: Express): Promise<Server> {
  // User authentication routes
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: "用户名已存在" 
        });
      }

      // Create new user
      const user = await storage.createUser({ username, password });
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
      const { username, password } = req.body;

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
        // 确保发送正确的角色信息
        console.log(`用户 ${username} 登录成功，角色: ${user.role}`);
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

  // Chat history routes
  app.get("/api/chats", async (req, res) => {
    try {
      const { userId, role } = req.query;
      if (!userId || isNaN(Number(userId))) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const isAdmin = role === "admin";
      const chats = await storage.getUserChats(Number(userId), isAdmin);
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
      console.log(`Fetching messages for chat ${chatId}, user ${userId}, isAdmin: ${isAdmin}`);

      const messages = await storage.getChatMessages(chatId, Number(userId), isAdmin);
      console.log(`Found ${messages.length} messages for chat ${chatId}`);

      if (!messages || messages.length === 0) {
        log(`No messages found for chat ${chatId}, this might be a new chat`);
      }

      res.json(messages || []);
    } catch (error) {
      log(`Error fetching messages: ${error}`);
      res.status(500).json({ message: "Failed to fetch chat messages", error: String(error) });
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
  
  // 修改对话标题的路由
  app.put("/api/chats/:chatId/title", async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const { userId, role } = req.query;
      const { title } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "请先登录" });
      }
      
      if (!title || title.trim() === "") {
        return res.status(400).json({ 
          success: false, 
          message: "标题不能为空" 
        });
      }
      
      const isAdmin = role === "admin";
      const chat = await storage.getChatById(chatId, Number(userId), isAdmin);
      
      if (!chat) {
        return res.status(403).json({ 
          success: false, 
          message: "无权访问该对话或对话不存在" 
        });
      }
      
      await storage.updateChatTitle(chatId, title);
      res.json({ success: true });
    } catch (error) {
      log(`Error updating chat title: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "更新标题失败，请稍后重试" 
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

  // User statistics endpoint
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
        users.map(async (user) => {
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


  const httpServer = createServer(app);
  return httpServer;
}