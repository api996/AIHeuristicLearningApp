#!/usr/bin/env node

/**
 * 会话配置检查脚本
 * 验证应用程序是否正确配置了PostgreSQL会话存储
 * 
 * 使用方法:
 * - 开发环境: `node scripts/check-session-config.js`
 * - 生产环境: `NODE_ENV=production node scripts/check-session-config.js`
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色设置
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

console.log(`${colors.bright}${colors.blue}===== 会话配置检查 =====${colors.reset}`);
console.log(`环境: ${process.env.NODE_ENV || 'development'}`);

// 检查源代码配置
function checkSourceConfig() {
  console.log('\n检查源代码中的会话配置...');
  
  const serverIndexPath = path.join(process.cwd(), 'server', 'index.ts');
  
  if (!fs.existsSync(serverIndexPath)) {
    console.log(`${colors.red}✗ 无法找到server/index.ts${colors.reset}`);
    return false;
  }
  
  const content = fs.readFileSync(serverIndexPath, 'utf8');
  
  // 检查是否引入了必要的依赖
  const imports = {
    session: content.includes('import session from "express-session"'),
    pgSession: content.includes('import pgSession from "connect-pg-simple"'),
    pool: content.includes('import { pool } from "./db"')
  };
  
  console.log(`${imports.session ? colors.green + '✓' : colors.red + '✗'} express-session导入${colors.reset}`);
  console.log(`${imports.pgSession ? colors.green + '✓' : colors.red + '✗'} connect-pg-simple导入${colors.reset}`);
  console.log(`${imports.pool ? colors.green + '✓' : colors.red + '✗'} 数据库连接池导入${colors.reset}`);
  
  // 检查是否创建了PgStore对象
  const hasPgStore = content.includes('const PgStore = pgSession(session)');
  console.log(`${hasPgStore ? colors.green + '✓' : colors.red + '✗'} PgStore创建${colors.reset}`);
  
  // 检查会话配置
  const hasSessionConfig = content.includes('app.use(session({');
  console.log(`${hasSessionConfig ? colors.green + '✓' : colors.red + '✗'} 会话中间件配置${colors.reset}`);
  
  // 检查是否配置了PostgreSQL存储
  const hasDbStore = content.includes('store: new PgStore({') && 
                     content.includes('pool') && 
                     content.includes('tableName: \'session\'');
  
  console.log(`${hasDbStore ? colors.green + '✓' : colors.red + '✗'} PostgreSQL会话存储配置${colors.reset}`);
  
  // 检查会话过期时间设置
  const hasExpiration = content.includes('maxAge:') && content.includes('60 * 60');
  console.log(`${hasExpiration ? colors.green + '✓' : colors.red + '✗'} 会话过期时间配置${colors.reset}`);
  
  return imports.session && imports.pgSession && imports.pool && hasPgStore && hasSessionConfig && hasDbStore;
}

// 检查构建配置
function checkBuildConfig() {
  console.log('\n检查构建配置...');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`${colors.red}✗ 无法找到package.json${colors.reset}`);
    return false;
  }
  
  const content = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(content);
  
  if (!packageJson.scripts || !packageJson.scripts.build) {
    console.log(`${colors.red}✗ 未找到构建脚本${colors.reset}`);
    return false;
  }
  
  const buildScript = packageJson.scripts.build;
  console.log(`构建脚本: ${buildScript}`);
  
  // 检查是否使用了排除外部包的标志
  const hasExternalFlag = buildScript.includes('--packages=external');
  console.log(`${!hasExternalFlag ? colors.green + '✓' : colors.red + '✗'} 构建配置 ${hasExternalFlag ? '排除了外部包，可能导致会话存储问题' : '包含所有依赖'}${colors.reset}`);
  
  return !hasExternalFlag;
}

// 检查构建输出
function checkBuildOutput() {
  console.log('\n检查构建输出...');
  
  const distIndexPath = path.join(process.cwd(), 'dist', 'index.js');
  
  if (!fs.existsSync(distIndexPath)) {
    console.log(`${colors.yellow}⚠️ 无法找到dist/index.js，尚未构建${colors.reset}`);
    return false;
  }
  
  const content = fs.readFileSync(distIndexPath, 'utf8');
  
  // 检查构建输出中是否包含会话存储相关代码
  const hasPgSession = content.includes('connect-pg-simple') || 
                       content.includes('PgStore') || 
                       content.includes('tableName: \'session\'') ||
                       content.includes('tableName:"session"');
  
  console.log(`${hasPgSession ? colors.green + '✓' : colors.red + '✗'} 构建输出${hasPgSession ? '包含' : '缺少'}PostgreSQL会话存储配置${colors.reset}`);
  
  if (!hasPgSession) {
    console.log(`${colors.yellow}⚠️ 这可能导致生产环境中使用默认内存存储，引发内存泄漏${colors.reset}`);
    console.log(`${colors.yellow}⚠️ 建议使用提供的scripts/build-for-production.js脚本构建${colors.reset}`);
  }
  
  return hasPgSession;
}

// 显示建议的操作
function showRecommendations(sourceOk, buildOk, outputOk) {
  console.log('\n');
  console.log(`${colors.bright}===== 建议操作 =====${colors.reset}`);
  
  if (!sourceOk) {
    console.log(`${colors.yellow}1. 修复server/index.ts中的会话配置:${colors.reset}`);
    console.log(`   - 确保导入connect-pg-simple和数据库连接池`);
    console.log(`   - 创建PgStore并在会话中间件中使用它`);
    console.log(`   - 配置适当的会话过期时间`);
  }
  
  if (!buildOk) {
    console.log(`${colors.yellow}2. 修复构建配置:${colors.reset}`);
    console.log(`   - 移除package.json中构建脚本的--packages=external标志`);
    console.log(`   - 或者使用scripts/build-for-production.js进行构建`);
  }
  
  if (!outputOk && (sourceOk && buildOk)) {
    console.log(`${colors.yellow}3. 重新构建应用:${colors.reset}`);
    console.log(`   - 运行: node scripts/build-for-production.js`);
  }
  
  if (sourceOk && buildOk && outputOk) {
    console.log(`${colors.green}✓ 会话配置正确，无需操作${colors.reset}`);
  }
}

// 运行检查
function runChecks() {
  const sourceOk = checkSourceConfig();
  const buildOk = checkBuildConfig();
  const outputOk = checkBuildOutput();
  
  console.log('\n');
  console.log(`${colors.bright}===== 检查结果摘要 =====${colors.reset}`);
  console.log(`源代码配置: ${sourceOk ? colors.green + '通过' : colors.red + '失败'}${colors.reset}`);
  console.log(`构建配置: ${buildOk ? colors.green + '通过' : colors.red + '失败'}${colors.reset}`);
  console.log(`构建输出: ${outputOk ? colors.green + '通过' : colors.yellow + '需注意'}${colors.reset}`);
  
  const allPassed = sourceOk && buildOk && outputOk;
  
  console.log('\n');
  if (allPassed) {
    console.log(`${colors.green}${colors.bright}✓ 所有检查通过，会话配置正确${colors.reset}`);
  } else {
    console.log(`${colors.yellow}${colors.bright}⚠️ 部分检查未通过，会话配置可能存在问题${colors.reset}`);
  }
  
  showRecommendations(sourceOk, buildOk, outputOk);
  
  return allPassed;
}

// 执行检查
const checksPassed = runChecks();

// 如果是作为命令行脚本运行，则设置退出码
if (require.main === module) {
  process.exit(checksPassed ? 0 : 1);
}

module.exports = {
  runChecks
};