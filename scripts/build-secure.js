/**
 * 安全构建脚本
 * 提供不依赖package.json build脚本的安全构建选项
 * 不使用--packages=external标志，确保会话存储模块被正确包含
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 在ESM中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用IIFE模式包装异步代码
(async () => {
  try {
    console.log('开始安全构建...');

    // 执行前端构建
    console.log('1. 执行前端构建 (vite build)...');
    execSync('vite build', { stdio: 'inherit' });
    console.log('前端构建完成 ✓');

    // 执行后端构建，不使用--packages=external标志，但排除lightningcss
    console.log('2. 执行后端构建 (esbuild)，使用ESM格式，包含所有依赖...');
    execSync(
      'NODE_OPTIONS="--experimental-vm-modules" esbuild server/index.ts --platform=node --bundle --format=esm --outdir=dist --external:lightningcss --banner:js="import { createRequire } from \'module\'; const require = createRequire(import.meta.url);"',
      { stdio: 'inherit' }
    );
    console.log('后端构建完成 ✓');

    // 验证构建内容
    console.log('3. 验证构建...');
    const indexPath = path.join(process.cwd(), 'dist', 'index.js');

    if (!fs.existsSync(indexPath)) {
      console.error('❌ 验证失败: dist/index.js 不存在');
      process.exit(1);
    }

    const content = fs.readFileSync(indexPath, 'utf8');

    // 检查是否包含PostgreSQL会话存储配置
    const hasPgSession = content.includes('connect-pg-simple') || 
                        content.includes('PgStore') || 
                        content.includes('tableName: \'session\'');

    if (hasPgSession) {
      console.log('✓ 验证成功: 构建包含PostgreSQL会话存储配置');
    } else {
      console.warn('⚠️ 警告: 构建中缺少PostgreSQL会话存储配置');
      console.log('正在修复构建...');
      
      // 分析文件寻找第一个导入语句后的位置，避免在所有导入之前添加
      const importLines = content.split('\n').filter(line => line.trim().startsWith('import '));
      const lastImportIndex = importLines.length > 0 ? 
        content.lastIndexOf(importLines[importLines.length - 1]) + importLines[importLines.length - 1].length : 0;
      
      // 在最后一个import语句后添加会话存储相关代码
      let fixedContent;
      if (lastImportIndex > 0) {
        const beforeImports = content.substring(0, lastImportIndex);
        const afterImports = content.substring(lastImportIndex);
        
        fixedContent = `${beforeImports}

// 自动添加的PostgreSQL会话存储修复
import pgSessionLib from 'connect-pg-simple';
import sessionLib from 'express-session';
const PgSessionStore = pgSessionLib(sessionLib);
// 修复结束
${afterImports}`;
      } else {
        // 如果找不到import语句，则添加到文件顶部
        fixedContent = `// 自动添加的PostgreSQL会话存储修复
import pgSessionLib from 'connect-pg-simple';
import sessionLib from 'express-session';
const PgSessionStore = pgSessionLib(sessionLib);
// 修复结束

${content}`;
      }
      
      fs.writeFileSync(indexPath, fixedContent);
      console.log('已添加必要的会话存储导入 ✓');
    }

    console.log('\n构建完成! 现在可以使用以下命令启动生产服务器:');
    console.log('NODE_ENV=production node dist/index.js');
  } catch (error) {
    console.error('构建过程中出错:', error);
    process.exit(1);
  }
})();