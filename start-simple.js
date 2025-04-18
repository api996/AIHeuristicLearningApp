#!/usr/bin/env node
/**
 * 简化版生产环境启动脚本
 */
console.log('启动生产环境应用 - ' + new Date().toISOString());

// 设置环境变量
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5001'; // 使用不同端口避免冲突

// 直接使用tsx运行
import { spawn } from 'child_process';

const server = spawn('npx', ['tsx', 'server/index.ts'], { 
  stdio: 'inherit',
  env: process.env 
});

server.on('close', (code) => {
  console.log(`服务器进程退出，代码: ${code}`);
  process.exit(code);
});

// 处理进程信号
process.on('SIGINT', () => {
  console.log('接收到中断信号，关闭服务器...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('接收到终止信号，关闭服务器...');
  server.kill('SIGTERM');
});