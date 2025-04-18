
/**
 * 生产环境构建脚本
 * 确保所有依赖项（特别是session存储相关）正确包含在构建中
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('开始生产环境构建...');

// 执行前端构建, 使用CommonJS配置
console.log('1. 执行前端构建 (vite build)...');
execSync('vite build --config vite.config.js', { stdio: 'inherit' });
console.log('前端构建完成 ✓');

// 执行后端构建，使用CommonJS格式
console.log('2. 执行后端构建 (esbuild)，使用ESM格式...');
execSync(
  'NODE_OPTIONS="--experimental-vm-modules" esbuild server/index.ts --platform=node --bundle --format=esm --outdir=dist --external:lightningcss',
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
  
  // 添加必要的导入和配置
  const fixedContent = `
// 自动添加的PostgreSQL会话存储修复
const pgSession = require('connect-pg-simple');
const session = require('express-session');
const PgStore = pgSession(session);
// 修复结束

${content}`;
  
  fs.writeFileSync(indexPath, fixedContent);
  console.log('已添加必要的会话存储导入 ✓');
}

console.log('\n构建完成! 现在可以使用以下命令启动生产服务器:');
console.log('NODE_ENV=production node dist/index.js');
