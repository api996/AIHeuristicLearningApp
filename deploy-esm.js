#!/usr/bin/env node

/**
 * 一站式构建与部署脚本
 * 纯ESM方式，从根本上解决模块冲突
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 彩色日志
const log = {
  info: (msg) => console.log(`\x1b[36m${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m${msg}\x1b[0m`),
  warn: (msg) => console.log(`\x1b[33m${msg}\x1b[0m`)
};

try {
  // 1. 构建
  log.info('=== 开始构建应用 ===');
  execSync('node esm-build.js', { stdio: 'inherit' });
  log.success('✓ 应用构建成功');

  // 2. 启动
  log.info('\n=== 启动生产服务器 ===');
  execSync('node esm-run.js', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
} catch (error) {
  log.error(`部署失败: ${error.message}`);
  process.exit(1);
}