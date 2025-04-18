/**
 * 生产环境启动脚本
 * 极简化版本，解决端口冲突和访问问题
 */

// 导入子进程模块
import { spawn } from 'child_process';

// 设置正确的环境和端口
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '5000' // 使用默认的5000端口
};

console.log('启动生产环境应用...');
console.log('时间:', new Date().toISOString());

// 使用tsx直接运行TypeScript
const server = spawn('npx', ['tsx', 'server/index.ts'], { 
  stdio: 'inherit',
  env: env
});

// 处理服务器进程结束
server.on('close', (code) => {
  console.log(`服务器进程已结束，退出码: ${code}`);
  process.exit(code);
});

// 处理终止信号
process.on('SIGINT', () => {
  console.log('接收到SIGINT信号，关闭服务器...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('接收到SIGTERM信号，关闭服务器...');
  server.kill('SIGTERM');
});