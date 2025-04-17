#!/bin/bash

# 终极部署修复脚本V3 - 全面解决前端资源问题
# 这个脚本修复了静态资源路径问题，并添加了更强大的debug功能

# 设置环境变量
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"

# 诊断信息
echo "=========================================================="
echo "构建环境信息:"
echo "Node.js版本: $(node -v)"
echo "NPM版本: $(npm -v)"
echo "工作目录: $(pwd)"
echo "=========================================================="

# 清理旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist
mkdir -p dist

# 安装依赖
echo "安装依赖..."
npm ci

# 构建前端
echo "构建前端..."
NODE_ENV=production npx vite build

# 优化修复路径策略
echo "=== 实施全面的前端资源修复策略 ==="

# 策略1: 直接修改vite.ts中的路径解析
# 查找vite.ts
VITE_TS_PATH="server/vite.ts"
echo "检查vite.ts文件..."
if [ -f "$VITE_TS_PATH" ]; then
  echo "找到vite.ts文件，创建修改版本..."
  
  # 创建一个固定路径的vite.ts版本
  cat > server/vite.fixed.ts << 'EOF'
import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // 修复: 使用绝对路径来指向dist目录
  let distPath;
  
  // 检查多个可能的路径
  const possiblePaths = [
    path.resolve(process.cwd(), "dist/public"),     // dist/public
    path.resolve(process.cwd(), "dist"),           // dist根目录
    path.resolve(process.cwd(), "server/public"),   // server/public
    path.resolve(__dirname, "../dist/public"),      // 相对于server的dist/public
    path.resolve(__dirname, "public")              // server/public (__dirname在生产环境可能指向不同位置)
  ];
  
  // 查找包含index.html的第一个路径
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      log(`找到静态资源目录: ${distPath}`);
      break;
    }
  }
  
  // 如果找不到任何有效路径，使用默认路径并发出警告
  if (!distPath) {
    distPath = path.resolve(process.cwd(), "dist");
    log(`警告: 未找到有效的静态资源目录，将使用默认路径: ${distPath}`);
  }

  // 确保目录存在
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `无法找到构建目录: ${distPath}，请确保先构建前端`,
    );
  }

  log(`提供静态文件的目录: ${distPath}`);
  app.use(express.static(distPath));

  // 检查index.html
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    log(`找到index.html: ${indexPath}`);
  } else {
    log(`警告: 找不到index.html在路径: ${indexPath}`);
  }

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
EOF
  
  echo "✅ 创建了修改版本的vite.ts"
else
  echo "❌ 找不到vite.ts文件"
fi

# 策略2: 确保所有可能的路径都有前端资源
echo "实施多重保险策略..."

# 创建所有可能需要静态资源的目录
mkdir -p dist/public
mkdir -p server/public

