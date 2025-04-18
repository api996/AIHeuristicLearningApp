#!/usr/bin/env node

/**
 * 过期会话清理脚本
 * 用于定期清理数据库中的过期会话记录，降低数据库体积
 */

import { Pool } from '@neondatabase/serverless';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// 配置数据库连接
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('错误: 未设置DATABASE_URL环境变量');
  process.exit(1);
}

// 配置NeonDB WebSocket
neonConfig.webSocketConstructor = ws;

async function cleanupExpiredSessions() {
  console.log('开始清理过期会话...');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1
  });
  
  try {
    // 首先检查session表是否存在
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'session'
      );
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('会话表不存在，无需清理');
      return { deleted: 0, error: null };
    }
    
    // 获取当前会话总数
    const countResult = await pool.query('SELECT COUNT(*) FROM session');
    const totalCount = parseInt(countResult.rows[0].count, 10);
    console.log(`当前会话总数: ${totalCount}`);
    
    // 获取过期会话数量
    const expiredResult = await pool.query(`
      SELECT COUNT(*) FROM session 
      WHERE expire < NOW()
    `);
    
    const expiredCount = parseInt(expiredResult.rows[0].count, 10);
    console.log(`过期会话数量: ${expiredCount}`);
    
    if (expiredCount === 0) {
      console.log('没有过期会话，无需清理');
      return { deleted: 0, error: null };
    }
    
    // 删除过期会话
    const deleteResult = await pool.query(`
      DELETE FROM session 
      WHERE expire < NOW()
      RETURNING sid
    `);
    
    const deletedCount = deleteResult.rowCount;
    console.log(`成功删除 ${deletedCount} 个过期会话`);
    
    // 获取清理后的会话总数
    const afterCountResult = await pool.query('SELECT COUNT(*) FROM session');
    const afterTotalCount = parseInt(afterCountResult.rows[0].count, 10);
    console.log(`清理后会话总数: ${afterTotalCount}`);
    
    // 获取会话表大小
    const tableSizeResult = await pool.query(`
      SELECT pg_size_pretty(pg_total_relation_size('session')) as table_size;
    `);
    
    console.log(`会话表当前大小: ${tableSizeResult.rows[0].table_size}`);
    
    return { deleted: deletedCount, error: null };
  } catch (error) {
    console.error(`清理过期会话时出错: ${error.message}`);
    return { deleted: 0, error: error.message };
  } finally {
    await pool.end();
  }
}

// 使用IIFE立即执行函数来处理顶级await
(async () => {
  try {
    const result = await cleanupExpiredSessions();
    if (result.error) {
      console.error(`清理失败: ${result.error}`);
      process.exit(1);
    } else {
      console.log(`清理完成，共删除 ${result.deleted} 个过期会话`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`执行出错: ${error.message}`);
    process.exit(1);
  }
})();

// ESM导出
export { cleanupExpiredSessions };