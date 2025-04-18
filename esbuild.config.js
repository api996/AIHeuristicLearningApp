
/**
 * esbuild.config.js - 增强的ESM版本 
 * 专门为解决生产环境下模块冲突问题而优化
 */
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

// 构建配置
const config = {
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  external: [
    'lightningcss',
    // 不要排除这些核心模块，它们需要被正确处理
    // 'module',
    // 'url',
  ],
  // 使用单一、统一的createRequire
  banner: {
    js: `
// 统一的模块导入辅助函数，避免多个createRequire定义
import { createRequire } from 'module'; 
const require = createRequire(import.meta.url);
// PostgreSQL会话存储初始化代码
import pgSessionLib from 'connect-pg-simple';
import sessionLib from 'express-session';
const PgSessionStore = pgSessionLib(sessionLib);
`
  }
};

// 执行构建过程
try {
  await build(config);
  console.log('✓ 构建完成');
} catch (error) {
  console.error('构建失败:', error);
  process.exit(1);
}
