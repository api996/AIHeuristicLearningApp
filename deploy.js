/**
 * 简化版部署脚本
 * 一键式构建与部署
 */

import { execSync } from 'child_process';

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

async function deploy() {
  try {
    log('=== 开始部署流程 ===', 'info');
    log('步骤 1/2: 构建前端...', 'info');
    
    // 运行前端构建脚本
    execSync('node build-frontend.js', { stdio: 'inherit' });
    
    log('步骤 2/2: 启动生产服务器...', 'success');
    
    // 启动生产服务器
    execSync('node production.js', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
  } catch (error) {
    log(`部署失败: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 执行部署
deploy();