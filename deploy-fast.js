#!/usr/bin/env node
/**
 * 快速生产部署脚本
 * 简化的构建过程，专注于解决关键问题
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// 基本设置
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 简单日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 主函数
async function deploy() {
  try {
    // 1. 构建前端
    log('构建前端...');
    execSync('npx vite build', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    log('前端构建完成', 'success');

    // 2. 创建一个简单的生产启动脚本
    log('创建启动脚本...');
    const startScript = `#!/usr/bin/env node
/**
 * 生产环境启动脚本
 */
console.log('启动生产环境应用 - ' + new Date().toISOString());

// 设置环境变量
process.env.NODE_ENV = 'production';

// 直接使用tsx运行
import { spawnSync } from 'child_process';
spawnSync('npx', ['tsx', 'server/index.ts'], { 
  stdio: 'inherit',
  env: process.env 
});
`;

    fs.writeFileSync('start-prod.js', startScript);
    fs.chmodSync('start-prod.js', '755');
    log('启动脚本创建完成', 'success');

    // 输出使用说明
    log('部署完成!', 'success');
    log('运行命令: NODE_ENV=production node start-prod.js', 'info');
  } catch (error) {
    log('部署失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

// 执行部署
deploy().catch(err => {
  log(`部署出错: ${err.message}`, 'error');
  process.exit(1);
});