#!/usr/bin/env node

/**
 * 纯ESM生产环境启动脚本
 * 专为解决模块冲突设计
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 设置生产环境变量
process.env.NODE_ENV = 'production';

// 彩色日志
const log = {
  info: (msg) => console.log(`\x1b[36m${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m${msg}\x1b[0m`),
  warn: (msg) => console.log(`\x1b[33m${msg}\x1b[0m`)
};

log.info('启动生产服务器...');

// 检查dist是否存在
if (!fs.existsSync('./dist/index.js')) {
  log.error('错误: 构建文件不存在');
  log.info('请先构建应用: node esm-build.js');
  process.exit(1);
}

// 创建启动脚本
log.info('生成优化的启动脚本...');
const launcherScript = `
import fs from 'fs';
import { createRequire } from 'module';

// 创建一个缓存机制，避免污染全局变量
const moduleCache = new Map();
function moduleProvider(name) {
  if (!moduleCache.has(name)) {
    if (name === 'path') {
      moduleCache.set(name, await import('path'));
    } else if (name === 'url') {
      moduleCache.set(name, await import('url'));
    } else {
      const req = createRequire(import.meta.url);
      moduleCache.set(name, req(name));
    }
  }
  return moduleCache.get(name);
}

// 启动实际应用
log.info('加载应用...');
try {
  await import('./dist/index.js');
} catch (err) {
  console.error('应用启动失败:', err);
  process.exit(1);
}
`;

fs.writeFileSync('prod-launcher.js', launcherScript);

// 启动服务器
log.info('启动节点应用，使用优化的启动器脚本...');
const server = spawn('node', ['--no-warnings', './prod-launcher.js'], {
  env: { 
    ...process.env,
    NODE_ENV: 'production',
    // 添加额外的环境变量，增强ESM兼容性
    NODE_OPTIONS: '--experimental-modules --enable-source-maps'
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

// 优雅关闭处理
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    log.info(`收到${signal}信号，正在关闭服务器...`);
    server.kill(signal);
  });
});