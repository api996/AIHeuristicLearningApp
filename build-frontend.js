#!/usr/bin/env node
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
