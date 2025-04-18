/**
 * 静态文件路径修复脚本
 * 将构建后的静态文件复制到服务器能找到的位置
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 源文件目录 (Vite构建输出)
const sourceDir = path.resolve(__dirname, 'dist', 'public');
// 目标目录 (服务器查找静态文件的位置)
const targetDir = path.resolve(__dirname, 'server', 'public');

// 简单的日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

/**
 * 递归复制目录
 */
function copyDir(src, dest) {
  // 确保目标目录存在
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      log(`复制: ${srcPath} → ${destPath}`, 'info');
    }
  }
}

/**
 * 主函数
 */
function main() {
  try {
    // 检查源目录是否存在
    if (!fs.existsSync(sourceDir)) {
      log(`源目录不存在: ${sourceDir}，请先运行构建命令`, 'error');
      process.exit(1);
    }
    
    // 确保目标目录存在
    if (fs.existsSync(targetDir)) {
      log(`清空目标目录: ${targetDir}`, 'info');
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    
    log(`开始复制文件从 ${sourceDir} 到 ${targetDir}`, 'info');
    copyDir(sourceDir, targetDir);
    
    log('静态文件复制完成', 'success');
    
    // 检查index.html
    const indexPath = path.join(targetDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      log(`index.html 存在于 ${indexPath}`, 'success');
    } else {
      log(`警告: index.html 不存在于 ${indexPath}`, 'error');
    }
  } catch (error) {
    log(`出错: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 执行主函数
main();