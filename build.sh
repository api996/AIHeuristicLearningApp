#!/bin/bash

# 终极构建脚本 - 整合多种修复方案
# 此脚本整合了所有可能的修复方案，一步到位解决构建问题

# 显示系统信息
echo "===================== 系统信息 ====================="
echo "Node.js 版本: $(node -v)"
echo "NPM 版本: $(npm -v)"
echo "内存情况:"
free -h
echo "=====================================================\n"

# 设置优化环境变量
export NODE_OPTIONS="--max-old-space-size=2048"
export NODE_ENV="production"

# 清理旧文件
echo "清理构建文件..."
rm -rf dist
rm -rf temp_build

# 确保有正确的type
echo "检查package.json配置..."
if ! grep -q '"type": "module"' package.json; then
  echo "确保package.json有ESM配置..."
  npm pkg set type="module"
fi

# 第一阶段: 分离构建前端
echo "\n===================== 第一阶段: 构建前端 ====================="
NODE_ENV=production npx vite build

# 检查前端构建结果
if [ ! -d "dist/assets" ]; then
  echo "前端构建失败，查看日志并修复问题后再继续"
  exit 1
else
  echo "✅ 前端构建成功！"
fi

# 第二阶段: 安全构建后端
echo "\n===================== 第二阶段: 构建后端 ====================="
echo "尝试使用保守设置构建后端..."

# 保守构建命令
NODE_ENV=production npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --outdir=dist \
  --external:vite.config.ts \
  --external:express \
  --external:pg \
  --external:drizzle-orm \
  --external:ws \
  --external:@google/generative-ai \
  --external:*.css \
  --external:*.scss \
  --packages=external

# 检查后端构建结果
if [ ! -f "dist/index.js" ]; then
  echo "后端编译失败，创建备用启动脚本..."
else
  echo "✅ 后端构建成功！"
fi

# 第三阶段: 创建智能启动脚本
echo "\n===================== 第三阶段: 创建启动脚本 ====================="
cat > dist/startup.js << 'EOF'
// 智能启动脚本 - 自适应多种运行环境
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';
import os from 'os';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// 启动日志
console.log('======================================');
console.log('启动生产服务器');
console.log('--------------------------------------');
console.log(`Node.js版本: ${process.version}`);
console.log(`平台: ${os.platform()} ${os.arch()}`);
console.log(`内存: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`);
console.log(`工作目录: ${process.cwd()}`);
console.log('======================================\n');

// 定义运行方法
const runMethods = [
  // 方法1: 使用编译后的文件
  async function useCompiledFile() {
    const indexPath = join(__dirname, 'index.js');
    if (!existsSync(indexPath)) {
      console.log('找不到编译后的文件.');
      return false;
    }
    
    console.log('📦 使用编译后的文件启动服务...');
    try {
      await import('./index.js');
      return true;
    } catch (err) {
      console.error('❌ 导入编译文件失败:', err.message);
      return false;
    }
  },
  
  // 方法2: 使用tsx直接运行
  function useTsx() {
    console.log('🚀 使用TSX直接运行TypeScript源文件...');
    
    const serverProcess = spawn('npx', ['tsx', join(rootDir, 'server/index.ts')], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });
    
    // 处理退出
    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ 服务进程异常退出，退出码: ${code}`);
      }
      process.exit(code || 0);
    });
    
    // 处理信号
    ['SIGINT', 'SIGTERM'].forEach(signal => {
      process.on(signal, () => {
        console.log(`收到${signal}信号，正在关闭服务...`);
        serverProcess.kill(signal);
      });
    });
    
    return true;
  }
];

// 按顺序尝试每种方法
async function tryRunMethods() {
  for (let i = 0; i < runMethods.length; i++) {
    try {
      const success = await runMethods[i]();
      if (success) return;
    } catch (err) {
      console.error(`方法${i+1}失败:`, err);
    }
  }
  
  console.error('❌ 所有启动方法均失败，服务无法启动.');
  process.exit(1);
}

// 启动服务
tryRunMethods();
EOF

# 使启动脚本可执行
chmod +x dist/startup.js

echo "\n✅ 构建完成！"
echo "推荐使用以下启动命令: NODE_ENV=production node dist/startup.js"
echo "请设置以下Replit部署命令:"
echo "  - 构建命令: bash build.sh"
echo "  - 运行命令: NODE_ENV=production node dist/startup.js"