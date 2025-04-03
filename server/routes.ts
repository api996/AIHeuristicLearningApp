
import express from "express";
import { Server } from "http";
import { log } from "./vite";

// 导出 registerRoutes 函数供 index.ts 使用
export async function registerRoutes(app: express.Express): Promise<Server> {
  // 创建 HTTP 服务器
  const server = new Server(app);
  
  // 设置API路由
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // 这里可以添加更多的路由
  
  return server;
}
