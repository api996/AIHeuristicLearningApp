import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { env } from "./env"; // Assuming this is where environment variables are accessed
import { setupVite } from "./vite";
import { chatService } from "./services/chat";
import { log } from "./vite";

// 明确设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
log(`当前运行环境: ${process.env.NODE_ENV}`);

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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

    // Try to find an available port starting with 5000
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