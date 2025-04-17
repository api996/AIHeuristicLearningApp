/**
 * 生产环境优化启动脚本
 * 用于在部署环境中启动应用并处理错误
 */

// 设置生产环境
process.env.NODE_ENV = 'production';

// 导入模块
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// 确保dist目录存在
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  console.error('错误: dist目录不存在，请先运行构建命令');
  process.exit(1);
}

// 确保入口文件存在
const indexFile = path.join(distDir, 'index.js');
if (!fs.existsSync(indexFile)) {
  console.error('错误: dist/index.js不存在，构建可能失败');
  process.exit(1);
}

console.log('启动生产环境应用...');

// 启动应用
const app = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

// 处理应用退出
app.on('exit', (code) => {
  if (code !== 0) {
    console.error(`应用异常退出，退出码: ${code}`);
    process.exit(code);
  }
});

// 处理进程信号
process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭应用...');
  app.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭应用...');
  app.kill('SIGTERM');
});