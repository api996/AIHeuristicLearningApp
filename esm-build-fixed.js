#!/usr/bin/env node
/**
 * 纯ESM生产构建脚本 - 修复版
 * 专门解决ESM环境下的模块冲突问题
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';
import esbuild from 'esbuild';

// 设置一些基本路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outDir = join(__dirname, 'dist');
const entryPoint = join(__dirname, 'server', 'index.ts');

// 日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 清理构建目录
log('清理构建目录...');
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir);
fs.mkdirSync(join(outDir, 'public'));

// 前端构建
log('构建前端...');
try {
  execSync('npx vite build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  // 处理前端构建文件
  if (fs.existsSync('./dist/public/index.html')) {
    log('前端已构建在正确位置', 'success');
  } 
  else if (fs.existsSync('./dist/index.html')) {
    log('正在复制前端文件到public子目录...', 'info');
    
    if (!fs.existsSync('./dist/public')) {
      fs.mkdirSync('./dist/public', { recursive: true });
    }
    
    // 复制所有文件
    const files = fs.readdirSync('./dist');
    files.forEach(file => {
      if (file !== 'public' && file !== 'index.js' && file !== 'index.js.map') {
        const src = join('./dist', file);
        const dest = join('./dist/public', file);
        
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    });
  } else {
    log('未找到前端构建文件，跳过前端处理', 'warn');
  }
  
  log('前端处理完成', 'success');
} catch (error) {
  log('前端构建失败: ' + error.message, 'error');
  console.error(error);
  log('继续执行后端构建...', 'warn');
}

// 创建后端启动脚本
log('创建后端启动脚本...');

// 直接使用 tsup 构建，tsup 专门为 TypeScript 项目设计，更好地处理 ESM
const backendBuildCommand = 'npx tsup server/index.ts --format=esm --target=node16 --sourcemap --clean --out-dir=dist';

// 执行构建
try {
  execSync(backendBuildCommand, { stdio: 'inherit' });
  log('后端构建完成', 'success');
} catch (error) {
  log('后端构建失败: ' + error.message, 'error');
  console.error(error);
  process.exit(1);
}

// 创建生产环境启动脚本
const startScript = `#!/usr/bin/env node
/**
 * 生产环境启动入口
 * 包含环境初始化和兼容性修复
 */
console.log('[INFO] 启动生产环境应用...');
console.log('[INFO] 时间:', new Date().toISOString());

// 导入必要的模块
import * as fs from 'fs';

// ESM 导入应用
import './dist/index.js';
`;

fs.writeFileSync('start-prod.js', startScript);
fs.chmodSync('start-prod.js', '755');
log('已创建启动脚本: start-prod.js', 'success');

log(`部署完成! 使用以下命令启动:`, 'success');
log('NODE_ENV=production node start-prod.js', 'info');