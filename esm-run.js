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

// 全局模块映射，预先处理潜在的命名冲突
globalThis.__moduleCache = new Map();

// 预先加载关键模块到全局缓存，避免命名冲突
async function preloadCriticalModules() {
  // 工具模块
  const path = await import('path');
  const url = await import('url');
  const fs = await import('fs');
  
  // 存储到全局缓存中
  globalThis.__moduleCache.set('path', path);
  globalThis.__moduleCache.set('url', url);
  globalThis.__moduleCache.set('fs', fs);
  
  // 关键函数单独缓存
  globalThis.__moduleCache.set('fileURLToPath', url.fileURLToPath);
  globalThis.__moduleCache.set('dirname', path.dirname);
  globalThis.__moduleCache.set('join', path.join);
  globalThis.__moduleCache.set('resolve', path.resolve);
  
  // 替换模块的原生导入
  globalThis.path = path;
  globalThis.url = url;
  globalThis.fs = fs;
  
  return { path, url, fs };
}

// 全局模块提供程序，可以获取预加载的模块
function getModule(name) {
  return globalThis.__moduleCache.get(name);
}

// 简单日志工具
const log = {
  info: (msg) => console.log('[INFO] ' + msg),
  error: (msg) => console.error('[ERROR] ' + msg)
};

// 启动入口函数
async function main() {
  log.info('预加载关键模块...');
  await preloadCriticalModules();
  
  log.info('创建模块声明垫片...');
  // 为了防止其他模块的命名冲突，修补全局空间
  Object.defineProperty(globalThis, '__dirname', {
    get: function() { return getModule('dirname')(import.meta.url); }
  });
  
  Object.defineProperty(globalThis, '__filename', {
    get: function() { return getModule('fileURLToPath')(import.meta.url); }
  });
  
  log.info('加载应用...');
  try {
    await import('./dist/index.js');
    log.info('应用已成功启动');
  } catch (err) {
    log.error('应用启动失败: ' + err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// 执行主函数
main().catch(err => {
  console.error('启动器错误:', err);
  process.exit(1);
});
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