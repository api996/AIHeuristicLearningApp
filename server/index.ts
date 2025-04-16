import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// 自动修复记忆文件
const runMemoryCleanup = (userId?: number) => {
  try {
    const scriptPath = path.join(process.cwd(), "scripts", "memory_cleanup.py");

    // 检查脚本是否存在
    if (fs.existsSync(scriptPath)) {
      // 构建命令行参数，如果提供了用户ID，则只处理该用户的记忆文件
      const args = [scriptPath];
      if (userId !== undefined) {
        args.push('--user-id', userId.toString());
        log(`正在执行记忆文件修复脚本，仅处理用户ID: ${userId}...`);
      } else {
        log("正在执行记忆文件修复脚本（所有用户）...");
      }

      const cleanupProcess = spawn("python3", args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let errorOutput = '';

      cleanupProcess.stdout.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          log(`[记忆系统] ${output}`);
        }
      });

      cleanupProcess.stderr.on("data", (data) => {
        const errorMsg = data.toString().trim();
        errorOutput += errorMsg;
        // 仅输出非空错误信息
        if (errorMsg) {
          log(`[记忆系统错误] ${errorMsg}`);
        }
      });

      cleanupProcess.on("close", (code) => {
        if (code === 0) {
          const userMsg = userId !== undefined ? `用户${userId}的` : '所有用户的';
          log(`记忆文件修复脚本执行成功，${userMsg}记忆文件已处理，退出码: ${code}`);
        } else {
          log(`记忆文件修复脚本执行失败，退出码: ${code}`);
          if (errorOutput) {
            log(`错误详情: ${errorOutput}`);
          }
        }
      });
    } else {
      log("未找到记忆文件修复脚本，跳过修复步骤");
    }
  } catch (error) {
    log(`执行记忆文件修复脚本时出错: ${error}`);
  }
};

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 添加会话支持
app.use(session({
  secret: 'ai-learning-companion-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  log("Starting server...");

  try {
    // 先运行记忆文件修复，但不指定用户ID，只是进行初始检查
    runMemoryCleanup();

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      log(`Error encountered: ${err.message}`);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    if (app.get("env") === "development") {
      log("Setting up Vite for development...");
      await setupVite(app, server);
    } else {
      log("Setting up static serving for production...");
      serveStatic(app);
    }

    // 使用端口5000以确保与工作流兼容
    const startPort = 5000;
    let port = startPort;

    const startServer = (portToUse: number) => {
      server.listen({
        port: portToUse,
        host: "0.0.0.0",
        reusePort: true,
      }, () => {
        log(`Server is now listening on port ${portToUse}`);
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${portToUse} is in use, trying another port...`);
          port++;
          startServer(port);
        } else {
          log(`Failed to start server: ${err.message}`);
          throw err;
        }
      });
    };

    startServer(port);
  } catch (error) {
    log(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
})();