# 复制前端资源到所有可能的位置
echo "复制前端资源到多个位置..."
cp -r dist/*.html dist/assets dist/public/ 2>/dev/null || true
cp -r dist/*.html dist/assets server/public/ 2>/dev/null || true

# 检查复制结果
if [ -f "dist/public/index.html" ]; then
  echo "✅ 前端资源成功复制到dist/public"
else
  echo "❌ 复制到dist/public失败"
fi

if [ -f "server/public/index.html" ]; then
  echo "✅ 前端资源成功复制到server/public"
else
  echo "❌ 复制到server/public失败"
fi

# 构建后端
echo "构建后端..."
npx esbuild server/index.ts server/vite.fixed.ts \
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

# 使用修改后的vite.ts
echo "修补生成的代码以使用修改版vite模块..."
if [ -f "dist/index.js" ] && [ -f "dist/vite.fixed.js" ]; then
  # 替换导入语句
  sed -i 's/from "\.\/vite\.js"/from "\.\/vite\.fixed\.js"/g' dist/index.js
  echo "✅ 成功修补index.js中的导入语句"
else
  echo "❌ 找不到要修补的文件"
fi

# 创建调试/诊断网页
echo "创建诊断页面..."
cat > dist/public/debug.html << 'EOF'
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>服务器诊断工具</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    h1 {
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 10px;
      color: #2c3e50;
    }
    
    .card {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
      padding: 15px;
    }
    
    .card h2 {
      margin-top: 0;
      color: #3498db;
    }
    
    .success {
      color: #27ae60;
      font-weight: bold;
    }
    
    .error {
      color: #e74c3c;
      font-weight: bold;
    }
    
    .info {
      color: #3498db;
    }
    
    .warning {
      color: #f39c12;
    }
    
    pre {
      background: #f8f8f8;
      border-radius: 4px;
      padding: 10px;
      overflow-x: auto;
    }
    
    button {
      background: #3498db;
      color: white;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    button:hover {
      background: #2980b9;
    }
    
    .actions {
      margin-top: 20px;
    }
    
    #status {
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <h1>服务器诊断工具</h1>
  
  <div class="card">
    <h2>基本信息</h2>
    <div id="basicInfo">正在加载...</div>
  </div>
  
  <div class="card">
    <h2>静态资源检查</h2>
    <div id="staticCheck">正在检查...</div>
  </div>
  
  <div class="card">
    <h2>API连接测试</h2>
    <div id="apiTest">准备测试...</div>
    <div class="actions">
      <button id="testApiBtn">测试API连接</button>
    </div>
  </div>
  
  <div class="card">
    <h2>环境变量</h2>
    <div id="envVars">环境信息将在API测试后显示</div>
  </div>
  
  <div class="card">
    <h2>诊断结果</h2>
    <div id="diagnosis">等待诊断...</div>
  </div>
  
  <script>
    // 基本信息
    function loadBasicInfo() {
      const basicInfoDiv = document.getElementById('basicInfo');
      const info = [
        `<p><span class="info">当前URL:</span> ${window.location.href}</p>`,
        `<p><span class="info">用户代理:</span> ${navigator.userAgent}</p>`,
        `<p><span class="info">当前时间:</span> ${new Date().toLocaleString()}</p>`,
        `<p><span class="info">页面加载状态:</span> <span class="success">成功</span></p>`
      ];
      basicInfoDiv.innerHTML = info.join('');
    }
    
    // 检查静态资源
    function checkStaticResources() {
      const staticCheckDiv = document.getElementById('staticCheck');
      const results = [];
      
      // 创建一个测试图像元素
      const testImage = new Image();
      testImage.onload = () => {
        results.push(`<p><span class="info">资源加载:</span> <span class="success">成功</span></p>`);
        completeStaticCheck();
      };
      testImage.onerror = () => {
        results.push(`<p><span class="info">资源加载:</span> <span class="error">失败</span> (无法加载测试图像)</p>`);
        completeStaticCheck();
      };
      
      // 尝试加载位于assets目录中的图像（如果存在）
      testImage.src = `/assets/test-image.png?t=${Date.now()}`;
      
      // 检查CSS和JS资源
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      results.push(`<p><span class="info">CSS样式表:</span> 找到 ${links.length} 个</p>`);
      
      const scripts = document.querySelectorAll('script[src]');
      results.push(`<p><span class="info">外部脚本:</span> 找到 ${scripts.length} 个</p>`);
      
      // 尝试直接访问常见资源路径
      results.push(`<p><span class="info">尝试访问index.html:</span> <a href="/index.html" target="_blank">点击测试</a></p>`);
      results.push(`<p><span class="info">尝试访问assets目录:</span> <a href="/assets/" target="_blank">点击测试</a></p>`);
      
      function completeStaticCheck() {
        // 简单页面导航测试
        results.push(`<p><span class="info">导航测试:</span> <a href="/" target="_blank">首页</a> | <a href="/health.html" target="_blank">健康检查页面</a></p>`);
        staticCheckDiv.innerHTML = results.join('');
      }
    }
    
    // API测试
    function setupApiTest() {
      const testApiBtn = document.getElementById('testApiBtn');
      const apiTestDiv = document.getElementById('apiTest');
      
      testApiBtn.addEventListener('click', async () => {
        apiTestDiv.innerHTML = `<p><span class="info">正在测试API连接...</span></p>`;
        
        try {
          const response = await fetch('/api/health');
          
          if (response.ok) {
            const data = await response.json();
            apiTestDiv.innerHTML = `
              <p><span class="info">API连接:</span> <span class="success">成功</span></p>
              <p><span class="info">状态码:</span> ${response.status}</p>
              <p><span class="info">响应数据:</span></p>
              <pre>${JSON.stringify(data, null, 2)}</pre>
            `;
            
            // 尝试获取环境信息
            getEnvironmentInfo();
          } else {
            apiTestDiv.innerHTML = `
              <p><span class="info">API连接:</span> <span class="warning">部分成功</span></p>
              <p><span class="info">状态码:</span> ${response.status}</p>
              <p><span class="info">响应文本:</span> ${await response.text()}</p>
            `;
          }
        } catch (error) {
          apiTestDiv.innerHTML = `
            <p><span class="info">API连接:</span> <span class="error">失败</span></p>
            <p><span class="info">错误:</span> ${error.message}</p>
            <p>尝试访问不同的API端点:</p>
            <button id="testAltApiBtn">测试/api</button>
          `;
          
          // 设置备用API测试
          document.getElementById('testAltApiBtn').addEventListener('click', async () => {
            try {
              const response = await fetch('/api');
              
              if (response.ok) {
                apiTestDiv.innerHTML += `
                  <p><span class="info">备用API连接:</span> <span class="success">成功</span></p>
                  <p><span class="info">状态码:</span> ${response.status}</p>
                `;
              } else {
                apiTestDiv.innerHTML += `
                  <p><span class="info">备用API连接:</span> <span class="warning">部分成功</span></p>
                  <p><span class="info">状态码:</span> ${response.status}</p>
                `;
              }
            } catch (err) {
              apiTestDiv.innerHTML += `
                <p><span class="info">备用API连接:</span> <span class="error">失败</span></p>
                <p><span class="info">错误:</span> ${err.message}</p>
              `;
            }
          });
        }
      });
    }
    
    // 获取环境信息
    async function getEnvironmentInfo() {
      const envVarsDiv = document.getElementById('envVars');
      
      try {
        const response = await fetch('/api/debug/env');
        
        if (response.ok) {
          const data = await response.json();
          envVarsDiv.innerHTML = `
            <p><span class="info">环境:</span> ${data.NODE_ENV || 'unknown'}</p>
            <p><span class="info">服务器时间:</span> ${data.serverTime || 'unknown'}</p>
            <p><span class="info">构建信息:</span></p>
            <pre>${JSON.stringify(data.buildInfo || {}, null, 2)}</pre>
          `;
        } else {
          envVarsDiv.innerHTML = `<p><span class="warning">无法获取环境信息 (状态码: ${response.status})</span></p>`;
        }
      } catch (error) {
        envVarsDiv.innerHTML = `<p><span class="error">获取环境信息时出错: ${error.message}</span></p>`;
      }
    }
    
    // 运行诊断
    function runDiagnosis() {
      const diagnosisDiv = document.getElementById('diagnosis');
      
      setTimeout(() => {
        const issues = [];
        
        // 检查URL
        if (window.location.pathname !== '/debug.html') {
          issues.push('当前URL路径不是/debug.html，可能存在路由问题。');
        }
        
        // 检查CSS是否加载
        const styles = document.querySelectorAll('link[rel="stylesheet"]');
        if (styles.length === 0) {
          issues.push('未检测到CSS样式表，静态资源加载可能有问题。');
        }
        
        // 检查console是否有错误
        if (window.consoleErrors && window.consoleErrors.length > 0) {
          issues.push(`检测到${window.consoleErrors.length}个控制台错误。`);
        }
        
        // 显示诊断结果
        if (issues.length === 0) {
          diagnosisDiv.innerHTML = `
            <p><span class="success">诊断完成，未发现明显问题。</span></p>
            <p>前端静态资源似乎正确加载。如果您仍然遇到问题，请检查:</p>
            <ul>
              <li>后端API连接</li>
              <li>环境变量配置</li>
              <li>登录/认证设置</li>
              <li>浏览器控制台错误</li>
            </ul>
          `;
        } else {
          diagnosisDiv.innerHTML = `
            <p><span class="warning">诊断发现以下问题:</span></p>
            <ul>
              ${issues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
            <p>建议解决方案:</p>
            <ul>
              <li>确认部署脚本正确复制了静态资源</li>
              <li>检查服务器配置中的静态资源目录设置</li>
              <li>在服务器上验证文件路径</li>
              <li>清除浏览器缓存后重试</li>
            </ul>
          `;
        }
      }, 1000);
    }
    
    // 初始化诊断工具
    function init() {
      // 收集console错误
      window.consoleErrors = [];
      const originalConsoleError = console.error;
      console.error = function(...args) {
        window.consoleErrors.push(args);
        originalConsoleError.apply(console, args);
      };
      
      loadBasicInfo();
      checkStaticResources();
      setupApiTest();
      runDiagnosis();
    }
    
    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>
EOF

# 创建智能启动脚本
echo "创建智能启动脚本..."
cat > dist/start.js << 'EOF'
// 智能启动脚本 V3 - 修复了静态资源路径问题
import { existsSync, readdirSync, readFileSync, mkdirSync, copyFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// 打印诊断信息
console.log('=======================================================');
console.log('生产服务器启动器 V3');
console.log('=======================================================');
console.log(`Node.js版本: ${process.version}`);
console.log(`工作目录: ${process.cwd()}`);
console.log(`启动脚本位置: ${__dirname}`);

// 验证前端资源
function validateFrontendResources() {
  console.log('\n检查前端资源位置...');
  
  // 检查所有可能的静态资源位置
  const possiblePaths = [
    join(__dirname, 'public'),
    join(rootDir, 'server/public'),
    __dirname
  ];
  
  let foundValidPath = false;
  
  for (const path of possiblePaths) {
    if (existsSync(join(path, 'index.html'))) {
      console.log(`✓ 找到有效的前端资源目录: ${path}`);
      
      // 额外检查assets目录
      if (existsSync(join(path, 'assets'))) {
        console.log(`  ✓ 包含assets目录`);
        
        try {
          const assetFiles = readdirSync(join(path, 'assets')).slice(0, 3);
          console.log(`  ✓ assets目录中的文件示例: ${assetFiles.join(', ')}${assetFiles.length > 3 ? '...' : ''}`);
        } catch (err) {
          console.log(`  ! 无法读取assets目录内容: ${err.message}`);
        }
      } else {
        console.log(`  ! 警告: 未找到assets目录`);
      }
      
      foundValidPath = true;
    }
  }
  
  if (!foundValidPath) {
    console.log('❌ 无法找到任何包含index.html的有效前端资源目录');
    
    // 尝试修复资源路径
    fixResourcePaths();
  }
}

// 修复资源路径
function fixResourcePaths() {
  console.log('\n尝试修复资源路径问题...');
  
  // 确保public目录存在
  const publicDir = join(__dirname, 'public');
  if (!existsSync(publicDir)) {
    console.log(`创建public目录: ${publicDir}`);
    mkdirSync(publicDir, { recursive: true });
  }
  
  // 检查index.html是否存在于根目录
  if (existsSync(join(__dirname, 'index.html'))) {
    console.log('找到根目录中的index.html，复制到public目录');
    copyFileSync(join(__dirname, 'index.html'), join(publicDir, 'index.html'));
  }
  
  // 检查assets是否存在于根目录
  if (existsSync(join(__dirname, 'assets'))) {
    console.log('找到根目录中的assets目录，复制到public目录');
    
    // 确保public/assets目录存在
    const publicAssetsDir = join(publicDir, 'assets');
    if (!existsSync(publicAssetsDir)) {
      mkdirSync(publicAssetsDir, { recursive: true });
    }
    
    // 复制assets内容
    copyDirectory(join(__dirname, 'assets'), publicAssetsDir);
  } else {
    console.log('未在根目录找到assets目录');
  }
  
  // 查找项目根目录下是否有这些文件
  ['dist', 'client', 'public'].forEach(dir => {
    const checkDir = join(rootDir, dir);
    if (existsSync(checkDir)) {
      console.log(`检查${dir}目录是否包含前端资源...`);
      
      if (existsSync(join(checkDir, 'index.html'))) {
        console.log(`- 找到${dir}/index.html，复制到public目录`);
        copyFileSync(join(checkDir, 'index.html'), join(publicDir, 'index.html'));
      }
      
      if (existsSync(join(checkDir, 'assets'))) {
        console.log(`- 找到${dir}/assets目录，复制到public目录`);
        copyDirectory(join(checkDir, 'assets'), join(publicDir, 'assets'));
      }
    }
  });
}

// 递归复制目录
function copyDirectory(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      if (!existsSync(destPath)) {
        mkdirSync(destPath, { recursive: true });
      }
      copyDirectory(srcPath, destPath);
    } else {
      try {
        copyFileSync(srcPath, destPath);
      } catch (err) {
        console.log(`复制文件失败: ${srcPath} -> ${destPath}: ${err.message}`);
      }
    }
  }
}

// 验证前端资源
validateFrontendResources();

// 启动服务器
function startServer() {
  console.log('\n准备启动服务器...');
  
  // 检查编译后的文件是否存在
  const indexPath = join(__dirname, 'index.js');
  
  if (existsSync(indexPath)) {
    console.log('找到编译后的服务器文件，准备导入...');
    
    // 尝试导入编译后的文件
    import('./index.js').catch(err => {
      console.error('导入编译后的服务器文件失败:', err);
      fallbackToTsx();
    });
  } else {
    console.log('找不到编译后的服务器文件，切换到备用方法...');
    fallbackToTsx();
  }
}

// 备用启动方法
function fallbackToTsx() {
  console.log('使用tsx直接运行TypeScript源文件...');
  
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

// 启动服务器
startServer();
EOF

# 使脚本可执行
chmod +x dist/start.js

echo "✅ 部署修复V3完成!"
echo "实施了全面的静态资源修复策略:"
echo "1. 修改了vite.ts中的静态资源路径解析逻辑"
echo "2. 将前端资源复制到了多个可能的位置"
echo "3. 添加了强大的自动修复和诊断功能"
echo "推荐使用以下部署命令:"
echo "  - 构建命令: bash deploy-fix-v3.sh"
echo "  - 运行命令: NODE_ENV=production node dist/start.js"