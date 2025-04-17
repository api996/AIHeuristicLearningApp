/**
 * 生产环境启动脚本
 * 
 * 这个脚本尝试多种方式启动服务器:
 * 1. 首先尝试使用编译后的dist/index.js
 * 2. 如果失败，使用tsx直接运行TypeScript文件
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 检查编译后的文件是否存在
const compiledPath = join(__dirname, 'dist', 'index.js');
const serverTsPath = join(__dirname, 'server', 'index.ts');

console.log('生产环境启动中...');
console.log(`Node.js版本: ${process.version}`);

let serverProcess;

if (fs.existsSync(compiledPath)) {
  console.log('使用编译后的文件启动服务器...');
  serverProcess = spawn('node', [compiledPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
} else {
  // 如果编译后文件不存在，使用tsx
  console.log('编译后文件不存在，使用tsx直接运行TypeScript...');
  serverProcess = spawn('npx', ['tsx', serverTsPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
}

// 处理服务器进程退出
serverProcess.on('exit', (code) => {
  console.log(`服务器进程退出，退出码: ${code}`);
  if (code !== 0) {
    console.log('服务器异常退出，尝试使用备用方法...');
    
    // 如果第一种方法失败，尝试另一种方法
    const useCompiled = serverProcess.spawnargs.includes('node');
    
    if (useCompiled) {
      console.log('尝试使用tsx作为备用方法...');
      const backupProcess = spawn('npx', ['tsx', serverTsPath], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'production'
        }
      });
      
      backupProcess.on('exit', (backupCode) => {
        process.exit(backupCode);
      });
    } else {
      process.exit(code);
    }
  } else {
    process.exit(0);
  }
});

// 处理进程信号
process.on('SIGINT', () => {
  console.log('收到终止信号，正在关闭服务器...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  serverProcess.kill('SIGTERM');
});