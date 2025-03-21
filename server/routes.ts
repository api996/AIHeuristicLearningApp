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
      // For now, keep the simple admin check
      if (username === "admin" && password === "admin") {
        // Create or get user first
        const user = await storage.getUserByUsername(username) ||
          await storage.createUser({ username, password });
        res.json({ success: true, userId: user.id });
      } else {
        const user = await storage.getUserByUsername(username);
        if (user && user.password === password) {
          res.json({ success: true, userId: user.id });
        } else {
          res.status(401).json({ 
            success: false, 
            message: "用户名或密码错误" 
          });
        }
      }
    } catch (error) {
      log(`Login error: ${error}`);
      res.status(500).json({ 
        success: false, 
        message: "登录失败，请稍后重试" 
      });
    }
  });

  // Chat history routes
  app.get("/api/chats", async (req, res) => {
    try {
      // Get admin user
      const admin = await storage.getUserByUsername("admin");
      if (!admin) {
        return res.status(401).json({ message: "Please login first" });
      }
      const chats = await storage.getUserChats(admin.id);
      res.json(chats);
    } catch (error) {
      log(`Error fetching chats: ${error}`);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  app.post("/api/chats", async (req, res) => {
    try {
      // Get admin user
      const admin = await storage.getUserByUsername("admin");
      if (!admin) {
        return res.status(401).json({ message: "Please login first" });
      }
      const { title, model } = req.body;
      const chat = await storage.createChat(admin.id, title || "新对话", model || "default");
      res.json(chat);
    } catch (error) {
      log(`Error creating chat: ${error}`);
      res.status(500).json({ message: "Failed to create new chat" });
    }
  });

  app.delete("/api/chats/:chatId", async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      await storage.deleteChat(chatId);
      res.json({ success: true });
    } catch (error) {
      log(`Error deleting chat: ${error}`);
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });

  app.get("/api/chats/:chatId/messages", async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const messages = await storage.getChatMessages(chatId);
      res.json(messages);
    } catch (error) {
      log(`Error fetching messages: ${error}`);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // Chat message route
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, model, chatId } = req.body;

      if (!message) {
        return res.status(400).json({
          message: "Message is required",
          error: "MISSING_MESSAGE"
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

  const httpServer = createServer(app);
  return httpServer;
}