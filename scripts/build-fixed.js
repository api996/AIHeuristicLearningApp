/**
 * 完整的生产环境构建脚本
 * 包含构建后修复步骤，修复模块冲突问题
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

(async () => {
  try {
    console.log('开始完整生产构建过程...');
    
    // 1. 清理旧的构建目录
    console.log('1. 清理旧的构建目录...');
    
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
    
    // 2. 执行前端构建
    console.log('2. 执行前端构建 (vite build)...');
    execSync('npx vite build', { stdio: 'inherit' });
    console.log('✓ 前端构建完成');
    
    // 3. 执行后端构建
    console.log('3. 执行后端构建 (esbuild)...');
    try {
      // 使用我们已知可以工作的esbuild配置
      execSync('node esbuild.config.js', { stdio: 'inherit' });
      console.log('✓ 后端构建完成');
    } catch (error) {
      console.error('后端构建失败:', error);
      process.exit(1);
    }
    
    // 4. 运行构建后处理修复脚本
    console.log('4. 运行构建后处理修复脚本...');
    try {
      execSync('node fix-bundle.js', { stdio: 'inherit' });
      console.log('✓ 构建修复完成');
    } catch (error) {
      console.error('构建修复失败:', error);
      process.exit(1);
    }
    
    // 5. 验证构建结果
    console.log('5. 验证构建结果...');
    
    const indexPath = path.join(distDir, 'index.js');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`构建失败: 找不到输出文件 ${indexPath}`);
    }
    
    console.log('\n✅ 构建完成! 现在可以使用以下命令启动生产服务器:');
    console.log('NODE_ENV=production node dist/index.js');
    console.log('或使用管理脚本:');
    console.log('node direct-prod.js');
  } catch (error) {
    console.error('构建过程中出错:', error);
    if (error.stdout) console.error('标准输出:', error.stdout.toString());
    if (error.stderr) console.error('错误输出:', error.stderr.toString());
    process.exit(1);
  }
})();