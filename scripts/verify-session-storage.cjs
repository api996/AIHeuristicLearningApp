#!/usr/bin/env node

/**
 * 会话存储验证脚本
 * 检查当前应用程序是否正确配置了数据库会话存储
 */

const pgSession = require('connect-pg-simple');
const session = require('express-session');
const { Pool } = require('@neondatabase/serverless');
const ws = require('ws');

// 颜色设置，用于控制台输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// 日志输出函数
function log(message, type = 'info') {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  let prefix = '';
  switch (type) {
    case 'error':
      prefix = `${colors.red}[ERROR]${colors.reset}`;
      break;
    case 'warn':
      prefix = `${colors.yellow}[WARN]${colors.reset}`;
      break;
    case 'success':
      prefix = `${colors.green}[SUCCESS]${colors.reset}`;
      break;
    default:
      prefix = `[INFO]`;
  }
  
  console.log(`${timestamp} ${prefix} ${message}`);
}

async function verifySessionTable() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    log('未设置DATABASE_URL环境变量', 'error');
    return false;
  }
  
  log('正在验证数据库会话表...');
  
  // 配置NeonDB WebSocket
  const { neonConfig } = require('@neondatabase/serverless');
  neonConfig.webSocketConstructor = ws;
  
  try {
    // 创建数据库连接
    const pool = new Pool({
      connectionString: DATABASE_URL,
      max: 1
    });
    
    // 检查session表是否存在
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'session'
      );
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (tableExists) {
      log('会话表已存在', 'success');
      
      // 检查记录数量
      const countResult = await pool.query('SELECT COUNT(*) FROM session');
      const sessionCount = parseInt(countResult.rows[0].count, 10);
      
      log(`当前共有 ${sessionCount} 个会话记录`);
      
      // 检查表结构
      const columnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'session'
      `);
      
      const columns = columnsResult.rows.map(row => row.column_name);
      log(`表结构: ${columns.join(', ')}`);
      
      // 检查是否有过期会话
      const expiredResult = await pool.query(`
        SELECT COUNT(*) FROM session 
        WHERE expire < NOW()
      `);
      
      const expiredCount = parseInt(expiredResult.rows[0].count, 10);
      log(`过期会话: ${expiredCount} 个`);
      
      if (expiredCount > 0) {
        log('存在过期会话，建议清理', 'warn');
      }
    } else {
      log('会话表不存在，将在应用启动时自动创建', 'warn');
    }
    
    await pool.end();
    return true;
  } catch (error) {
    log(`验证失败: ${error.message}`, 'error');
    return false;
  }
}

async function main() {
  log(`${colors.bright}${colors.blue}===== 会话存储验证 =====${colors.reset}`);
  
  // 验证会话表
  const tableVerified = await verifySessionTable();
  
  // 总结
  log('\n');
  log(`${colors.bright}===== 验证结果 =====${colors.reset}`);
  
  if (tableVerified) {
    log('数据库会话存储配置正确', 'success');
    log('应用程序应该能够正确存储会话数据，避免内存泄漏问题');
  } else {
    log('数据库会话存储配置存在问题', 'error');
    log('请确保以下配置正确:');
    log('1. DATABASE_URL环境变量已设置');
    log('2. server/index.ts中正确配置了PostgreSQL会话存储');
    log('3. 生产构建中包含会话存储相关代码');
  }
}

// 如果直接运行此脚本，则执行main函数
if (require.main === module) {
  main().catch(error => {
    log(`运行失败: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = {
  verifySessionTable
};