/**
 * 检查记忆向量嵌入的进度和结果
 * 这个脚本可以运行来检查有多少记忆拥有向量嵌入
 */
import pg from 'pg';
const { Pool } = pg;

// 使用环境变量获取数据库连接信息
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m'    // 红色
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}${message}${reset}`);
}

/**
 * 获取记忆嵌入的统计信息
 */
async function getMemoryEmbeddingStatistics() {
  try {
    // 获取总记忆数
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM memories'
    );
    const total = parseInt(totalResult.rows[0].total);
    
    // 获取带嵌入的记忆数
    const embeddedResult = await pool.query(
      'SELECT COUNT(*) as count FROM memory_embeddings'
    );
    const embedded = parseInt(embeddedResult.rows[0].count);
    
    // 获取没有嵌入的记忆数
    const missingResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM memories m 
      WHERE NOT EXISTS (
        SELECT 1 FROM memory_embeddings e 
        WHERE e.memory_id = m.id
      )
    `);
    const missing = parseInt(missingResult.rows[0].count);
    
    return { total, embedded, missing };
  } catch (error) {
    log(`获取统计信息出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 获取最近处理的记忆
 */
async function getRecentlyProcessedMemories(limit = 5) {
  try {
    // 检查memory_embeddings表的列名
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'memory_embeddings'
    `);
    
    const columns = columnsResult.rows.map(row => row.column_name);
    log(`memory_embeddings表的列: ${columns.join(', ')}`, 'info');
    
    // 使用不依赖于created_at的查询
    const result = await pool.query(`
      SELECT m.id, m.user_id, m.summary, m.created_at, 
             jsonb_array_length(e.vector_data::jsonb) as dimensions
      FROM memory_embeddings e
      JOIN memories m ON e.memory_id = m.id
      ORDER BY m.id DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  } catch (error) {
    log(`获取最近处理记录出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 获取各用户的记忆嵌入统计
 */
async function getUserStatistics() {
  try {
    const result = await pool.query(`
      SELECT 
        m.user_id,
        COUNT(m.id) as total_memories,
        COUNT(e.memory_id) as embedded_memories,
        COUNT(m.id) - COUNT(e.memory_id) as missing_embeddings
      FROM 
        memories m
      LEFT JOIN 
        memory_embeddings e ON m.id = e.memory_id
      GROUP BY 
        m.user_id
      ORDER BY 
        missing_embeddings DESC
    `);
    
    return result.rows;
  } catch (error) {
    log(`获取用户统计出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  log("=== 检查记忆向量嵌入状态 ===", 'info');
  
  try {
    // 获取统计信息
    const stats = await getMemoryEmbeddingStatistics();
    log(`总记忆数: ${stats.total}`, 'info');
    log(`已有嵌入的记忆数: ${stats.embedded}`, 'success');
    log(`缺少嵌入的记忆数: ${stats.missing}`, 'warning');
    
    if (stats.embedded > 0) {
      // 显示最近处理的记录
      log("\n最近处理的记忆:", 'info');
      const recentMemories = await getRecentlyProcessedMemories(5);
      
      recentMemories.forEach(memory => {
        log(`[${memory.id}] 用户ID: ${memory.user_id}, 维度: ${memory.dimensions}, 摘要: ${memory.summary || '无摘要'}`, 'success');
      });
    }
    
    // 显示用户统计
    log("\n用户统计:", 'info');
    const userStats = await getUserStatistics();
    
    userStats.forEach(stat => {
      log(`用户ID: ${stat.user_id}, 总记忆数: ${stat.total_memories}, 已有嵌入: ${stat.embedded_memories}, 缺少嵌入: ${stat.missing_embeddings}`, 
          stat.missing_embeddings > 0 ? 'warning' : 'success');
    });
    
  } catch (error) {
    log(`脚本执行失败: ${error.message}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 运行主函数
main().catch(e => log(`脚本执行异常: ${e.message}`, 'error'));