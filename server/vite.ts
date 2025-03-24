import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // 打印环境变量用于调试
  log("Vite环境变量检查:");
  log(`TURNSTILE_SITE_KEY: ${process.env.TURNSTILE_SITE_KEY ? "已设置" : "未设置"}`);
  log(`VITE_TURNSTILE_SITE_KEY: ${process.env.VITE_TURNSTILE_SITE_KEY ? "已设置" : "未设置"}`);

  // 确保VITE_前缀的环境变量可用
  if (process.env.TURNSTILE_SITE_KEY && !process.env.VITE_TURNSTILE_SITE_KEY) {
    process.env.VITE_TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY;
    log("已从TURNSTILE_SITE_KEY复制值到VITE_TURNSTILE_SITE_KEY");
  }

  const serverOptions = {
    middlewareMode: true,
    hmr: { server, overlay: true },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
    // 直接定义环境变量
    define: {
      'import.meta.env.VITE_TURNSTILE_SITE_KEY':
        JSON.stringify(process.env.VITE_TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITE_KEY || '')
    }
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}