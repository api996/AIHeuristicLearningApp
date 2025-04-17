
#!/bin/bash
# 简化的构建脚本，解决部署问题

set -e  # 遇到错误立即停止

echo "开始简化构建流程..."

# 清理旧的构建文件
rm -rf dist
mkdir -p dist

# 安装缺失的依赖
echo "安装缺失的依赖..."
npm install -D @babel/preset-typescript lightningcss

# 构建前端
echo "构建前端..."
NODE_ENV=production npx vite build

# 构建后端 (使用更安全的配置)
echo "构建后端..."
NODE_ENV=production npx esbuild server/index.ts \
  --platform=node \
  --bundle \
  --outfile=dist/index.js \
  --format=esm \
  --external:express \
  --external:pg \
  --external:ws \
  --external:@neondatabase/serverless \
  --external:drizzle-orm \
  --external:fs \
  --external:path \
  --external:vite \
  --external:* 

# 确保routes目录被正确复制到dist
echo "复制routes目录到dist..."
mkdir -p dist/routes
cp -r server/routes/* dist/routes/

# 如果出现问题，创建备用启动器
echo "创建备用启动器..."
cat > dist/backup-launcher.js << 'EOF'
// 备用启动器
import { spawn } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('使用备用启动器...');
process.env.NODE_ENV = 'production';

const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: 'inherit'
});

serverProcess.on('close', (code) => {
  console.log(`服务器进程退出，退出码: ${code}`);
});
EOF

echo "构建完成"
