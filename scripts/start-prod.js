#!/usr/bin/env node

/**
 * 生产环境启动助手脚本
 * 一键构建并启动生产服务器
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// 彩色输出函数
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 构建应用
    log('【步骤1/2】构建应用...', 'blue');
    
    try {
      execSync('node scripts/build-fixed.js', { 
        stdio: 'inherit',
        cwd: rootDir
      });
      log('✓ 构建成功', 'green');
    } catch (error) {
      log('❌ 构建失败', 'red');
      log(error.message, 'red');
      process.exit(1);
    }
    
    // 2. 启动服务器
    log('\n【步骤2/2】启动生产服务器...', 'blue');
    execSync('node direct-prod.js', { 
      stdio: 'inherit',
      cwd: rootDir,
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
  } catch (error) {
    log('❌ 启动过程中出错:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// 执行主函数
main();