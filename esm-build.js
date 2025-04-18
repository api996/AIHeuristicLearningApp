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
import { createRequire as __cjsCreateRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import * as path from 'path';
import * as url from 'url';

// 在ES模块中模拟CommonJS变量 - 使用唯一前缀避免命名冲突
const require = __cjsCreateRequire(import.meta.url);
globalThis.require = require; // 确保全局可用

// 为ES模块环境提供 __dirname 和 __filename - 使用命名空间避免冲突
const __filename = __fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
globalThis.__filename = __filename;
globalThis.__dirname = __dirname;
globalThis.__path = path; // 提供path作为全局变量
globalThis.__url = url;   // 提供url作为全局变量
globalThis.__fileURLToPath = __fileURLToPath; // 导出fileURLToPath函数

// 禁用其他模块中的createRequire导入 - 使用相同的名称
import { createRequire as createRequire } from 'module';
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
  // 使用更精确的字符串匹配，减少错误匹配
  const importPatterns = [
    'import { createRequire } from "module";',
    'import { createRequire } from \'module\';',
    'import { createRequire } from "node:module";',
    'import { createRequire } from \'node:module\';',
    // 别名匹配
    'import { createRequire as _createRequire } from "module";', 
    'import { createRequire as _createRequire } from \'module\';',
    'import { createRequire as __createRequire } from "module";',
    'import { createRequire as __createRequire } from \'module\';',
    'import { createRequire as __cjs_createRequire } from "node:module";',
    'import { createRequire as __cjs_createRequire } from \'node:module\';'
  ];
  
  // 额外处理 path 相关导入，替换 node:path 导入，减少冲突
  let pathFixCount = 0;
  
  // 处理解构导入冲突
  if (content.includes('import { resolve, basename, extname, dirname } from "node:path";')) {
    console.log('发现 path 解构导入冲突，正在修复...');
    content = content.replace(
      'import { resolve, basename, extname, dirname } from "node:path";',
      '/* 使用全局 __path 命名空间代替解构导入 */\n' +
      'const { resolve, basename, extname, dirname } = globalThis.__path || path;'
    );
    pathFixCount++;
  }
  
  // 处理命名导入冲突
  if (content.includes('import path, { resolve as resolve2 } from "node:path";')) {
    console.log('发现 path 命名导入冲突，正在修复...');
    content = content.replace(
      'import path, { resolve as resolve2 } from "node:path";',
      '/* 使用全局 __path 命名空间替代命名导入 */\n' +
      'const path2 = globalThis.__path || path;\n' +
      'const { resolve: resolve2 } = path2;'
    );
    pathFixCount++;
  }
  
  // 处理简单命名冲突
  if (content.includes('import path from "node:path";') || content.includes('import path from \'node:path\';')) {
    console.log('发现 path 基本导入冲突，正在修复...');
    content = content.replace(
      /import path from ["']node:path["'];/g,
      '/* 使用全局 __path 命名空间替代导入 */\n' +
      'const path = globalThis.__path;'
    );
    pathFixCount++;
  }
  
  if (pathFixCount > 0) {
    console.log(`共修复了 ${pathFixCount} 处 path 模块相关导入冲突`);
  }
  
  // 处理 url 模块和 fileURLToPath 相关冲突
  let urlFixCount = 0;
  
  // 处理 fileURLToPath 导入冲突
  if (content.includes('import { fileURLToPath } from "node:url";') || 
      content.includes('import { fileURLToPath } from \'node:url\';') ||
      content.includes('import { fileURLToPath } from "url";') ||
      content.includes('import { fileURLToPath } from \'url\';')) {
    console.log('发现 fileURLToPath 导入冲突，正在修复...');
    
    // 替换所有可能的导入模式
    let newContent = content;
    const urlImportPatterns = [
      'import { fileURLToPath } from "node:url";',
      'import { fileURLToPath } from \'node:url\';',
      'import { fileURLToPath } from "url";',
      'import { fileURLToPath } from \'url\';'
    ];
    
    for (const pattern of urlImportPatterns) {
      if (newContent.includes(pattern)) {
        newContent = newContent.replace(
          pattern,
          '/* 使用全局 __fileURLToPath 函数替代导入 */\n' +
          'const fileURLToPath = globalThis.__fileURLToPath;'
        );
        urlFixCount++;
      }
    }
    
    content = newContent;
  }
  
  if (urlFixCount > 0) {
    console.log(`共修复了 ${urlFixCount} 处 url 模块相关导入冲突`);
  }

  // 在文件内容的开头（跳过我们的banner）查找第一个导入声明之后的位置
  let skipBannerPos = content.indexOf('// 禁用其他模块中的createRequire导入 - 使用相同的名称');
  if (skipBannerPos === -1) {
    console.log('警告: 未找到banner标记，尝试查找替代标记');
    // 尝试查找旧标记
    const oldMarkerPos = content.indexOf('// 禁用其他模块中的createRequire导入');
    if (oldMarkerPos !== -1) {
      console.log('找到旧版本的标记，将使用它');
      skipBannerPos = oldMarkerPos;
    }
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