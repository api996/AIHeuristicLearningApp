/**
 * 获取向量嵌入统计数据
 * 直接使用SQL查询数据库来获取向量嵌入的统计信息
 */

import pg from 'pg';

// 创建数据库连接池
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// 日志颜色
const colors = {
  info: '\x1b[36m',    // 青色
  success: '\x1b[32m', // 绿色
  warning: '\x1b[33m', // 黄色
  error: '\x1b[31m',   // 红色
  reset: '\x1b[0m',    // 重置颜色
};

function log(message, type = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 获取向量嵌入统计信息
 */
async function getEmbeddingStats() {
  const client = await pool.connect();
  
  try {
    log('=== 向量嵌入统计信息 ===', 'info');
    
    // 获取总记忆数
    const totalMemoriesResult = await client.query('SELECT COUNT(*) AS count FROM memories');
    const totalMemories = parseInt(totalMemoriesResult.rows[0].count);
    
    // 获取已有嵌入向量的记忆数
    const withEmbeddingsResult = await client.query('SELECT COUNT(*) AS count FROM memory_embeddings');
    const withEmbeddings = parseInt(withEmbeddingsResult.rows[0].count);
    
    // 获取各用户的记忆统计
    const userStatsResult = await client.query(`
      SELECT 
        m.user_id,
        COUNT(*) AS total_memories,
        SUM(CASE WHEN me.memory_id IS NOT NULL THEN 1 ELSE 0 END) AS with_embeddings
      FROM memories m
      LEFT JOIN memory_embeddings me ON m.id = me.memory_id
      GROUP BY m.user_id
      ORDER BY m.user_id
    `);
    
    log(`总记忆数: ${totalMemories}`, 'info');
    log(`已有嵌入向量的记忆数: ${withEmbeddings}`, 'info');
    log(`缺失嵌入向量的记忆数: ${totalMemories - withEmbeddings}`, 'info');
    
    const completionPercentage = (withEmbeddings / totalMemories * 100).toFixed(2);
    log(`完成百分比: ${completionPercentage}%`, parseFloat(completionPercentage) >= 90 ? 'success' : 'warning');
    
    // 各用户的记忆统计
    log('\n各用户的记忆统计:', 'info');
    log('-------------------------', 'info');
    log('用户ID | 总记忆数 | 已有嵌入数 | 完成率', 'info');
    log('-------------------------', 'info');
    
    userStatsResult.rows.forEach(row => {
      const userId = row.user_id;
      const totalUserMemories = parseInt(row.total_memories);
      const withUserEmbeddings = parseInt(row.with_embeddings);
      const userCompletionPercentage = (withUserEmbeddings / totalUserMemories * 100).toFixed(2);
      
      log(`${userId.toString().padEnd(6)} | ${totalUserMemories.toString().padEnd(8)} | ${withUserEmbeddings.toString().padEnd(10)} | ${userCompletionPercentage}%`, 
        parseFloat(userCompletionPercentage) >= 90 ? 'success' : 'warning');
    });
    
    // 获取缺失嵌入向量的开始记忆列表
    const missingEmbeddingsResult = await client.query(`
      SELECT m.id, m.user_id, LEFT(m.content, 50) as content_preview
      FROM memories m
      WHERE NOT EXISTS (
        SELECT 1 FROM memory_embeddings me 
        WHERE me.memory_id = m.id
      )
      ORDER BY m.timestamp DESC
      LIMIT 5
    `);
    
    if (missingEmbeddingsResult.rows.length > 0) {
      log('\n缺失嵌入向量的记忆样本:', 'warning');
      missingEmbeddingsResult.rows.forEach((row, index) => {
        log(`${index + 1}. ID: ${row.id}, 用户ID: ${row.user_id}, 内容: ${row.content_preview}${row.content_preview.length >= 50 ? '...' : ''}`, 'warning');
      });
    } else {
      log('\n所有记忆都已有嵌入向量!', 'success');
    }
    
  } catch (error) {
    log(`错误: ${error.message}`, 'error');
  } finally {
    client.release();
  }
}

// 运行脚本
getEmbeddingStats().catch(error => log(`脚本运行时出错: ${error.message}`, 'error')).finally(() => pool.end());
