#!/usr/bin/env node

/**
 * 生产环境构建脚本
 * 确保所有依赖项（特别是session存储相关）正确包含在构建中
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 执行命令并打印输出
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`执行命令: ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`命令执行失败，退出码: ${code}`));
      }
    });
  });
}

// 验证最终构建内容中是否包含PostgreSQL会话存储配置
function validateBuild() {
  const indexPath = path.join(process.cwd(), 'dist', 'index.js');
  
  if (!fs.existsSync(indexPath)) {
    console.error('构建验证失败: dist/index.js 不存在');
    return false;
  }
  
  const content = fs.readFileSync(indexPath, 'utf8');
  
  // 检查是否包含PostgreSQL会话存储配置
  const hasPgSession = content.includes('connect-pg-simple') || 
                        content.includes('PgStore') || 
                        content.includes('tableName: \'session\'');
  
  if (!hasPgSession) {
    console.warn('警告: 构建中似乎缺少PostgreSQL会话存储配置');
    
    // 如果检测到没有PostgreSQL会话存储配置，则添加警告注释
    const warningComment = `
// ======================= 警告 =======================
// 此构建可能缺少PostgreSQL会话存储配置，可能导致内存泄漏
// 请确保在server/index.ts中正确配置会话存储
// =====================================================
`;
    
    try {
      fs.writeFileSync(indexPath, warningComment + content);
      console.log('已添加警告注释到构建文件');
    } catch (error) {
      console.error('添加警告注释失败:', error);
    }
    
    return false;
  }
  
  console.log('验证成功: 构建包含PostgreSQL会话存储配置');
  return true;
}

// 执行完整构建流程
async function build() {
  try {
    // 1. 前端构建
    await runCommand('vite', ['build']);
    console.log('前端构建完成');
    
    // 2. 后端构建 - 移除 --packages=external 以包含所有依赖
    await runCommand('node', [
      '--experimental-vm-modules',
      process.execPath, // 获取 node 可执行文件路径
      'node_modules/esbuild/bin/esbuild',
      'server/index.ts',
      '--platform=node',
      '--bundle',
      '--format=esm',
      '--outdir=dist'
    ]);
    console.log('后端构建完成');
    
    // 3. 验证构建
    const isValid = validateBuild();
    
    if (isValid) {
      console.log('构建成功，包含所有必要配置');
    } else {
      console.warn('构建完成，但存在潜在配置问题');
    }
  } catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
  }
}

// 执行构建
build();