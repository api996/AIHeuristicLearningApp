import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatService } from "./services/chat";

export async function registerRoutes(app: Express): Promise<Server> {
  // User authentication routes
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin") {
      // For demo, we'll create a user if it doesn't exist
      let user = await storage.getUserByUsername("admin");
      if (!user) {
        user = await storage.createUser({
          username: "admin",
          password: "admin"
        });
      }
      res.json({ success: true, userId: user.id });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // Chat routes
  app.post("/api/chats", async (req, res) => {
    try {
      const { userId, title, model } = req.body;
      const chat = await storage.createChat({
        userId,
        title,
        model,
        createdAt: new Date()
      });
      res.json(chat);
    } catch (error) {
      console.error("Failed to create chat:", error);
      res.status(500).json({ message: "Failed to create chat" });
    }
  });

  app.get("/api/chats/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const chats = await storage.getChats(Number(userId));
      res.json(chats);
    } catch (error) {
      console.error("Failed to get chats:", error);
      res.status(500).json({ message: "Failed to get chats" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, chatId } = req.body;

      // Save user message
      await storage.createMessage({
        chatId,
        content: message,
        role: "user",
        createdAt: new Date()
      });

      // Get AI response
      const response = await chatService.sendMessage(message);

      // Save AI message
      await storage.createMessage({
        chatId,
        content: response.answer || "抱歉，我现在无法回答这个问题。",
        role: "assistant",
        createdAt: new Date()
      });

      res.json({ message: response.answer });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  app.get("/api/messages/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      const messages = await storage.getMessages(Number(chatId));
      res.json(messages);
    } catch (error) {
      console.error("Failed to get messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}