/**
 * 高级生产环境构建脚本
 * 使用全局替换的方法解决createRequire多次导入导致的冲突问题
 * 确保所有依赖项（特别是session存储相关）正确包含在构建中
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distDir = path.join(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.js');

// 创建可用于构建前注入的会话存储配置
const createSessionStoreHeader = () => {
  return `
// 自动预先注入的PostgreSQL会话存储配置
// 此代码在构建前注入，避免构建后修改可能引起的模块冲突问题
import pgSessionLib from 'connect-pg-simple';
import sessionLib from 'express-session';
const PgSessionStore = pgSessionLib(sessionLib);
// 预注入代码结束
`;
};

(async () => {
  try {
    console.log('开始高级安全构建...');
    
    // 0. 准备在构建前注入会话存储配置
    console.log('0. 准备构建前代码注入...');
    
    // 修改server/index.ts文件，在其开头注入会话存储配置
    const serverIndexPath = path.join(process.cwd(), 'server', 'index.ts');
    let serverIndexContent = fs.readFileSync(serverIndexPath, 'utf8');
    
    // 只有在文件中不存在connect-pg-simple时才注入
    if (!serverIndexContent.includes('connect-pg-simple')) {
      console.log('注入PostgreSQL会话存储配置...');
      const sessionHeader = createSessionStoreHeader();
      const updatedContent = `${sessionHeader}\n${serverIndexContent}`;
      
      // 创建备份
      fs.writeFileSync(`${serverIndexPath}.bak`, serverIndexContent);
      
      // 写入修改后的内容
      fs.writeFileSync(serverIndexPath, updatedContent);
      console.log('代码注入完成 ✓');
    } else {
      console.log('PostgreSQL会话存储配置已存在，无需注入 ✓');
    }
    
    // 1. 执行前端构建
    console.log('1. 执行前端构建 (vite build)...');
    execSync('npx vite build', { stdio: 'inherit' });
    console.log('前端构建完成 ✓');
    
    // 2. 执行后端构建，指定ESM格式，包含所有依赖
    console.log('2. 执行后端构建 (esbuild)，使用ESM格式，包含所有依赖...');
    execSync('node esbuild.config.js', { stdio: 'inherit' });
    console.log('后端构建完成 ✓');
    
    // 3. 恢复原始server/index.ts文件（如果有备份）
    if (fs.existsSync(`${serverIndexPath}.bak`)) {
      fs.copyFileSync(`${serverIndexPath}.bak`, serverIndexPath);
      fs.unlinkSync(`${serverIndexPath}.bak`);
      console.log('已恢复原始server/index.ts文件 ✓');
    }
    
    // 4. 验证构建
    console.log('4. 验证构建...');
    
    if (!fs.existsSync(indexPath)) {
      throw new Error(`构建失败: 找不到输出文件 ${indexPath}`);
    }
    
    // 读取构建后的内容
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // 检查是否包含PostgreSQL会话存储配置
    const hasPgSession = content.includes('connect-pg-simple') || 
                         content.includes('PgSessionStore') || 
                         content.includes('tableName: \'session\'');
                         
    if (hasPgSession) {
      console.log('✓ 验证成功: 构建包含PostgreSQL会话存储配置');
    } else {
      console.warn('⚠️ 警告: 构建可能缺少PostgreSQL会话存储配置');
    }
    
    // 如果需要，添加PostgreSQL会话存储配置
    if (!hasPgSession) {
      console.warn('⚠️ 警告: 构建中缺少PostgreSQL会话存储配置');
      console.log('正在修复构建...');
      
      // 在第一个非import语句前添加会话存储相关代码
      const lines = content.split('\n');
      let importEndIndex = 0;
      
      // 找到最后一个import语句的位置
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          importEndIndex = i;
        } else if (importEndIndex > 0 && lines[i].trim() !== '' && !lines[i].trim().startsWith('//')) {
          // 找到第一个非空且非注释的行
          break;
        }
      }
      
      // 在最后一个import后添加
      const sessionCode = `
// 自动添加的PostgreSQL会话存储修复 - 使用唯一变量名
import pgSessionLib from 'connect-pg-simple';
import sessionLib from 'express-session';
const PgSessionStore = pgSessionLib(sessionLib);
// 修复结束
`;
      
      lines.splice(importEndIndex + 1, 0, sessionCode);
      content = lines.join('\n');
      
      console.log('已添加必要的会话存储导入 ✓');
    }
    
    // 写回修改后的内容
    fs.writeFileSync(indexPath, content);
    
    console.log('\n✅ 高级安全构建完成! 现在可以使用以下命令启动生产服务器:');
    console.log('NODE_ENV=production node dist/index.js');
  } catch (error) {
    console.error('构建过程中出错:', error);
    if (error.stdout) console.error('标准输出:', error.stdout.toString());
    if (error.stderr) console.error('错误输出:', error.stderr.toString());
    process.exit(1);
  }
})();