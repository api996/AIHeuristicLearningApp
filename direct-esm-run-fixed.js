#!/usr/bin/env node
/**
 * 直接ESM启动脚本 - 修复版
 * 使用swc直接转译而不是捆绑，避免模块解析冲突
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';

// 设置一些基本路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 日志函数
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

log('直接ESM启动模式 - 优化版');

// 创建一个自定义的启动脚本
const customStartScript = `#!/usr/bin/env node
/**
 * 直接ESM启动脚本
 * 使用 tsx 直接执行 TypeScript，无需预构建和捆绑
 */
console.log('[INFO] 直接ESM模式启动应用...');
console.log('[INFO] 时间:', new Date().toISOString());
console.log('[INFO] 环境:', process.env.NODE_ENV || 'development');

// 使用 tsx 运行 TypeScript 代码 - 使用动态导入
import('tsx').then(tsx => {
  tsx.runMain('server/index.ts');
});
`;

log('创建直接启动脚本...');
fs.writeFileSync('start-direct.js', customStartScript);
fs.chmodSync('start-direct.js', '755');

log('创建前端构建脚本...');
const frontendBuildScript = `#!/usr/bin/env node
/**
 * 前端构建脚本
 */
console.log('[INFO] 构建前端...');

import { execSync } from 'child_process';

try {
  execSync('npx vite build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  console.log('[SUCCESS] 前端构建完成');
} catch (error) {
  console.error('[ERROR] 前端构建失败:', error);
  process.exit(1);
}
`;

fs.writeFileSync('build-frontend.js', frontendBuildScript);
fs.chmodSync('build-frontend.js', '755');

// 添加直接生产启动脚本
const prodStartScript = `#!/usr/bin/env node
/**
 * 生产环境直接启动脚本
 * 只有纯JS代码，最小化启动冲突
 */
console.log('[INFO] 启动生产环境应用 (直接模式)');
console.log('[INFO] 时间:', new Date().toISOString());

// 确保环境变量正确设置
process.env.NODE_ENV = 'production';

// 运行应用 - 使用动态导入
import('tsx').then(tsx => {
  tsx.runMain('server/index.ts');
});
`;

fs.writeFileSync('start-prod-direct.js', prodStartScript);
fs.chmodSync('start-prod-direct.js', '755');

log('完成!', 'success');
log('前端构建命令: node build-frontend.js', 'info');
log('生产环境启动命令: NODE_ENV=production node start-prod-direct.js', 'info');