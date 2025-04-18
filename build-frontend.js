/**
 * 前端构建脚本
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 色彩日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

console.log('开始构建前端...');

try {
  // 清理旧的构建文件
  log('清理旧构建文件...', 'info');
  execSync('rm -rf dist', { stdio: 'inherit' });
  execSync('rm -rf server/public', { stdio: 'inherit' });
  
  // 保存原始CSS配置
  const postcssConfigPath = path.resolve('./postcss.config.cjs');
  let originalPostcssConfig = '';
  if (fs.existsSync(postcssConfigPath)) {
    originalPostcssConfig = fs.readFileSync(postcssConfigPath, 'utf8');
    log('备份原始postcss配置', 'info');
  }
  
  // 临时修改postcss配置以确保使用lightningcss
  try {
    const lightningcssConfig = `
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    // 启用lightning css处理
    'lightningcss': {
      browsers: 'defaults',
      drafts: {
        customMedia: true,
        nesting: true,
      },
      minify: true,
    },
  },
}
`;
    log('临时设置postcss配置为使用lightningcss', 'info');
    fs.writeFileSync(postcssConfigPath, lightningcssConfig);
    
    // 使用Vite构建前端
    log('使用Vite构建前端...', 'info');
    execSync('npx vite build', { 
      stdio: 'inherit',
      env: { 
        ...process.env, 
        NODE_ENV: 'production',
        VITE_CSS_TRANSFORMER: 'lightningcss',
        VITE_CSS_MINIFY: 'lightningcss'
      }
    });
  } finally {
    // 恢复原始配置
    if (originalPostcssConfig) {
      log('恢复原始postcss配置', 'info');
      fs.writeFileSync(postcssConfigPath, originalPostcssConfig);
    }
  }
  
  // 验证CSS文件是否成功生成
  const cssFilePath = path.resolve('./dist/public/assets');
  if (fs.existsSync(cssFilePath)) {
    const cssFiles = fs.readdirSync(cssFilePath).filter(file => file.endsWith('.css'));
    if (cssFiles.length > 0) {
      log(`找到${cssFiles.length}个CSS文件: ${cssFiles.join(', ')}`, 'success');
      
      // 检查CSS文件大小和内容
      for (const cssFile of cssFiles) {
        const fullPath = path.join(cssFilePath, cssFile);
        const stats = fs.statSync(fullPath);
        log(`CSS文件 ${cssFile} 大小: ${stats.size} 字节`, 'info');
        
        if (stats.size < 1000) {
          log(`警告: CSS文件 ${cssFile} 可能太小，样式可能不完整`, 'warning');
        }
      }
    } else {
      log('警告: 未找到CSS文件!', 'error');
    }
  }
  
  // 运行静态文件路径修复脚本
  log('修复静态文件路径...', 'info');
  execSync('node fix-static-path.js', { stdio: 'inherit' });
  
  log('前端构建完成!', 'success');
} catch (error) {
  log(`构建出错: ${error.message}`, 'error');
  process.exit(1);
}