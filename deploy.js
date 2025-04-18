#!/usr/bin/env node
/**
 * 简化版部署脚本
 * 一键式构建与部署
 */

import { execSync } from 'child_process';
import { spawn } from 'child_process';

// 彩色日志
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',    // 蓝色
    success: '\x1b[32m', // 绿色
    error: '\x1b[31m',   // 红色
    warn: '\x1b[33m',    // 黄色
    reset: '\x1b[0m'     // 重置
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

async function deploy() {
  try {
    // 1. 构建前端
    log('开始构建前端...');
    execSync('node build-frontend.js', { stdio: 'inherit' });
    log('前端构建完成！', 'success');
    
    // 2. 启动生产服务器
    log('启动生产服务器...', 'warn');
    
    // 设置环境变量
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '5001'
    };
    
    // 关闭可能正在运行的服务器
    try {
      log('关闭可能正在运行的服务器...');
      execSync('pkill -f "tsx server/index.ts" || true', { stdio: 'inherit' });
      execSync('kill $(lsof -t -i:5001) 2>/dev/null || true', { stdio: 'inherit' });
    } catch (error) {
      // 忽略关闭错误
    }
    
    // 启动生产服务器
    const server = spawn('npx', ['tsx', 'server/index.ts'], { 
      stdio: 'inherit',
      env: env
    });
    
    server.on('close', (code) => {
      if (code !== 0) {
        log(`服务器异常退出，代码: ${code}`, 'error');
        process.exit(code);
      }
    });
    
    log('部署完成！应用现在可以通过端口5001访问。', 'success');
    log('您可以通过 https://your-repl-name.replit.app 访问已部署的应用。', 'info');
    
    // 等待服务器运行
    process.stdin.resume();
    
  } catch (error) {
    log(`部署失败: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 执行部署
deploy().catch(error => {
  log(`部署出错: ${error.message}`, 'error');
  process.exit(1);
});