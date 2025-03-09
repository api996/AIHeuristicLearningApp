import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatService } from "./services/chat";

export async function registerRoutes(app: Express): Promise<Server> {
  // User authentication routes
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin") {
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // Chat routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, model } = req.body;

      if (model) {
        chatService.setModel(model);
      }

      const response = await chatService.sendMessage(message);
      res.json(response);
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ 
        message: "Failed to process chat message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}