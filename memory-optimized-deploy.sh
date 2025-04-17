#!/bin/bash

# 内存优化版构建脚本
# 这个脚本专门设计用于在内存受限的环境中使用，分阶段构建避免OOM

# 显示内存信息
echo "当前内存使用情况:"
free -h

# 设置内存优化相关环境变量
export NODE_OPTIONS="--max-old-space-size=2048"
export NODE_ENV="production"

# 删除旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist

# 安装依赖
echo "安装依赖..."
npm ci

# 诊断信息
echo "构建环境信息:"
echo "Node.js 版本: $(node -v)"
echo "NPM 版本: $(npm -v)"

# 阶段1: 仅构建前端
echo "阶段1: 构建前端..."
NODE_ENV=production npx vite build

# 显示内存使用情况
echo "前端构建后内存使用情况:"
free -h

# 阶段2: 构建服务器 - 关键部分
echo "阶段2: 构建后端..."
NODE_ENV=production npx esbuild server/index.ts \
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
  --external:@google/generative-ai \
  --packages=external \
  --metafile=dist/meta.json \
  --log-level=warning

# 检查构建是否成功
if [ ! -f dist/index.js ]; then
  echo "警告: 后端构建失败。创建备用启动脚本..."
else
  echo "后端构建成功！"
fi

# 创建备用启动脚本
echo "创建内存优化版启动脚本..."
cat > dist/start.js << 'EOF'
// 轻量级启动脚本 - 支持ESM和备用方案
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// 获取编译文件路径
const compiledPath = join(__dirname, 'index.js');

// 显示启动信息
console.log('启动服务中...');
console.log(`工作目录: ${process.cwd()}`);
console.log(`环境: ${process.env.NODE_ENV}`);
console.log(`Node.js版本: ${process.version}`);

// 检查编译后的文件是否存在
if (existsSync(compiledPath)) {
  console.log('使用编译后的文件启动...');
  import('./index.js').catch(err => {
    console.error('编译文件导入失败:', err);
    useBackupMethod();
  });
} else {
  console.log('找不到编译后的文件，切换到备用方法...');
  useBackupMethod();
}

// 使用tsx运行原始TypeScript文件
function useBackupMethod() {
  console.log('使用tsx直接运行TypeScript源文件...');
  
  const serverProcess = spawn('npx', ['tsx', join(rootDir, 'server/index.ts')], {
    stdio: 'inherit',
    env: process.env
  });
  
  // 处理子进程退出
  serverProcess.on('exit', (code) => {
    console.log(`服务进程退出，退出码: ${code || 0}`);
    process.exit(code || 0);
  });
  
  // 处理信号
  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => {
    process.on(signal, () => {
      console.log(`收到${signal}信号，关闭服务...`);
      serverProcess.kill(signal);
    });
  });
}
EOF

echo "构建过程完成！"
echo "请使用以下命令启动服务:"
echo "  NODE_ENV=production node dist/start.js"

# 显示权限
chmod +x dist/start.js

# 显示构建后的内存使用情况
echo "构建后内存使用情况:"
free -h