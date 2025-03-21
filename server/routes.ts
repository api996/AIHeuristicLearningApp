import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatService } from "./services/chat";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  // User authentication routes
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin") {
      const user = await storage.getUserByUsername(username) || 
        await storage.createUser({ username, password });
      res.json({ success: true, userId: user.id });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // Chat history routes
  app.get("/api/chats", async (req, res) => {
    try {
      const userId = 1; // For now using fixed userId=1 for admin
      const chats = await storage.getUserChats(userId);
      res.json(chats);
    } catch (error) {
      log(`Error fetching chats: ${error}`);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  app.post("/api/chats", async (req, res) => {
    try {
      const userId = 1; // For now using fixed userId=1 for admin
      const { title, model } = req.body;
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

  const httpServer = createServer(app);
  return httpServer;
}