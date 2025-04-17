import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { initializeObjectStorage } from "./services/object-storage.service";
import { initializeStorage } from "./services/hybrid-storage.service";

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

// 添加健康检查路由
app.get('/', (req, res) => {
  res.status(200).send('Health check OK');
});
app.get('/health', (req, res) => {
  res.status(200).send('Health check OK');
});

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
    
    // 初始化对象存储服务
    let useObjectStorage = false;
    
    // 临时禁用对象存储，目前Replit环境无法连接到存储API
    const USE_OBJECT_STORAGE_FORCE = process.env.USE_OBJECT_STORAGE_FORCE === 'true';
    
    if (USE_OBJECT_STORAGE_FORCE) {
      // 仅当环境变量明确启用时才尝试使用对象存储
      try {
        await initializeObjectStorage();
        log("对象存储服务初始化成功");
        useObjectStorage = true;
      } catch (error) {
        log(`对象存储服务初始化失败: ${error instanceof Error ? error.message : String(error)}`);
        log("将继续使用文件系统存储");
        useObjectStorage = false;
      }
    } else {
      log("对象存储已禁用，使用文件系统存储 (要启用对象存储，请设置环境变量 USE_OBJECT_STORAGE_FORCE=true)");
    }
    
    // 初始化混合存储服务
    initializeStorage(useObjectStorage);
    log(`已初始化混合存储服务，模式: ${useObjectStorage ? '对象存储' : '文件系统'}`);
    
    // 是否执行自动迁移
    const AUTO_MIGRATE = process.env.AUTO_MIGRATE_FILES === 'true' && useObjectStorage;
    
    // 如果配置了自动迁移，且对象存储可用，则执行迁移
    if (AUTO_MIGRATE && useObjectStorage) {
      try {
        log("开始自动迁移文件到对象存储...");
        // 异步执行迁移，不阻塞服务器启动
        import('./services/hybrid-storage.service').then(async ({migrateToObjectStorage}) => {
          const result = await migrateToObjectStorage();
          log(`文件自动迁移完成: 总共${result.total}个文件，成功${result.success}个，失败${result.failed}个，涉及${result.users}个用户`);
        }).catch(error => {
          log(`文件自动迁移失败: ${error instanceof Error ? error.message : String(error)}`);
        });
      } catch (error) {
        log(`启动自动迁移失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

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

    // 使用环境变量PORT（适用于部署）或默认端口5000（适用于开发）
    const startPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
    let port = startPort;

    const startServer = (portToUse: number) => {
      server.listen({
        port: portToUse,
        host: "0.0.0.0",
        reusePort: true,
      }, () => {
        log(`Server is now listening on http://0.0.0.0:${portToUse}`);
        log(`健康检查URL: http://localhost:${portToUse}/`);
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE' && !process.env.PORT) {
          // 仅在开发环境中尝试其他端口（不是在部署环境）
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