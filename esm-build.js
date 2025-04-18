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
/* ================================================
 * 全局ESM/CJS兼容层 - 预防createRequire冲突
 * ================================================ */

// 提供统一的全局require函数，避免重复createRequire声明
import { createRequire as _createRequire } from 'module';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname, join as _join } from 'path';

// 在ES模块中模拟CommonJS变量
const require = _createRequire(import.meta.url);
globalThis.require = require; // 确保全局可用

// 为ES模块环境提供 __dirname 和 __filename
const __filename = _fileURLToPath(import.meta.url);
const __dirname = _dirname(__filename);
globalThis.__filename = __filename;
globalThis.__dirname = __dirname;

// 禁用其他模块中的createRequire导入
import { createRequire } from 'module';
export { createRequire }; // 导出以阻止其他模块重新导入

// 会话存储初始化 (预先加载关键CJS模块)
import expressSession from 'express-session';
import pgSessionInit from 'connect-pg-simple';
// 改名以避免冲突，使用下划线前缀
const _PgSessionStore = pgSessionInit(expressSession);
globalThis._PgSessionStore = _PgSessionStore; // 全局可用

// 确保MemoryStore也可用
const _MemoryStore = expressSession.MemoryStore;
globalThis._MemoryStore = _MemoryStore; // 全局可用
`
  }
};

// 执行构建
try {
  await build(config);
  console.log('✓ 后端构建完成');
  
  // 后处理：获取构建后文件并处理createRequire声明
  // 注意：这个步骤是可选的，因为我们的banner已经预防了大部分问题
  console.log('后处理构建文件（静默模式）...');
  const indexPath = path.join(distDir, 'index.js');
  if (!fs.existsSync(indexPath)) {
    throw new Error('构建文件不存在');
  }
  
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // 计算初始出现次数
  const initialCount = (content.match(/createRequire/g) || []).length;
  
  // 保留原始banner中定义的createRequire，移除其他导入
  // 使用更精确的正则表达式，减少错误匹配
  const importPatterns = [
    'import { createRequire } from "module";',
    'import { createRequire } from \'module\';',
    'import { createRequire as __createRequire } from "module";',
    'import { createRequire as __createRequire } from \'module\';',
    'import { createRequire as __cjs_createRequire } from "node:module";',
    'import { createRequire as __cjs_createRequire } from \'node:module\';'
  ];
  
  // 在文件内容的开头（跳过我们的banner）查找第一个导入声明之后的位置
  const skipBannerPos = content.indexOf('// 禁用其他模块中的createRequire导入');
  if (skipBannerPos === -1) {
    console.log('警告: 未找到banner标记，可能导致处理不完整');
  }
  
  const startPos = skipBannerPos > 0 ? content.indexOf('\n', skipBannerPos) + 1 : 0;
  
  // 在这个位置之后查找并替换所有匹配的导入语句
  let replacedCount = 0;
  let processedContent = content.substring(0, startPos);
  
  const restContent = content.substring(startPos);
  let modifiedRestContent = restContent;
  
  for (const pattern of importPatterns) {
    let pos = 0;
    let maxReplacements = 100; // 安全限制，防止无限循环
    
    while ((pos = modifiedRestContent.indexOf(pattern, pos)) !== -1 && maxReplacements-- > 0) {
      modifiedRestContent = 
        modifiedRestContent.substring(0, pos) + 
        '/* 已优化模块导入 */' + 
        modifiedRestContent.substring(pos + pattern.length);
      
      replacedCount++;
      // 避免在同一位置重复搜索
      pos += 20;
    }
  }
  
  // 组合最终内容
  const finalContent = processedContent + modifiedRestContent;
  
  // 保存修改后的文件
  fs.writeFileSync(indexPath, finalContent);
  
  // 只显示简单的统计信息，不显示详细日志
  console.log(`优化完成: 发现${initialCount}个相关引用，优化了${replacedCount}个导入声明`);
  console.log('✓ 构建文件处理完成');
  
  console.log('\n✅ 构建全部完成！');
  console.log('可通过以下命令启动应用:');
  console.log('NODE_ENV=production node dist/index.js');
} catch (error) {
  console.error('构建失败:', error);
  process.exit(1);
}