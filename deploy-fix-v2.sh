#!/bin/bash

# 部署修复脚本 V2 - 修复dist/public路径问题

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

# 修正静态资源路径 - 关键修复 V2
echo "修复静态资源路径..."
# 创建dist/public目录(编译后代码中__dirname指向dist)
mkdir -p dist/public

# 复制前端资源到dist/public目录
echo "复制前端资源到dist/public目录..."
cp -r dist/index.html dist/assets dist/public/

# 确保index.html在正确位置
if [ -f "dist/public/index.html" ]; then
  echo "✅ index.html已正确复制到dist/public目录"
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

# 创建健康检查页面
echo "创建健康检查页面..."
cat > dist/public/health.html << 'EOF'
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
      <li>检查浏览器控制台是否有错误</li>
      <li>确认前端资源文件是否正确加载</li>
      <li>确认路径映射是否正确</li>
      <li>尝试清除浏览器缓存</li>
    </ul>
  </div>

  <script>
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

# 创建文件系统调试脚本
echo "创建文件系统调试脚本..."
cat > dist/debug.js << 'EOF'
// 文件系统调试脚本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 显示目录结构
function listDir(dir, level = 0) {
  const indent = '  '.repeat(level);
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      console.log(`${indent}📁 ${file}/`);
      listDir(filePath, level + 1);
    } else {
      console.log(`${indent}📄 ${file} (${stats.size} bytes)`);
    }
  });
}

// 显示信息
console.log('=== 文件系统调试信息 ===');
console.log(`当前工作目录: ${process.cwd()}`);
console.log(`__dirname: ${__dirname}`);
console.log('\n=== 目录结构 ===');
listDir(__dirname);

// 检查关键路径
const publicPath = path.join(__dirname, 'public');
console.log('\n=== 关键路径检查 ===');
console.log(`public目录存在: ${fs.existsSync(publicPath)}`);

if (fs.existsSync(publicPath)) {
  console.log('\n=== public目录内容 ===');
  listDir(publicPath);
}

// 检查index.html
const indexPath = path.join(publicPath, 'index.html');
if (fs.existsSync(indexPath)) {
  console.log('\n=== index.html前10行 ===');
  const content = fs.readFileSync(indexPath, 'utf8');
  const lines = content.split('\n').slice(0, 10);
  lines.forEach((line, i) => {
    console.log(`${i+1}: ${line}`);
  });
}
EOF

# 创建启动脚本
echo "创建智能启动脚本..."
cat > dist/start.js << 'EOF'
// 智能启动脚本 - 修复了静态资源路径
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 显示环境信息
console.log('=======================================================');
console.log('启动生产服务器');
console.log('=======================================================');
console.log(`Node.js版本: ${process.version}`);
console.log(`工作目录: ${process.cwd()}`);
console.log(`__dirname: ${__dirname}`);

// 确保public目录存在
const publicDir = join(__dirname, 'public');
if (!existsSync(publicDir)) {
  console.log('警告: public目录不存在，创建中...');
  mkdirSync(publicDir, { recursive: true });
}

// 检查并确保前端资源在正确位置
const indexHtml = join(publicDir, 'index.html');
const assetsDir = join(publicDir, 'assets');

// 如果index.html不在public目录但在dist根目录
if (!existsSync(indexHtml) && existsSync(join(__dirname, 'index.html'))) {
  console.log('复制index.html到public目录...');
  copyFileSync(join(__dirname, 'index.html'), indexHtml);
}

// 如果assets不在public目录但在dist根目录
if (!existsSync(assetsDir) && existsSync(join(__dirname, 'assets'))) {
  console.log('复制assets目录到public...');
  // 创建assets目录
  mkdirSync(assetsDir, { recursive: true });
  
  // 递归复制函数
  function copyDir(src, dest) {
    const entries = readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      
      if (entry.isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        copyDir(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }
  
  // 复制assets目录
  copyDir(join(__dirname, 'assets'), assetsDir);
}

// 最终路径检查
console.log(`index.html存在: ${existsSync(indexHtml) ? '是✓' : '否✗'}`);
console.log(`assets目录存在: ${existsSync(assetsDir) ? '是✓' : '否✗'}`);
console.log('=======================================================');

// 尝试启动服务器
const indexPath = join(__dirname, 'index.js');
if (existsSync(indexPath)) {
  console.log('使用编译后的文件启动...');
  
  try {
    // 导入服务器模块
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
  
  const rootDir = resolve(__dirname, '..');
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

echo "✅ 部署修复V2完成!"
echo "静态资源现在放在了dist/public目录，与编译后代码中的__dirname对应"
echo "推荐使用以下部署命令:"
echo "  - 构建命令: bash deploy-fix-v2.sh"
echo "  - 运行命令: NODE_ENV=production node dist/start.js"