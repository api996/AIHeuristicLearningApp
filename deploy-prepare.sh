#!/bin/bash

# 部署准备脚本 - 专注于前端静态资源确保正确构建

# 设置环境变量
export NODE_ENV=production

# 诊断信息
echo "构建环境信息:"
echo "Node.js版本: $(node -v)"
echo "NPM版本: $(npm -v)"
echo "工作目录: $(pwd)"

# 清理旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist

# 确保前端构建依赖存在
echo "检查前端依赖..."
npm ci

# 构建前端
echo "开始构建前端..."
npx vite build

# 验证前端构建结果
if [ ! -d "dist/assets" ]; then
  echo "❌ 前端构建失败，未找到资源文件！"
  exit 1
else
  echo "✅ 前端构建成功，资源文件已生成!"
  ls -la dist/assets
fi

# 特别检查index.html
if [ ! -f "dist/index.html" ]; then
  echo "❌ 警告: dist/index.html不存在!"
else
  echo "✅ dist/index.html存在!"
  grep -i "<script" dist/index.html || echo "警告: 未找到任何script标签"
  grep -i "<link" dist/index.html || echo "警告: 未找到任何link标签"
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

# 确保前端资源能被服务器访问
echo "检查服务器是否能访问前端资源..."
if grep -q "app.use(express.static" server/index.ts; then
  echo "✅ 服务器配置静态文件服务!"
else
  echo "⚠️ 警告: 未检测到express.static配置，可能需要手动检查静态文件服务配置"
fi

# 创建前端验证文件
echo "创建健康检查页面..."
cat > dist/health.html << 'EOF'
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>健康检查页面</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      color: #333;
    }
    .status {
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    h1 {
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .info {
      background-color: #e2f3ff;
      padding: 15px;
      border-radius: 5px;
      border: 1px solid #b8daff;
    }
  </style>
</head>
<body>
  <h1>部署健康检查</h1>
  
  <div class="status success">
    <h2>✅ 服务器运行正常</h2>
    <p>您正在查看的是健康检查页面，这说明服务器已成功启动并可以提供静态文件。</p>
  </div>
  
  <div class="info">
    <h3>故障排除信息</h3>
    <p>如果您只能看到此页面，但无法访问应用程序：</p>
    <ul>
      <li>检查前端构建是否成功</li>
      <li>确认服务器配置中包含了 <code>express.static('dist')</code></li>
      <li>确认没有路由冲突</li>
      <li>尝试直接访问 <a href="/index.html">/index.html</a></li>
    </ul>
  </div>

  <script>
    // 简单的前端脚本，验证JavaScript是否正常运行
    document.addEventListener('DOMContentLoaded', () => {
      const time = new Date().toLocaleTimeString();
      const infoDiv = document.querySelector('.info');
      const timeP = document.createElement('p');
      timeP.textContent = `当前时间: ${time}`;
      timeP.style.fontWeight = 'bold';
      infoDiv.appendChild(timeP);
    });
  </script>
</body>
</html>
EOF

# 创建启动脚本
echo "创建启动脚本..."
cat > dist/start.js << 'EOF'
// 生产环境启动脚本
import { existsSync } from 'fs';
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
console.log(`前端资源目录是否存在: ${existsSync(join(__dirname, 'assets')) ? '是' : '否'}`);
console.log(`index.html是否存在: ${existsSync(join(__dirname, 'index.html')) ? '是' : '否'}`);
console.log('=======================================================');

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

// 使用tsx运行原始TypeScript文件
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

# 使启动脚本可执行
chmod +x dist/start.js

echo "✅ 部署准备完成!"
echo "请检查服务器配置以确保静态资源被正确提供"
echo "推荐使用以下部署命令:"
echo "  - 构建命令: bash deploy-prepare.sh"
echo "  - 运行命令: NODE_ENV=production node dist/start.js"