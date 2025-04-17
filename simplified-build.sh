#!/bin/bash

# 简化版构建脚本 - 专门解决ESM模块问题

# 删除旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist

# 安装依赖
echo "安装依赖..."
npm ci

# 诊断信息
echo "Node.js 版本: $(node -v)"
echo "NPM 版本: $(npm -v)"

# 确保package.json中有正确的type字段
echo "检查package.json中的模块类型..."
if ! grep -q '"type": "module"' package.json; then
  echo "package.json中缺少\"type\": \"module\"设置，添加中..."
  # 使用临时文件做中转
  jq '. + {"type": "module"}' package.json > package.json.tmp
  mv package.json.tmp package.json
fi

# 构建前端
echo "构建前端..."
NODE_ENV=production npx vite build

# 构建后端 - 使用更保守的配置
echo "构建后端..."
NODE_ENV=production npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node20 \
  --outdir=dist \
  --external:vite.config.ts \
  --external:"*.{css,scss,sass}" \
  --external:express \
  --external:pg \
  --external:drizzle-orm \
  --external:@google/generative-ai \
  --external:@tanstack/react-query \
  --external:@replit/object-storage \
  --external:ws \
  --external:uuid \
  --packages=external

# 创建启动脚本
echo "创建备用启动脚本..."
cat > dist/launcher.js << 'EOF'
// ESM兼容启动脚本
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 尝试直接导入编译后的文件
const indexPath = join(__dirname, 'index.js');

console.log('启动生产服务器...');
console.log(`Node.js版本: ${process.version}`);
console.log(`当前工作目录: ${process.cwd()}`);
console.log(`当前脚本目录: ${__dirname}`);

// 检查编译后的文件是否存在
if (existsSync(indexPath)) {
  console.log('找到编译后的文件，直接导入...');
  
  try {
    // 方法1: 直接导入
    import('./index.js')
      .catch(err => {
        console.error('导入编译文件失败:', err);
        fallbackToTsx();
      });
  } catch (err) {
    console.error('加载编译文件失败:', err);
    fallbackToTsx();
  }
} else {
  console.log('找不到编译后的文件，使用备用方法...');
  fallbackToTsx();
}

// 备用方法: 使用tsx运行原始文件
function fallbackToTsx() {
  console.log('使用tsx运行原始TypeScript文件...');
  
  const tsxProcess = spawn('npx', ['tsx', '../server/index.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  tsxProcess.on('exit', (code) => {
    console.log(`tsx进程退出，退出码: ${code}`);
    process.exit(code || 0);
  });
  
  // 处理信号
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      console.log(`收到${signal}信号，关闭服务...`);
      tsxProcess.kill(signal);
    });
  });
}
EOF

echo "构建完成！请使用以下命令启动:"
echo "  NODE_ENV=production node dist/launcher.js"
echo "或者直接使用编译后的文件:"
echo "  NODE_ENV=production node dist/index.js"