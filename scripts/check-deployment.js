#!/usr/bin/env node

/**
 * 部署前检查脚本
 * 验证关键生产配置，特别是会话存储设置
 */

const fs = require('fs');
const path = require('path');

// 颜色设置，用于控制台输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

console.log(`${colors.bright}${colors.blue}===== 部署前配置检查 =====${colors.reset}`);

// 检查环境变量
function checkEnvironmentVariables() {
  console.log('\n检查关键环境变量...');
  
  const requiredVars = [
    { name: 'DATABASE_URL', description: '数据库连接URL' },
    { name: 'NODE_ENV', description: '运行环境', expected: 'production' }
  ];
  
  let allPresent = true;
  
  for (const { name, description, expected } of requiredVars) {
    if (process.env[name]) {
      if (expected && process.env[name] !== expected) {
        console.log(`${colors.yellow}⚠️ ${name}: ${process.env[name]} (预期: ${expected})${colors.reset}`);
      } else {
        console.log(`${colors.green}✓ ${name}: 已设置${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}✗ ${name}: 未设置 - ${description}${colors.reset}`);
      allPresent = false;
    }
  }
  
  return allPresent;
}

// 检查会话存储配置
function checkSessionConfig() {
  console.log('\n检查会话存储配置...');
  
  const serverIndexPath = path.join(process.cwd(), 'server', 'index.ts');
  
  if (!fs.existsSync(serverIndexPath)) {
    console.log(`${colors.red}✗ 无法找到server/index.ts${colors.reset}`);
    return false;
  }
  
  const content = fs.readFileSync(serverIndexPath, 'utf8');
  
  // 检查是否使用PostgreSQL会话存储
  const usingPgSession = content.includes('connect-pg-simple') && 
                          content.includes('PgStore') && 
                          content.includes('new PgStore');
  
  if (usingPgSession) {
    console.log(`${colors.green}✓ 找到PostgreSQL会话存储配置${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ 未找到PostgreSQL会话存储配置${colors.reset}`);
    console.log(`${colors.yellow}  警告: 使用默认MemoryStore可能导致内存泄漏和应用崩溃${colors.reset}`);
    return false;
  }
  
  // 检查表名配置
  const hasTableName = content.includes('tableName: \'session\'') || 
                        content.includes('tableName: "session"');
  
  if (hasTableName) {
    console.log(`${colors.green}✓ 会话表名配置正确${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️ 未找到会话表名配置${colors.reset}`);
  }
  
  return usingPgSession;
}

// 检查构建输出
function checkBuildOutput() {
  console.log('\n检查构建输出...');
  
  const distPath = path.join(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.js');
  
  if (!fs.existsSync(distPath)) {
    console.log(`${colors.yellow}⚠️ dist目录不存在，尚未构建${colors.reset}`);
    return false;
  }
  
  if (!fs.existsSync(indexPath)) {
    console.log(`${colors.yellow}⚠️ dist/index.js不存在，后端尚未构建${colors.reset}`);
    return false;
  }
  
  const content = fs.readFileSync(indexPath, 'utf8');
  
  // 检查构建输出中是否包含PostgreSQL会话存储相关代码
  const hasPgSession = content.includes('connect-pg-simple') || 
                        content.includes('PgStore') || 
                        content.includes('tableName: \'session\'') ||
                        content.includes('tableName:"session"');
  
  if (hasPgSession) {
    console.log(`${colors.green}✓ 构建输出包含PostgreSQL会话存储配置${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ 构建输出缺少PostgreSQL会话存储配置${colors.reset}`);
    console.log(`${colors.yellow}  这可能导致生产环境中使用默认MemoryStore${colors.reset}`);
    return false;
  }
  
  return true;
}

// 运行所有检查
function runAllChecks() {
  const envVarsOk = checkEnvironmentVariables();
  const sessionConfigOk = checkSessionConfig();
  const buildOutputOk = checkBuildOutput();
  
  console.log('\n');
  console.log(`${colors.bright}===== 检查结果 =====${colors.reset}`);
  console.log(`环境变量: ${envVarsOk ? colors.green + '通过' : colors.red + '失败'}${colors.reset}`);
  console.log(`会话配置: ${sessionConfigOk ? colors.green + '通过' : colors.red + '失败'}${colors.reset}`);
  console.log(`构建输出: ${buildOutputOk ? colors.green + '通过' : colors.red + '失败'}${colors.reset}`);
  
  const allPassed = envVarsOk && sessionConfigOk && buildOutputOk;
  
  console.log('\n');
  if (allPassed) {
    console.log(`${colors.green}${colors.bright}✓ 所有检查通过，部署配置正确${colors.reset}`);
  } else {
    console.log(`${colors.yellow}${colors.bright}⚠️ 部分检查未通过，请修复上述问题后再部署${colors.reset}`);
    
    if (!sessionConfigOk || !buildOutputOk) {
      console.log(`\n${colors.bright}修复建议:${colors.reset}`);
      console.log(`1. 确保server/index.ts中正确配置了PostgreSQL会话存储`);
      console.log(`2. 使用scripts/build-prod.js进行构建，确保包含所有依赖`);
      console.log(`   执行: node scripts/build-prod.js`);
    }
  }
  
  return allPassed;
}

// 执行检查
const checksPassed = runAllChecks();

// 如果是作为命令行脚本运行，则设置退出码
if (require.main === module) {
  process.exit(checksPassed ? 0 : 1);
}

module.exports = {
  runAllChecks
};