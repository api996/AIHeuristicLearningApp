#!/usr/bin/env node

/**
 * 直接生产环境启动脚本
 * 绕过ESM/CJS模块冲突问题 
 * 使用ES模块语法
 */

// 使用child_process直接调用原始文件
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 设置生产环境变量
process.env.NODE_ENV = 'production';

console.log('启动生产服务器...');

try {
  // 检查dist是否存在
  if (!fs.existsSync('./dist/index.js')) {
    console.error('错误: 找不到构建文件。请先运行: node scripts/build-fixed.js');
    process.exit(1);
  }

  // 使用子进程启动服务器，绕过模块系统
  const server = spawn('node', ['./dist/index.js'], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit'
  });

  server.on('error', (err) => {
    console.error('服务器启动错误:', err);
    process.exit(1);
  });

  server.on('close', (code) => {
    if (code !== 0) {
      console.error(`服务器进程已退出，代码: ${code}`);
      process.exit(code);
    }
  });

  // 处理进程信号
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      console.log(`收到 ${signal} 信号，正在关闭服务器...`);
      server.kill(signal);
    });
  });
} catch (error) {
  console.error('启动服务器时出错:', error);
  process.exit(1);
}