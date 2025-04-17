#!/bin/bash
# 修复部署问题脚本

set -e  # 遇到错误立即停止脚本执行

echo "===== 开始修复部署流程 ====="

# 清理旧构建文件
echo "1. 清理旧文件..."
rm -rf dist
mkdir -p dist

# 检查node版本
echo "2. 检查Node.js版本..."
node -v

# 确保安装了所有依赖
echo "3. 安装依赖..."
npm ci || npm install

# 检查esbuild版本
echo "4. 检查esbuild版本..."
npx esbuild --version

# 先构建前端
echo "5. 构建前端..."
NODE_ENV=production npx vite build

# 尝试使用简化的esbuild命令构建后端
echo "6. 构建后端(简化方式)..."
NODE_ENV=production npx esbuild server/index.ts \
  --platform=node \
  --bundle \
  --format=esm \
  --outfile=dist/index.js \
  --external:express \
  --external:pg \
  --external:@neondatabase/serverless \
  --external:drizzle-orm \
  --external:fs \
  --external:path \
  --external:ws \
  --external:node-fetch

# 检查构建结果
if [ -f "dist/index.js" ]; then
  echo "✅ 后端构建成功!"
else
  echo "❌ 后端构建失败，尝试备用方法..."
  
  # 备用方法：不使用esbuild，直接复制文件
  echo "7. 使用备用方法..."
  # 复制TypeScript文件
  cp -r server dist/
  
  # 创建启动器文件
  cat > dist/launcher.js << 'EOF'
// 服务器启动器
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_ENV = 'production';

// 使用tsx运行服务器
const serverProcess = spawn('npx', ['tsx', join(__dirname, 'server/index.ts')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

serverProcess.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});
EOF

  echo "✅ 备用方法设置完成!"
  echo ""
  echo "⚠️ 注意: 请使用以下运行命令:"
  echo "NODE_ENV=production node dist/launcher.js"
  exit 0
fi

echo "===== 部署准备完成 ====="
echo ""
echo "✅ 你可以使用以下命令启动服务器:"
echo "NODE_ENV=production node dist/index.js"