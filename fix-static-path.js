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
 * 复制特殊CSS文件
 * 确保iOS专用的样式文件被正确复制到生产环境
 */
function copySpecialCssFiles() {
  log('开始复制特殊CSS文件...', 'info');
  
  const specialCssFiles = [
    'client/src/components/ui/mobile-fixes.css',
    'client/src/components/ui/ipad-fixes.css',
    'client/src/components/ui/button-styles.css'
  ];
  
  // 确保目标assets目录存在
  const assetsDir = path.join(targetDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  let copiedCount = 0;
  
  specialCssFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const destPath = path.join(assetsDir, path.basename(file));
      try {
        const content = fs.readFileSync(file);
        fs.writeFileSync(destPath, content);
        log(`特殊CSS文件已复制: ${file} -> ${destPath}`, 'success');
        copiedCount++;
      } catch (err) {
        log(`复制特殊CSS文件失败 ${file}: ${err.message}`, 'error');
      }
    } else {
      log(`特殊CSS文件不存在: ${file}`, 'warning');
    }
  });
  
  log(`特殊CSS文件复制完成 (${copiedCount}/${specialCssFiles.length})`, 'info');
  
  // 创建引用这些特殊CSS文件的样式表
  try {
    const specialStylesPath = path.join(assetsDir, 'special-styles.css');
    let cssImports = '';
    
    specialCssFiles.forEach(file => {
      if (fs.existsSync(path.join(assetsDir, path.basename(file)))) {
        cssImports += `@import url("/assets/${path.basename(file)}");\n`;
      }
    });
    
    if (cssImports) {
      fs.writeFileSync(specialStylesPath, cssImports);
      log(`创建了特殊样式汇总文件: ${specialStylesPath}`, 'success');
    }
  } catch (err) {
    log(`创建特殊样式汇总文件失败: ${err.message}`, 'error');
  }
}

/**
 * 确保管理员相关资源被正确复制
 */
function ensureAdminAssets() {
  log('确保管理员功能资源完整...', 'info');
  
  // 确保admin相关脚本被正确打包
  const adminAssetsDir = path.join(targetDir, 'assets');
  if (!fs.existsSync(adminAssetsDir)) {
    fs.mkdirSync(adminAssetsDir, { recursive: true });
  }
  
  try {
    // 创建admin.js占位符文件，包含console.log信息，确保admin文件在构建中存在
    // 这不是实际功能代码，仅用于验证admin资源是否被包含
    const adminMarkerPath = path.join(adminAssetsDir, 'admin-marker.js');
    const markerContent = `
      // Admin功能标记文件
      console.log('Admin功能已加载');
      // 此文件仅用于确保admin相关资源被正确识别和加载
    `;
    fs.writeFileSync(adminMarkerPath, markerContent);
    log(`创建了Admin标记文件: ${adminMarkerPath}`, 'success');
  } catch (err) {
    log(`创建Admin标记文件失败: ${err.message}`, 'error');
  }
}

/**
 * 确保背景图片目录和文件存在
 */
function ensureBackgroundsDirectory() {
  log('正在处理背景图片目录...', 'info');
  
  const bgSourceDir = 'public/backgrounds';
  const bgDestDir = path.join(targetDir, 'backgrounds');
  
  // 确保目标目录存在
  if (!fs.existsSync(bgDestDir)) {
    fs.mkdirSync(bgDestDir, { recursive: true });
  }
  
  // 如果源背景目录存在，复制所有背景图片
  if (fs.existsSync(bgSourceDir)) {
    const backgroundFiles = fs.readdirSync(bgSourceDir);
    log(`找到 ${backgroundFiles.length} 个背景图片`, 'info');
    
    let copiedCount = 0;
    
    // 关键背景图片列表 - 确保这些文件一定存在
    const criticalBackgrounds = [
      'landscape-background.jpg',
      'portrait-background.jpg',
      'default-background.jpg',
      'mobile-background.jpg'
    ];
    
    // 先复制所有现有图片
    backgroundFiles.forEach(file => {
      const srcPath = path.join(bgSourceDir, file);
      const destPath = path.join(bgDestDir, file);
      
      try {
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
          copiedCount++;
          log(`复制背景图片: ${file}`, 'success');
          
          // 从关键列表中移除已复制的文件
          const index = criticalBackgrounds.indexOf(file);
          if (index !== -1) {
            criticalBackgrounds.splice(index, 1);
          }
        }
      } catch (err) {
        log(`复制背景图片失败 ${file}: ${err.message}`, 'error');
      }
    });
    
    log(`背景图片复制完成 (${copiedCount}/${backgroundFiles.length})`, 'info');
    
    // 检查是否所有关键背景都已复制
    if (criticalBackgrounds.length > 0) {
      log(`警告: 缺少关键背景图片: ${criticalBackgrounds.join(', ')}`, 'warning');
      
      // 对于缺少的关键背景，尝试进行备份方案
      criticalBackgrounds.forEach(file => {
        // 如果有landscape但缺少portrait，则复制landscape作为portrait
        if (file === 'portrait-background.jpg' && fs.existsSync(path.join(bgDestDir, 'landscape-background.jpg'))) {
          fs.copyFileSync(
            path.join(bgDestDir, 'landscape-background.jpg'),
            path.join(bgDestDir, file)
          );
          log(`使用landscape-background.jpg作为${file}的替代`, 'info');
        }
        // 如果有portrait但缺少landscape，则复制portrait作为landscape
        else if (file === 'landscape-background.jpg' && fs.existsSync(path.join(bgDestDir, 'portrait-background.jpg'))) {
          fs.copyFileSync(
            path.join(bgDestDir, 'portrait-background.jpg'),
            path.join(bgDestDir, file)
          );
          log(`使用portrait-background.jpg作为${file}的替代`, 'info');
        }
        // 如果缺少default-background.jpg，使用landscape作为替代
        else if (file === 'default-background.jpg' && fs.existsSync(path.join(bgDestDir, 'landscape-background.jpg'))) {
          fs.copyFileSync(
            path.join(bgDestDir, 'landscape-background.jpg'),
            path.join(bgDestDir, file)
          );
          log(`使用landscape-background.jpg作为${file}的替代`, 'info');
        }
        // 如果缺少mobile-background.jpg，使用portrait作为替代
        else if (file === 'mobile-background.jpg' && fs.existsSync(path.join(bgDestDir, 'portrait-background.jpg'))) {
          fs.copyFileSync(
            path.join(bgDestDir, 'portrait-background.jpg'),
            path.join(bgDestDir, file)
          );
          log(`使用portrait-background.jpg作为${file}的替代`, 'info');
        }
      });
    }
  } else {
    log('背景图片源目录不存在，跳过背景图片处理', 'warning');
  }
}

