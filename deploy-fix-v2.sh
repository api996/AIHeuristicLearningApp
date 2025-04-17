#!/bin/bash

# 修订版精准修复脚本 - 针对前端资源加载问题
# 更全面的修复，确保Vite正确打包和部署前端资源

# 显示环境信息
echo "========================================================"
echo "修订版部署脚本 V2"
echo "========================================================"
echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"
echo "工作目录: $(pwd)"

# 确保安装了esbuild
echo "确保安装必要的构建工具..."
npm install --no-save esbuild

# 清理旧的构建文件
echo "清理旧构建文件..."
rm -rf dist
mkdir -p dist

# 检查package.json是否包含构建命令
echo "检查package.json的构建配置..."
if grep -q "\"build\":" package.json; then
  echo "找到构建命令，使用npm run build"
  npm run build
else
  echo "未找到构建命令，使用vite构建"
  NODE_ENV=production npx vite build
fi

# 验证构建是否成功
if [ ! -d "dist/assets" ]; then
  echo "⚠️ 警告: 构建后没有找到assets目录，检查dist目录内容:"
  ls -la dist/
else
  echo "✓ 构建成功，assets目录存在"
  ls -la dist/assets/ | head -n 10
fi

# 检查index.html是否正确生成
if [ ! -f "dist/index.html" ]; then
  echo "⚠️ 警告: 构建后没有找到index.html，检查是否有其他输出目录"
  find . -name "index.html" -not -path "./node_modules/*" -not -path "./client/*"
else
  echo "✓ index.html已正确生成"
  # 检查index.html中的资源引用
  echo "检查index.html中的资源引用:"
  grep -E "src=\"|href=\"" dist/index.html
fi

