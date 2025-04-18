#!/usr/bin/env node
/**
 * 直接ESM启动脚本
 * 使用 tsx 直接执行 TypeScript，无需预构建和捆绑
 */
console.log('[INFO] 直接ESM模式启动应用...');
console.log('[INFO] 时间:', new Date().toISOString());
console.log('[INFO] 环境:', process.env.NODE_ENV || 'development');

// 使用子进程启动方式，避免模块冲突
import { spawn } from 'child_process';

// 使用子进程启动
const proc = spawn('npx', ['tsx', 'server/index.ts'], { 
  stdio: 'inherit',
  env: process.env
});

// 处理进程结束
proc.on('close', (code) => {
  console.log(`应用进程退出，返回码 ${code}`);
  process.exit(code);
});