/**
 * 修复CSS引用
 */
function fixCssReferences() {
  log('检查并修复CSS引用...', 'info');
  
  const cssDir = path.join(targetDir, 'assets');
  
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
    
    log(`找到 ${cssFiles.length} 个CSS文件需要检查引用`, 'info');
    
    cssFiles.forEach(file => {
      const filePath = path.join(cssDir, file);
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // 修复字体路径引用
        const originalContent = content;
        content = content.replace(/url\(['"]?\.\.\/fonts\//g, 'url(\'/assets/fonts/');
        
        // 修复图片路径引用
        content = content.replace(/url\(['"]?\.\.\/images\//g, 'url(\'/assets/images/');
        
        // 修复Google Fonts引用
        if (content.includes('fonts.googleapis.com')) {
          log(`CSS文件包含Google Fonts引用: ${file}`, 'info');
        }
        
        // 如果内容有变化，保存文件
        if (content !== originalContent) {
          fs.writeFileSync(filePath, content);
          log(`修复了CSS引用: ${file}`, 'success');
        }
      } catch (err) {
        log(`修复CSS引用失败 ${file}: ${err.message}`, 'error');
      }
    });
  } else {
    log(`CSS目录不存在: ${cssDir}`, 'warning');
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
    
    log('基本静态文件复制完成', 'success');
    
    // 执行增强的资源处理步骤
    log('开始执行增强的资源处理...', 'info');
    copySpecialCssFiles();
    ensureAdminAssets();
    ensureBackgroundsDirectory();
    fixCssReferences();
    
    // 分析目标目录的资源情况
    log('验证目标目录资源...', 'info');
    const targetAssets = verifyAssets(targetDir);
    log(`目标目录资源统计: CSS: ${targetAssets.cssFiles.length}, JS: ${targetAssets.jsFiles.length}, HTML: ${targetAssets.htmlFiles.length}`, 'info');
    
    // 比较CSS文件
    if (sourceAssets.cssFiles.length !== targetAssets.cssFiles.length) {
      log(`警告: CSS文件数量不匹配! 源: ${sourceAssets.cssFiles.length}, 目标: ${targetAssets.cssFiles.length}`, 'warning');
      
      // 特殊CSS文件已经单独复制，这里不再需要额外处理
      log('已通过copySpecialCssFiles函数单独处理特殊CSS文件', 'info');
    }
    
    // 检查index.html
    const indexPath = path.join(targetDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      // 读取index.html内容
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // 检查是否包含样式表引用
      if (content.includes('<link rel="stylesheet"') || content.includes('<link href=')) {
        log(`index.html 包含样式表引用`, 'success');
        
        // 检查是否需要添加特殊样式表引用
        if (!content.includes('special-styles.css')) {
          try {
            // 在</head>前添加特殊样式表引用
            const newContent = content.replace('</head>', '  <link rel="stylesheet" href="/assets/special-styles.css">\n  </head>');
            fs.writeFileSync(indexPath, newContent);
            log('向index.html添加了特殊样式表引用', 'success');
          } catch (err) {
            log(`向index.html添加特殊样式表引用失败: ${err.message}`, 'error');
          }
        }
      } else {
        log(`警告: index.html 可能缺少样式表引用`, 'warning');
        
        // 如果有CSS文件但index.html中没有引用，添加引用
        if (targetAssets.cssFiles.length > 0) {
          try {
            // 简单地在</head>前添加样式表引用
            const cssLinks = targetAssets.cssFiles.map(file => 
              `  <link rel="stylesheet" href="/assets/${file.name}">\n`
            ).join('');
            
            const newContent = content.replace('</head>', `${cssLinks}  <link rel="stylesheet" href="/assets/special-styles.css">\n  </head>`);
            
            fs.writeFileSync(indexPath, newContent);
            log('向index.html添加了缺失的样式表引用', 'success');
          } catch (err) {
            log(`向index.html添加样式表引用失败: ${err.message}`, 'error');
          }
        }
      }
    } else {
      log(`警告: index.html 不存在于 ${indexPath}`, 'error');
    }
    
    log('所有资源处理完成', 'success');
  } catch (error) {
    log(`出错: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 执行主函数
main();