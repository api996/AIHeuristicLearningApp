#!/usr/bin/env node

/**
 * 纯ESM生产构建脚本
 * 专门解决重复createRequire声明问题
 */

import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 清理构建目录
console.log('清理构建目录...');
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
console.log('✓ 清理完成');

// 前端构建
console.log('开始构建前端...');
import { execSync } from 'child_process';
execSync('npx vite build', { stdio: 'inherit' });
console.log('✓ 前端构建完成');

// 后端构建配置
console.log('开始构建后端...');
const config = {
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  external: [
    'lightningcss',
    'pg-native',
    '@neondatabase/drivers',
  ],
  // 解决createRequire冲突的关键：在文件顶部添加全局声明
  banner: {
    js: `
// ======== 全局ESM/CJS兼容层 ========
// 提供统一的模块解析机制，避免重复createRequire声明
import { createRequire as _createRequire } from 'module';
const require = _createRequire(import.meta.url);
// 禁用其他模块中的createRequire导入，确保使用这一个全局实例
import { createRequire } from 'module';
export { createRequire };
// ======== 会话存储初始化 ========
import pgSessionInit from 'connect-pg-simple';
import expressSession from 'express-session';
const PgSession = pgSessionInit(expressSession);
`
  }
};

// 执行构建
try {
  await build(config);
  console.log('✓ 后端构建完成');
  
  // 后处理：获取构建后文件并处理createRequire声明
  console.log('后处理构建文件...');
  const indexPath = path.join(distDir, 'index.js');
  if (!fs.existsSync(indexPath)) {
    throw new Error('构建文件不存在');
  }
  
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // 替换所有createRequire相关导入（除了我们的banner中定义的）
  const createRequireImportPatterns = [
    /import\s*{\s*createRequire\s*}\s*from\s*['"]module['"];/g,
    /import\s*{\s*createRequire\s*}\s*from\s*['"]node:module['"];/g,
    /import\s*{\s*createRequire\s+as\s+[^}]+\s*}\s*from\s*['"]module['"];/g,
    /import\s*{\s*createRequire\s+as\s+[^}]+\s*}\s*from\s*['"]node:module['"];/g,
  ];

  for (const pattern of createRequireImportPatterns) {
    content = content.replace(pattern, '/* 已移除重复导入 */');
  }

  // 保存修改后的文件
  fs.writeFileSync(indexPath, content);
  console.log('✓ 构建文件处理完成');
  
  console.log('\n✅ 构建全部完成！');
  console.log('可通过以下命令启动应用:');
  console.log('NODE_ENV=production node dist/index.js');
} catch (error) {
  console.error('构建失败:', error);
  process.exit(1);
}