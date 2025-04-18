/**
 * 前端构建脚本
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 色彩日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

log('开始构建前端...', 'info');

try {
  // 清理旧的构建文件
  log('清理旧构建文件...', 'info');
  execSync('rm -rf dist', { stdio: 'inherit' });
  execSync('rm -rf server/public', { stdio: 'inherit' });
  
  // 使用Vite构建前端
  log('使用Vite构建前端...', 'info');
  execSync('npx vite build', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  // 运行静态文件路径修复脚本 
  log('修复静态文件路径...', 'info');
  execSync('node fix-static-path.js', { stdio: 'inherit' });
  
  log('前端构建完成!', 'success');
} catch (error) {
  log(`构建出错: ${error.message}`, 'error');
  process.exit(1);
}