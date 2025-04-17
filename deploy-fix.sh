#!/bin/bash

# 终极部署修复脚本 - 修复静态资源路径问题

# 设置环境变量
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"

# 诊断信息
echo "===================== 构建环境信息 ====================="
echo "Node.js版本: $(node -v)"
echo "NPM版本: $(npm -v)"
echo "工作目录: $(pwd)"
echo "======================================================="

# 清理旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist
mkdir -p dist

# 安装依赖
echo "安装依赖..."
npm ci

# 构建前端
echo "构建前端..."
npx vite build

# 修复静态资源路径问题 - 关键修复点
echo "修复静态资源路径问题..."
# 创建server/public目录(生产环境中serveStatic函数使用的目录)
mkdir -p server/public

# 复制前端资源到server/public目录
echo "复制前端资源到server/public目录..."
cp -r dist/* server/public/

# 确保index.html在正确位置
if [ -f "server/public/index.html" ]; then
  echo "✅ index.html已正确复制到server/public目录"
else
  echo "❌ 复制index.html失败!"
  exit 1
fi

# 构建后端
echo "构建后端..."
npx esbuild server/index.ts \
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

# 复制server/public到dist目录确保公共资源可访问
echo "确保静态资源在服务器启动时可用..."
cp -r server/public dist/

# 创建启动脚本
echo "创建智能启动脚本..."
cat > dist/start.js << 'EOF'
// 智能启动脚本 - 修复了静态资源路径
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

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
console.log(`静态资源目录: ${join(__dirname, 'public')}`);
console.log(`前端资源目录是否存在: ${existsSync(join(__dirname, 'public')) ? '是✓' : '否✗'}`);
console.log(`index.html是否存在: ${existsSync(join(__dirname, 'public', 'index.html')) ? '是✓' : '否✗'}`);
console.log('=======================================================');

// 验证目录结构
if (!existsSync(join(__dirname, 'public')) || !existsSync(join(__dirname, 'public', 'index.html'))) {
  console.log('警告: 静态资源可能不在正确位置，尝试修复...');
  
  // 尝试修复目录结构
  try {
    // 确保public目录存在
    if (!existsSync(join(__dirname, 'public'))) {
      fs.mkdirSync(join(__dirname, 'public'), { recursive: true });
    }
    
    // 检查是否有index.html在dist根目录
    if (existsSync(join(__dirname, 'index.html')) && !existsSync(join(__dirname, 'public', 'index.html'))) {
      // 复制index.html到public目录
      fs.copyFileSync(join(__dirname, 'index.html'), join(__dirname, 'public', 'index.html'));
      console.log('已将index.html复制到public目录');
    }
    
    // 检查是否有assets目录但不在public内
    if (existsSync(join(__dirname, 'assets')) && !existsSync(join(__dirname, 'public', 'assets'))) {
      // 创建symbolic link
      fs.symlinkSync(join(__dirname, 'assets'), join(__dirname, 'public', 'assets'), 'dir');
      console.log('已创建assets目录的符号链接');
    }
  } catch (err) {
    console.error('修复目录结构失败:', err);
  }
}

// 尝试直接导入编译后的文件
const indexPath = join(__dirname, 'index.js');

// 检查编译后的文件是否存在
if (existsSync(indexPath)) {
  console.log('使用编译后的文件启动...');
  
  try {
    // 尝试导入编译后的服务器文件
    import('./index.js').catch(err => {
      console.error('导入编译文件失败:', err);
      useBackupMethod();
    });
  } catch (err) {
    console.error('加载编译文件失败:', err);
    useBackupMethod();
  }
} else {
  console.log('找不到编译后的文件，切换到备用方法...');
  useBackupMethod();
}

// 备用方法: 使用tsx运行原始TypeScript文件
function useBackupMethod() {
  console.log('使用tsx直接运行TypeScript源文件...');
  
  const serverProcess = spawn('npx', ['tsx', join(rootDir, 'server/index.ts')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  // 处理子进程退出
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

# 让启动脚本可执行
chmod +x dist/start.js

echo "✅ 部署修复完成!"
echo "已修复静态资源路径问题，前端文件已复制到server/public目录"
echo "推荐使用以下部署命令:"
echo "  - 构建命令: bash deploy-fix.sh"
echo "  - 运行命令: NODE_ENV=production node dist/start.js"