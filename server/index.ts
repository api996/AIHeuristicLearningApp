import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn, exec } from "child_process";
import path from "path";
import fs from "fs";
import { vectorEmbeddingManager } from "./services/vector_embedding_manager";
import { initializeObjectStorage } from "./services/object-storage.service";
import { initializeStorage } from "./services/hybrid-storage.service";
import { contentValueAnalyzer } from "./services/content-value-analyzer";
import { optimizedEmbeddingsService } from "./services/learning/optimized-embeddings";
import pgSession from "connect-pg-simple";
import { pool } from "./db";

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

// 添加cookie解析中间件以支持cookie-based认证
app.use(cookieParser(process.env.SESSION_SECRET || 'ai-learning-companion-secret-2025'));

// 创建PostgreSQL会话存储
const PgStore = pgSession(session);

// 添加会话支持，始终使用PostgreSQL存储会话数据（生产和开发环境）
app.use(session({
  store: new PgStore({
    pool,
    tableName: 'session', // 与之前创建的表名匹配
    createTableIfMissing: true,
    // 增加会话清理间隔，减少服务器负担
    pruneSessionInterval: 24 * 60 * 60 // 每24小时清理一次
  }),
  secret: process.env.SESSION_SECRET || 'ai-learning-companion-secret-2025',
  resave: false,
  saveUninitialized: true, // 需要设置为true以支持未登录用户的会话
  cookie: { 
    // 在开发环境中禁用secure以确保cookie正常工作
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 增加到7天，提高会话持久性
    sameSite: 'lax', // 兼容现代浏览器的cookie策略
    httpOnly: true, // 防止客户端JavaScript访问cookie
    path: '/' // 确保所有路径都可以访问cookie
  },
  // 添加名称使会话更容易识别，调试时也更方便
  name: 'xai.sid'
}));

// 使用全局global.d.ts中声明的会话类型

// 添加会话调试中间件（仅在开发环境）
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const views = (req.session as any).views as number | undefined;
    const isNewSession = !views;
    
    // 记录会话信息
    (req.session as any).views = (views || 0) + 1;
    
    // 只在API请求时记录会话信息，避免静态资源请求导致的日志刷屏
    if (req.path.startsWith('/api/')) {
      // 仅记录用户相关的活动
      if (req.session.userId) {
        log(`会话活动: 用户=${req.session.userId}, 会话=${req.sessionID.substring(0, 6)}..., 视图=${(req.session as any).views}`);
      } else if (isNewSession) {
        // 只有新会话的首次API请求才记录
        log(`创建新会话: ${req.sessionID.substring(0, 6)}...`);
      }
    }
    
    next();
  });
}

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
    // 已迁移到数据库，跳过文件系统记忆检查
    // runMemoryCleanup();
    log("记忆系统已迁移到数据库，跳过文件系统检查");
    
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
    
    // 初始化内容价值评估和优化嵌入服务
    // 设置内容评估阈值 (0.0-1.0)，值越高过滤越严格
    const CONTENT_VALUE_THRESHOLD = 
      process.env.CONTENT_VALUE_THRESHOLD ? 
      parseFloat(process.env.CONTENT_VALUE_THRESHOLD) : 0.2; // 降低阈值，更容易接受内容差异
    
    if (CONTENT_VALUE_THRESHOLD >= 0 && CONTENT_VALUE_THRESHOLD <= 1) {
      contentValueAnalyzer.setValueThreshold(CONTENT_VALUE_THRESHOLD);
      optimizedEmbeddingsService.setValueThreshold(CONTENT_VALUE_THRESHOLD);
      log(`内容价值评估服务初始化完成，价值阈值: ${CONTENT_VALUE_THRESHOLD}`);
    } else {
      log(`内容价值阈值设置无效: ${CONTENT_VALUE_THRESHOLD}，使用默认值0.2`);
    }
    
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

    // 启动向量嵌入生成定时任务
    vectorEmbeddingManager.startScheduler();

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
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

    server.listen({
      port: port,
      host: "0.0.0.0",
    }, () => {
      log(`Server is now listening on port ${port}`);
    }).on('error', (err: any) => {
      log(`Failed to start server: ${err.message}`);
      throw err;
    });
  } catch (error) {
    log(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
})();