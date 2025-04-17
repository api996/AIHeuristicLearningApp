// ESM兼容的启动脚本
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 尝试直接用tsx运行源文件
console.log('使用tsx直接运行TypeScript源文件...');
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

// 处理进程退出
serverProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`服务器异常退出，退出码：${code}`);
  }
  process.exit(code);
});

// 处理信号
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});