#!/usr/bin/env node
/**
 * 简化的构建和启动脚本
 * 单一文件，无依赖，直接可用
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';

// 彩色日志工具
function log(message, color = 'blue') {
  const colors = {
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color]}[${new Date().toISOString()}]${colors.reset} ${message}`);
}

// 1. 构建前端
async function buildFrontend() {
  log('开始构建前端...');
  try {
    execSync('npx vite build', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    log('前端构建成功!', 'green');
    return true;
  } catch (error) {
    log(`前端构建失败: ${error.message}`, 'red');
    return false;
  }
}

// 2. 启动服务器
async function startServer() {
  log('启动生产服务器...', 'yellow');
  
  // 设置环境变量
  const env = { 
    ...process.env, 
    NODE_ENV: 'production',
    PORT: '5001'  // 使用不同端口避免冲突
  };
  
  // 直接使用tsx运行TypeScript服务器
  const server = spawn('npx', ['tsx', 'server/index.ts'], { 
    stdio: 'inherit',
    env: env
  });
  
  server.on('close', (code) => {
    if (code === 0) {
      log('服务器正常关闭', 'yellow');
    } else {
      log(`服务器异常退出, 代码: ${code}`, 'red');
    }
    process.exit(code);
  });
  
  // 处理进程信号
  process.on('SIGINT', () => {
    log('接收到中断信号，关闭服务器...', 'yellow');
    server.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    log('接收到终止信号，关闭服务器...', 'yellow');
    server.kill('SIGTERM');
  });
}

// 主函数
async function main() {
  log('=== 生产环境构建启动工具 ===', 'green');
  // 首先构建前端
  const buildSuccess = await buildFrontend();
  
  if (buildSuccess) {
    // 启动生产服务器
    await startServer();
  } else {
    log('由于构建失败，服务器未启动', 'red');
    process.exit(1);
  }
}

// 运行
main().catch(error => {
  log(`发生错误: ${error.message}`, 'red');
  process.exit(1);
});