#!/bin/bash

# 终极修复脚本 - 专注于修复静态资源路径问题
# 优化：避免重复步骤，直接修改关键文件

# 设置环境变量
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"

echo "========================================================"
echo "最终修复脚本 - 专注于静态文件路径问题"
echo "========================================================"

# 清理旧构建文件
echo "清理旧的构建文件..."
rm -rf dist

# 安装依赖
echo "安装依赖..."
npm ci

# 构建前端
echo "构建前端..."
NODE_ENV=production npx vite build

# 关键修复：修改vite.ts中的静态资源路径解析
echo "修改server/vite.ts中的静态资源路径解析..."
cat > server/vite.fixed.ts << 'EOF'
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
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
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
  // 修复: 在多个位置寻找静态资源
  let distPath;
  
  // 检查多个可能的路径
  const possiblePaths = [
    path.resolve(process.cwd(), "dist"),           // dist根目录
    path.resolve(process.cwd(), "dist/public"),    // dist/public
    path.resolve(__dirname, "../dist"),            // 相对于server的dist目录
    path.resolve(__dirname, "public")              // server/public
  ];
  
  // 查找包含index.html的第一个路径
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      log(`找到静态资源目录: ${distPath}`);
      break;
    }
  }
  
  // 如果找不到任何有效路径，使用默认路径
  if (!distPath) {
    distPath = path.resolve(process.cwd(), "dist");
    log(`警告: 未找到有效的静态资源目录，将使用默认路径: ${distPath}`);
  }

  log(`提供静态文件的目录: ${distPath}`);
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
EOF

echo "✅ 创建了修改版本的vite.ts"

# 确保关键目录存在
echo "创建必要的目录..."
mkdir -p dist/public
mkdir -p server/public

# 复制前端资源
echo "复制前端资源..."
cp -r dist/assets dist/public/ 2>/dev/null || echo "⚠️ 复制assets到dist/public失败"
cp -r dist/index.html dist/public/ 2>/dev/null || echo "⚠️ 复制index.html到dist/public失败"

# 构建后端
echo "构建后端..."
npx esbuild server/index.ts server/vite.fixed.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node20 \
  --outdir=dist \
  --external:vite.config.ts \
  --external:express \
  --external:pg \
  --external:drizzle-orm \
  --external:ws \
  --external:*.css \
  --external:*.scss \
  --packages=external

# 修补生成的代码以使用修改版vite模块
echo "修补生成的代码..."
if [ -f "dist/index.js" ] && [ -f "dist/vite.fixed.js" ]; then
  # 替换导入语句
  sed -i 's/from "\.\/vite\.js"/from "\.\/vite\.fixed\.js"/g' dist/index.js
  echo "✅ 成功修补index.js中的导入语句"
else
  echo "❌ 找不到要修补的文件"
fi

# 创建启动脚本
echo "创建智能启动脚本..."
cat > dist/start.js << 'EOF'
// 智能启动脚本
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// 显示环境信息
console.log('=======================================================');
console.log('启动生产服务器');
console.log('=======================================================');
console.log(`Node.js版本: ${process.version}`);
console.log(`工作目录: ${process.cwd()}`);
console.log(`__dirname: ${__dirname}`);

// 确保静态资源目录存在
const publicDir = join(__dirname, 'public');
if (!existsSync(publicDir)) {
  console.log(`创建public目录: ${publicDir}`);
  mkdirSync(publicDir, { recursive: true });
}

// 确保index.html存在于public目录
if (!existsSync(join(publicDir, 'index.html')) && existsSync(join(__dirname, 'index.html'))) {
  console.log('复制index.html到public目录');
  copyFileSync(join(__dirname, 'index.html'), join(publicDir, 'index.html'));
}

// 尝试启动服务器
const indexPath = join(__dirname, 'index.js');
if (existsSync(indexPath)) {
  console.log('使用编译后的文件启动...');
  
  try {
    // 尝试导入编译后的文件
    import('./index.js').catch(err => {
      console.error('导入编译文件失败:', err);
      fallbackToTsx();
    });
  } catch (err) {
    console.error('加载编译文件失败:', err);
    fallbackToTsx();
  }
} else {
  console.log('找不到编译后的文件，切换到备用方法...');
  fallbackToTsx();
}

// 备用启动方法
function fallbackToTsx() {
  console.log('使用tsx直接运行TypeScript源文件...');
  
  const serverProcess = spawn('npx', ['tsx', join(rootDir, 'server/index.ts')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  // 处理进程退出
  serverProcess.on('exit', (code) => {
    console.log(`服务进程退出，退出码: ${code || 0}`);
    process.exit(code || 0);
  });
  
  // 处理信号
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      console.log(`收到${signal}信号，关闭服务...`);
      serverProcess.kill(signal);
    });
  });
}
EOF

# 使脚本可执行
chmod +x dist/start.js

echo "✅ 最终修复已完成!"
echo ""
echo "请在Replit部署中使用以下命令:"
echo "  - 构建命令: bash final-fix.sh"
echo "  - 运行命令: NODE_ENV=production node dist/start.js"