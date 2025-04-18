/**
 * 构建后处理脚本
 * 解决 createRequire 重复声明问题
 * 使用ES模块语法
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取dist/index.js文件路径
const indexPath = path.join(process.cwd(), 'dist', 'index.js');

console.log('正在处理构建文件: ' + indexPath);

// 读取文件内容
if (!fs.existsSync(indexPath)) {
  console.error('错误: 找不到构建文件，请先运行构建脚本');
  process.exit(1);
}

let content = fs.readFileSync(indexPath, 'utf8');

// 计算 createRequire 出现次数
const createRequireCount = (content.match(/createRequire/g) || []).length;
console.log(`检测到 ${createRequireCount} 处 createRequire 引用`);

// 策略: 替换除第一次出现外的所有 createRequire 导入
// 使用简单字符串替换，避免复杂的正则表达式
const createRequireImportPatterns = [
  'import { createRequire } from "module";',
  'import { createRequire } from \'module\';',
  'import { createRequire as __cjs_createRequire } from "node:module";',
  'import { createRequire as __cjs_createRequire } from \'node:module\';'
];

// 记录第一次出现的位置，后续的都替换掉
let firstOccurrence = false;

for (const pattern of createRequireImportPatterns) {
  let patternIndex = content.indexOf(pattern);
  
  while (patternIndex !== -1) {
    if (!firstOccurrence) {
      // 第一次出现，标记并保留
      firstOccurrence = true;
      console.log(`保留第一个 createRequire 导入: ${pattern}`);
    } else {
      // 后续出现，替换为注释
      const replacement = `// 已移除重复导入: ${pattern}`;
      content = content.substring(0, patternIndex) + 
                replacement + 
                content.substring(patternIndex + pattern.length);
      console.log('替换了一个重复的 createRequire 导入');
    }
    
    // 查找下一个出现位置
    patternIndex = content.indexOf(pattern, patternIndex + 1);
  }
}

// 处理带有别名的导入
const aliasPatterns = [
  /import\s*{\s*createRequire\s+as\s+([^}]+?)\s*}\s*from\s*['"]node:module['"]/g,
  /import\s*{\s*createRequire\s+as\s+([^}]+?)\s*}\s*from\s*['"]module['"]/g
];

if (firstOccurrence) {
  for (const pattern of aliasPatterns) {
    content = content.replace(pattern, (match) => {
      console.log(`注释别名导入: ${match}`);
      return `// 已移除重复导入: ${match}`;
    });
  }
}

// 写回文件
fs.writeFileSync(indexPath, content);
console.log('✓ 已修复构建文件中的 createRequire 冲突');