# 创建并应用完整的vite.ts修补程序
echo "创建vite.ts完整修补程序..."
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
  // 智能检测前端资源路径
  const possiblePaths = [
    path.resolve(process.cwd(), "dist"),           // 项目根目录/dist
    path.resolve(process.cwd(), "dist/public"),    // 项目根目录/dist/public
    path.resolve(__dirname, "../dist"),            // 相对于当前目录的上级/dist
    path.resolve(__dirname, "public")              // 当前目录/public
  ];
  
  // 调试信息
  console.log(`当前目录: ${__dirname}`);
  console.log(`工作目录: ${process.cwd()}`);
  
  let distPath = null;
  console.log("检查可能的静态资源目录:");
  
  // 先检查哪些路径存在
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`- ${p} (存在)`);
      
      // 检查是否包含关键文件
      const hasIndexHtml = fs.existsSync(path.join(p, "index.html"));
      const hasAssets = fs.existsSync(path.join(p, "assets"));
      
      console.log(`  - index.html: ${hasIndexHtml ? '✓' : '✗'}`);
      console.log(`  - assets目录: ${hasAssets ? '✓' : '✗'}`);
      
      // 如果同时包含index.html和assets目录，优先使用
      if (hasIndexHtml && hasAssets) {
        distPath = p;
        console.log(`  => 选择该目录作为静态资源目录`);
        break;
      }
      // 否则，如果只包含index.html，也是可用的
      else if (hasIndexHtml && !distPath) {
        distPath = p;
        console.log(`  => 暂时选择该目录(只有index.html)`);
      }
    } else {
      console.log(`- ${p} (不存在)`);
    }
  }
  
  // 如果找不到任何有效路径，使用默认值
  if (!distPath) {
    distPath = path.resolve(process.cwd(), "dist");
    console.log(`警告: 未找到有效的静态资源目录，将使用默认路径: ${distPath}`);
    
    // 确保目录存在
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
    }
  }

  // 确保dist目录至少有基本的index.html
  if (!fs.existsSync(path.join(distPath, "index.html"))) {
    console.log(`警告: 在${distPath}中未找到index.html，创建一个临时页面`);
    
    // 创建一个更完整的临时HTML，确保有一个可预期的标题和基本样式
    fs.writeFileSync(path.join(distPath, "index.html"), `
<!DOCTYPE html>
<html lang="zh">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
    <title>AI学习伙伴 - 服务器已启动</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
      :root {
        --primary: #3b82f6;
        --primary-foreground: #ffffff;
        --background: #ffffff;
        --foreground: #020617;
        --card: #ffffff;
        --card-foreground: #020617;
        --popover: #ffffff;
        --popover-foreground: #020617;
        --secondary: #f1f5f9;
        --secondary-foreground: #0f172a;
        --muted: #f1f5f9;
        --muted-foreground: #64748b;
        --accent: #f1f5f9;
        --accent-foreground: #0f172a;
        --destructive: #ef4444;
        --destructive-foreground: #ffffff;
        --border: #e2e8f0;
        --input: #e2e8f0;
        --ring: #3b82f6;
        --radius: 0.5rem;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background: var(--background);
        color: var(--foreground);
        line-height: 1.5;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem 1rem;
      }
      header {
        margin-bottom: 2rem;
        text-align: center;
      }
      h1 {
        font-size: 2rem;
        color: var(--primary);
        margin-bottom: 0.5rem;
      }
      .card {
        background: var(--card);
        border-radius: var(--radius);
        box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      }
      .card h2 {
        font-size: 1.25rem;
        color: var(--card-foreground);
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .card h2 i {
        color: var(--primary);
      }
      ul {
        list-style: none;
        margin-left: 1rem;
      }
      li {
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      li i {
        color: var(--primary);
        width: 20px;
        text-align: center;
      }
      a {
        color: var(--primary);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .success {
        color: #10b981;
      }
      .warning {
        color: #f59e0b;
      }
      .error {
        color: var(--destructive);
      }
      .footer {
        text-align: center;
        color: var(--muted-foreground);
        margin-top: 3rem;
        font-size: 0.875rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>AI学习伙伴</h1>
        <p>服务器已成功启动</p>
      </header>
      
      <div class="card">
        <h2><i class="fa fa-check-circle"></i> 服务状态</h2>
        <ul>
          <li><i class="fa fa-server"></i> 后端API服务: <span class="success">正常运行</span></li>
          <li><i class="fa fa-warning"></i> 前端资源: <span class="warning">加载中断</span></li>
        </ul>
      </div>
      
      <div class="card">
        <h2><i class="fa fa-link"></i> 可用端点</h2>
        <ul>
          <li><i class="fa fa-heart-pulse"></i> <a href="/health">/health</a> - 服务器健康检查</li>
          <li><i class="fa fa-stethoscope"></i> <a href="/api/health">/api/health</a> - API健康检查</li>
        </ul>
      </div>
      
      <div class="card">
        <h2><i class="fa fa-circle-info"></i> 故障排除</h2>
        <p>如果您看到此页面，表示服务器已成功启动，但前端资源可能未正确加载。这可能是因为:</p>
        <ul>
          <li><i class="fa fa-folder"></i> 静态资源目录配置不正确</li>
          <li><i class="fa fa-file-code"></i> 前端构建过程中断</li>
          <li><i class="fa fa-route"></i> 路由配置问题</li>
        </ul>
      </div>
      
      <div class="footer">
        <p>© AI学习伙伴 $(date +%Y)</p>
      </div>
    </div>
  </body>
</html>
    `);
    
    console.log(`已创建临时首页`);
  }

  console.log(`提供静态文件的目录: ${distPath}`);
  app.use(express.static(distPath));

  // 所有其他路由回退到index.html (SPA支持)
  app.use("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
EOF

echo "应用修补程序..."
cp server/vite.ts server/vite.original.ts
cp server/vite.fixed.ts server/vite.ts

echo "✅ 成功修补vite.ts"

# 确保dist/public目录存在
echo "准备静态资源目录..."
mkdir -p dist/public
cp -r dist/assets dist/public/ 2>/dev/null || echo "⚠️ 注意: 无法复制assets目录"
cp dist/index.html dist/public/ 2>/dev/null || echo "⚠️ 注意: 无法复制index.html"

# 复制前端资源到服务器的public目录
echo "复制前端资源到server/public目录..."
mkdir -p server/public
cp -r dist/assets server/public/ 2>/dev/null || echo "⚠️ 注意: 无法复制assets到server/public"
cp dist/index.html server/public/ 2>/dev/null || echo "⚠️ 注意: 无法复制index.html到server/public"

# 使用TypeScript编译服务器代码
echo "编译服务器代码..."
npx esbuild server/index.ts \
  --bundle \
  --format=esm \
  --platform=node \
  --target=node20 \
  --outdir=dist \
  --external:express \
  --external:pg \
  --external:drizzle-orm \
  --external:ws \
  --external:*.css \
  --external:*.scss \
  --packages=external

# 创建一个生产启动脚本
echo "创建生产启动脚本..."
cat > dist/production-launcher.js << 'EOF'
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// 打印诊断信息
console.log('====================================================');
console.log('生产环境启动脚本');
console.log('====================================================');
console.log(`Node.js版本: ${process.version}`);
console.log(`工作目录: ${process.cwd()}`);
console.log(`脚本位置: ${__dirname}`);

// 检查index.js是否存在
const indexPath = join(__dirname, 'index.js');
if (fs.existsSync(indexPath)) {
  console.log('找到编译后的服务器文件，尝试导入...');
  
  try {
    import('./index.js').catch(err => {
      console.error('导入编译后的服务器文件失败:', err);
      console.log('切换到备用方法...');
      runWithTsx();
    });
  } catch (err) {
    console.error('尝试导入服务器文件时出错:', err);
    console.log('切换到备用方法...');
    runWithTsx();
  }
} else {
  console.log('找不到编译后的服务器文件，切换到备用方法...');
  runWithTsx();
}

// 使用tsx直接运行TypeScript源文件
function runWithTsx() {
  console.log('使用tsx运行TypeScript源文件...');
  
  const serverPath = join(rootDir, 'server', 'index.ts');
  console.log(`尝试运行: ${serverPath}`);
  
  if (!fs.existsSync(serverPath)) {
    console.error(`错误: 找不到服务器源文件: ${serverPath}`);
    process.exit(1);
  }
  
  const serverProcess = spawn('npx', ['tsx', serverPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  serverProcess.on('exit', (code) => {
    console.log(`服务器进程退出，退出码: ${code || 0}`);
    process.exit(code || 0);
  });
}
EOF

echo "✅ 部署构建完成"
echo ""
echo "请在Replit部署中使用以下命令:"
echo "  - 构建命令: bash deploy-fix-v2.sh"
echo "  - 运行命令: NODE_ENV=production node dist/production-launcher.js"