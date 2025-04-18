/**
 * 前端构建脚本
 */

import { execSync } from 'child_process';

console.log('开始构建前端...');

try {
  // 清理旧的构建文件
  console.log('清理旧构建文件...');
  execSync('rm -rf dist', { stdio: 'inherit' });
  execSync('rm -rf server/public', { stdio: 'inherit' });
  
  // 使用Vite构建前端
  console.log('使用Vite构建前端...');
  execSync('npx vite build', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  // 运行静态文件路径修复脚本
  console.log('修复静态文件路径...');
  execSync('node fix-static-path.js', { stdio: 'inherit' });
  
  console.log('前端构建完成!');
} catch (error) {
  console.error('构建出错:', error.message);
  process.exit(1);
}