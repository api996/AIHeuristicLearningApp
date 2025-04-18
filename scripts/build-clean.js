/**
 * 全新清洁构建脚本
 * 解决ESM模块导入冲突的问题
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

(async () => {
  try {
    console.log('开始清洁构建过程...');
    
    // 1. 确保server/index.ts中包含会话存储代码
    console.log('1. 验证源码中包含会话存储配置...');
    
    const serverIndexPath = path.join(process.cwd(), 'server', 'index.ts');
    let serverIndexContent = fs.readFileSync(serverIndexPath, 'utf8');
    
    const hasPgSession = serverIndexContent.includes('pgSession(session)') && 
                         serverIndexContent.includes('store: new PgStore');
                         
    if (!hasPgSession) {
      console.warn('⚠️ 需要确保会话存储配置已包含在server/index.ts中');
      console.log('请确认server/index.ts文件中已经包含以下配置:');
      console.log('- import pgSession from "connect-pg-simple"');
      console.log('- const PgStore = pgSession(session)');
      console.log('- store: new PgStore({...})');
      process.exit(1);
    }
    
    console.log('✓ 验证通过: 源码已包含会话存储配置');
    
    // 2. 清理构建目录
    console.log('2. 清理旧的构建目录...');
    
    const distDir = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      try {
        // 删除整个dist目录
        fs.rmSync(distDir, { recursive: true, force: true });
        console.log('✓ 旧构建目录已清除');
      } catch (error) {
        console.warn(`⚠️ 无法完全清理dist目录: ${error.message}`);
      }
    }
    
    // 3. 执行前端构建
    console.log('3. 执行前端构建 (vite build)...');
    execSync('npx vite build', { stdio: 'inherit' });
    console.log('✓ 前端构建完成');
    
    // 4. 执行后端构建
    console.log('4. 执行后端构建 (esbuild)...');
    execSync('node esbuild.config.js', { stdio: 'inherit' });
    console.log('✓ 后端构建完成');
    
    // 5. 验证构建结果
    console.log('5. 验证构建结果...');
    
    const indexPath = path.join(distDir, 'index.js');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`构建失败: 找不到输出文件 ${indexPath}`);
    }
    
    // 读取构建后的前几行内容进行检查
    const firstLines = fs.readFileSync(indexPath, 'utf8').split('\n').slice(0, 100).join('\n');
    
    if (firstLines.includes('SyntaxError') || firstLines.includes('Error:')) {
      console.error('❌ 构建可能存在问题，检测到错误信息');
    } else {
      console.log('✓ 未检测到明显的语法错误');
    }
    
    // 检查是否包含PostgreSQL会话存储配置
    const content = fs.readFileSync(indexPath, 'utf8');
    const buildHasPgSession = content.includes('connect-pg-simple') || 
                             content.includes('PgStore') || 
                             content.includes('tableName: \'session\'');
    
    if (buildHasPgSession) {
      console.log('✓ 验证成功: 构建包含PostgreSQL会话存储配置');
    } else {
      console.warn('⚠️ 警告: 构建中可能缺少PostgreSQL会话存储配置');
    }
    
    console.log('\n✅ 清洁构建完成! 现在可以使用以下命令启动生产服务器:');
    console.log('NODE_ENV=production node dist/index.js');
  } catch (error) {
    console.error('构建过程中出错:', error);
    if (error.stdout) console.error('标准输出:', error.stdout.toString());
    if (error.stderr) console.error('错误输出:', error.stderr.toString());
    process.exit(1);
  }
})();