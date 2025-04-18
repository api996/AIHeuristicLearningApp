#!/usr/bin/env node
/**
 * 生产环境直接启动脚本
 * 只有纯JS代码，最小化启动冲突
 */
console.log('[INFO] 启动生产环境应用 (直接模式)');
console.log('[INFO] 时间:', new Date().toISOString());

// 确保环境变量正确设置
process.env.NODE_ENV = 'production';

// 运行应用，使用child_process直接调用node的tsx执行
import { spawn } from 'child_process';

// 使用子进程启动，使用不同端口以避免与开发服务器冲突
const proc = spawn('npx', ['tsx', 'server/index.ts'], { 
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '5001' // 使用不同端口
  }
});

// 处理进程结束
proc.on('close', (code) => {
  console.log(`应用进程退出，返回码 ${code}`);
  process.exit(code);
});
