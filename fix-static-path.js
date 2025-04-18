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
      try {
        // 读取源文件内容
        const srcBuffer = fs.readFileSync(srcPath);
        
        // 进行文件复制
        fs.copyFileSync(srcPath, destPath);
        
        // 验证文件复制是否成功
        const srcStat = fs.statSync(srcPath);
        const destStat = fs.statSync(destPath);
        
        // 检查文件大小是否一致
        if (srcStat.size !== destStat.size) {
          log(`警告: 文件大小不匹配 ${srcPath} (${srcStat.size}) vs ${destPath} (${destStat.size})`, 'error');
          
          // 如果是重要文件且不匹配，手动写入内容
          if (entry.name.endsWith('.css') || entry.name.endsWith('.js')) {
            log(`尝试重新写入 ${entry.name}...`, 'info');
            fs.writeFileSync(destPath, srcBuffer);
            const newDestStat = fs.statSync(destPath);
            if (srcStat.size === newDestStat.size) {
              log(`修复成功: ${destPath}`, 'success');
            }
          }
        } else {
          log(`复制: ${srcPath} → ${destPath} (${srcStat.size} 字节)`, 'info');
        }
        
        // 对CSS文件进行特殊处理
        if (entry.name.endsWith('.css')) {
          log(`验证CSS文件: ${destPath}`, 'info');
          const content = fs.readFileSync(destPath, 'utf8');
          if (content.length > 0) {
            // 检查是否包含样式内容
            if (content.includes('tailwind') || content.includes('@media') || content.includes('font-') || content.includes('color:')) {
              log(`CSS文件包含样式内容，大小: ${content.length} 字节`, 'success');
            } else {
              log(`警告: CSS文件可能缺少有效样式: ${destPath}`, 'warning');
            }
          } else {
            log(`警告: CSS文件为空: ${destPath}`, 'error');
            // 尝试从源文件直接复制
            fs.writeFileSync(destPath, srcBuffer);
            log(`尝试修复空CSS文件: ${destPath}`, 'info');
          }
        }
      } catch (err) {
        log(`复制文件错误 ${srcPath}: ${err.message}`, 'error');
      }
    }
  }
}

/**
 * 验证静态资源
 */
function verifyAssets(dir) {
  let cssFiles = [];
  let jsFiles = [];
  let htmlFiles = [];
  
  // 递归查找所有文件
  function findFiles(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory()) {
        findFiles(fullPath);
      } else {
        const stat = fs.statSync(fullPath);
        
        if (entry.name.endsWith('.css')) {
          cssFiles.push({ name: entry.name, path: fullPath, size: stat.size });
        } else if (entry.name.endsWith('.js')) {
          jsFiles.push({ name: entry.name, path: fullPath, size: stat.size });
        } else if (entry.name.endsWith('.html')) {
          htmlFiles.push({ name: entry.name, path: fullPath, size: stat.size });
        }
      }
    }
  }
  
  findFiles(dir);
  
  return { cssFiles, jsFiles, htmlFiles };
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
    
    // 分析源目录的资源情况
    log('分析源目录资源...', 'info');
    const sourceAssets = verifyAssets(sourceDir);
    log(`源目录资源统计: CSS: ${sourceAssets.cssFiles.length}, JS: ${sourceAssets.jsFiles.length}, HTML: ${sourceAssets.htmlFiles.length}`, 'info');
    
    // 显示CSS文件详情
    if (sourceAssets.cssFiles.length > 0) {
      log('源目录CSS文件:', 'info');
      sourceAssets.cssFiles.forEach(file => {
        log(`- ${file.name} (${file.size} 字节)`, 'info');
      });
    } else {
      log('警告: 源目录中没有找到CSS文件!', 'error');
    }
    
    // 确保目标目录存在
    if (fs.existsSync(targetDir)) {
      log(`清空目标目录: ${targetDir}`, 'info');
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    
    log(`开始复制文件从 ${sourceDir} 到 ${targetDir}`, 'info');
    copyDir(sourceDir, targetDir);
    
    log('静态文件复制完成', 'success');
    
    // 分析目标目录的资源情况
    log('验证目标目录资源...', 'info');
    const targetAssets = verifyAssets(targetDir);
    log(`目标目录资源统计: CSS: ${targetAssets.cssFiles.length}, JS: ${targetAssets.jsFiles.length}, HTML: ${targetAssets.htmlFiles.length}`, 'info');
    
    // 比较CSS文件
    if (sourceAssets.cssFiles.length !== targetAssets.cssFiles.length) {
      log(`警告: CSS文件数量不匹配! 源: ${sourceAssets.cssFiles.length}, 目标: ${targetAssets.cssFiles.length}`, 'error');
      
      // 尝试手动复制所有CSS文件
      if (sourceAssets.cssFiles.length > 0 && targetAssets.cssFiles.length < sourceAssets.cssFiles.length) {
        log('尝试手动复制缺失的CSS文件...', 'info');
        sourceAssets.cssFiles.forEach(srcFile => {
          const fileName = path.basename(srcFile.path);
          const destPath = path.join(targetDir, 'assets', fileName);
          
          try {
            // 确保目标assets目录存在
            const assetsDir = path.join(targetDir, 'assets');
            if (!fs.existsSync(assetsDir)) {
              fs.mkdirSync(assetsDir, { recursive: true });
            }
            
            // 读取并写入文件内容
            const content = fs.readFileSync(srcFile.path);
            fs.writeFileSync(destPath, content);
            log(`手动复制CSS文件: ${fileName}`, 'success');
          } catch (err) {
            log(`手动复制CSS文件失败 ${fileName}: ${err.message}`, 'error');
          }
        });
      }
    }
    
    // 检查index.html
    const indexPath = path.join(targetDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      // 读取index.html内容
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // 检查是否包含样式表引用
      if (content.includes('<link rel="stylesheet"') || content.includes('<link href=')) {
        log(`index.html 包含样式表引用`, 'success');
      } else {
        log(`警告: index.html 可能缺少样式表引用`, 'warning');
        
        // 如果有CSS文件但index.html中没有引用，检查是否需要修复
        if (targetAssets.cssFiles.length > 0) {
          log('注意: 虽然有CSS文件，但index.html中可能没有正确引用它们', 'warning');
        }
      }
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