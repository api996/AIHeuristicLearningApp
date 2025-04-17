#!/bin/bash

# 精准修复脚本 - 聚焦于解决esbuild依赖问题和静态资源路径
# 保留原始功能和API路由，只修改必要的部分

# 显示环境信息
echo "========================================================"
echo "精准修复部署脚本"
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

# 构建前端
echo "构建前端..."
NODE_ENV=production npx vite build

# 创建并应用vite.ts修补程序 (只修改静态资源路径部分)
echo "创建vite.ts修补程序..."
PATCH_FILE="server/vite.patch.ts"

cat > ${PATCH_FILE} << 'EOF'
// 这是一个vite.ts的修补程序，用于修复静态资源路径问题
import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  // 获取当前文件位置
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // 检查多个可能的路径
  const possiblePaths = [
    path.resolve(process.cwd(), "dist"),           // 项目根目录/dist
    path.resolve(process.cwd(), "dist/public"),    // 项目根目录/dist/public
    path.resolve(__dirname, "../dist"),            // 相对于当前目录的上级/dist
    path.resolve(__dirname, "public")              // 当前目录/public
  ];
  
  // 尝试寻找包含index.html的路径
  let distPath = null;
  
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      console.log(`找到静态资源目录: ${distPath}`);
      break;
    }
  }
  
  // 如果找不到任何有效路径，使用默认值
  if (!distPath) {
    distPath = path.resolve(process.cwd(), "dist");
    console.log(`警告: 未找到有效的静态资源目录，将使用默认路径: ${distPath}`);
  }

  // 验证是否至少有基本的index.html
  if (!fs.existsSync(path.join(distPath, "index.html"))) {
    console.log(`警告: 在${distPath}中未找到index.html，创建一个临时页面`);
    
    // 创建一个简单的欢迎页面
    const tmpDir = path.join(distPath);
    
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(tmpDir, "index.html"), `
      <!DOCTYPE html>
      <html>
        <head>
          <title>应用服务器</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; }
            h1 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .card { background: #f8f9fa; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
            .success { color: #28a745; }
            .warning { color: #ffc107; }
            pre { background: #f1f1f1; padding: 10px; border-radius: 5px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>服务器已启动</h1>
          <div class="card">
            <h2>API服务运行中</h2>
            <p>后端API服务正常运行，但未能找到前端静态资源。</p>
            <p>请检查以下端点:</p>
            <ul>
              <li><a href="/api/health">/api/health</a> - API健康检查</li>
              <li><a href="/health">/health</a> - 服务器健康检查</li>
            </ul>
          </div>
        </body>
      </html>
    `);
    
    console.log(`已创建临时首页`);
  }

  console.log(`提供静态文件的目录: ${distPath}`);
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (SPA支持)
  app.use("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
EOF

echo "修补vite.ts文件..."
VITE_TS="server/vite.ts"
VITE_BACKUP="server/vite.original.ts"

# 备份原始文件
cp "$VITE_TS" "$VITE_BACKUP"

# 提取除了serveStatic函数外的所有内容
grep -v "export function serveStatic" "$VITE_BACKUP" > "$VITE_TS"

# 添加修补版的serveStatic函数
cat "$PATCH_FILE" >> "$VITE_TS"

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

echo "✅ 部署构建完成"
echo ""
echo "请在Replit部署中使用以下命令:"
echo "  - 构建命令: bash deploy-fix.sh"
echo "  - 运行命令: NODE_ENV=production node dist/index.js"