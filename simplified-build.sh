#!/bin/bash

# 简化的构建脚本 - 专注于模块解析问题
# 避免过度修改，确保基本功能正常

# 显示构建环境
echo "构建环境信息:"
echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"
echo "工作目录: $(pwd)"

# 确保安装了必要的构建工具
echo "确保构建工具已安装..."
npm install --no-save esbuild

# 清理旧构建文件
echo "清理旧构建文件..."
rm -rf dist
mkdir -p dist

# 构建前端
echo "构建前端..."
NODE_ENV=production npx vite build

# 确保dist/public目录存在并包含前端资源
echo "准备静态资源..."
mkdir -p dist/public
cp -r dist/assets dist/public/ 2>/dev/null || echo "注意: 无法复制assets目录"
cp dist/index.html dist/public/ 2>/dev/null || echo "注意: 无法复制index.html"

# 创建一个简单的服务器启动文件
echo "创建生产启动文件..."
cat > dist/server.js << 'EOF'
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3000;

// 创建Express应用
const app = express();

// 静态资源处理函数
function configureStaticServing(app) {
  console.log('配置静态资源服务...');
  
  // 首先检查当前目录下是否有index.html
  if (fs.existsSync(join(__dirname, 'index.html'))) {
    console.log('找到根目录下的index.html，使用当前目录作为静态目录');
    app.use(express.static(__dirname));
    return true;
  }
  
  // 然后检查public目录
  if (fs.existsSync(join(__dirname, 'public', 'index.html'))) {
    console.log('找到public目录下的index.html，使用public目录作为静态目录');
    app.use(express.static(join(__dirname, 'public')));
    return true;
  }
  
  // 最后检查上级目录的dist目录
  const parentDistDir = resolve(__dirname, '..');
  if (fs.existsSync(join(parentDistDir, 'index.html'))) {
    console.log('找到上级目录下的index.html，使用上级目录作为静态目录');
    app.use(express.static(parentDistDir));
    return true;
  }
  
  console.log('警告: 未找到静态资源目录');
  return false;
}

// 配置静态资源
const foundStatic = configureStaticServing(app);

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    staticResourcesFound: foundStatic
  });
});

// 所有其他路由回退到index.html (SPA支持)
app.get('*', (req, res) => {
  // 尝试查找index.html的路径
  const possiblePaths = [
    join(__dirname, 'index.html'),
    join(__dirname, 'public', 'index.html'),
    resolve(__dirname, '..', 'index.html')
  ];
  
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return res.sendFile(path);
    }
  }
  
  // 如果找不到index.html，返回一个简单的HTML
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>应用服务器</title>
      </head>
      <body>
        <h1>服务器已启动</h1>
        <p>服务器正在运行，但未找到前端资源。</p>
        <p>请尝试访问 <a href="/api/health">/api/health</a> 检查服务器状态。</p>
      </body>
    </html>
  `);
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器启动在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
EOF

echo "✅ 构建完成"
echo ""
echo "请在Replit部署中使用以下命令:"
echo "  - 构建命令: bash simplified-build.sh"
echo "  - 运行命令: NODE_ENV=production node dist/server.js"