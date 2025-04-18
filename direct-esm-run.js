#!/usr/bin/env node
/**
 * 直接生产环境启动脚本
 * 使用直接预加载的方式解决模块冲突
 */

import fs from 'fs';
import { createRequire } from 'module';
import { spawn } from 'child_process';

// 简单日志工具
const log = {
  info: (msg) => console.log('[INFO] ' + msg),
  error: (msg) => console.error('[ERROR] ' + msg),
  warn: (msg) => console.warn('[WARN] ' + msg),
  success: (msg) => console.log('[SUCCESS] ' + msg)
};

// 检查构建文件是否存在
if (!fs.existsSync('./dist/index.js')) {
  log.error('未找到构建文件，请先运行构建: node esm-build.js');
  process.exit(1);
}

log.info('创建生产环境启动器...');

// 创建启动器
const appPreloader = `
import fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import * as url from 'url';

// 预加载关键的内置模块到全局命名空间，防止命名冲突
globalThis.__path = path;
globalThis.__url = url;
globalThis.__fs = fs;
globalThis.__fileURLToPath = url.fileURLToPath;
globalThis.__dirname = path.dirname(url.fileURLToPath(import.meta.url));
globalThis.__require = createRequire(import.meta.url);

// 确保 Common.js 变量在 ESM 环境中可用
console.log('[INFO] 正在启动生产服务...');
console.log('[INFO] 工作目录:', process.cwd());
console.log('[INFO] 应用目录:', globalThis.__dirname);

// 导入应用程序
try {
  const app = await import('./dist/index.js');
  console.log('[SUCCESS] 应用程序已成功加载');
} catch (error) {
  console.error('[ERROR] 应用程序加载失败:', error);
  process.exit(1);
}
`;

// 写入启动器文件
fs.writeFileSync('production-loader.js', appPreloader);
log.success('启动器已创建');

// 启动应用
log.info('启动生产环境应用...');
const server = spawn('node', ['--no-warnings', 'production-loader.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production'
  },
  stdio: 'inherit'
});

// 错误处理
server.on('error', (err) => {
  log.error(`服务器启动错误: ${err.message}`);
  process.exit(1);
});

server.on('close', (code) => {
  if (code !== 0) {
    log.error(`服务器已退出，退出码: ${code}`);
    process.exit(code);
  }
});

// 优雅关闭
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    log.info(`收到${signal}信号，正在关闭服务器...`);
    server.kill(signal);
  });
});