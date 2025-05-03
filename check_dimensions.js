/**
 * 向量维度检查脚本
 * 这个脚本直接使用SQL来检查向量的维度
 */

import pg from 'pg';

// 连接到数据库
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
 * 检查向量维度
 */
async function checkVectorDimensions() {
  const client = await pool.connect();
  
  try {
    log('=== 检查记忆向量维度 ===', 'info');
    
    // 获取总记忆数
    const totalMemoriesResult = await client.query('SELECT COUNT(*) AS count FROM memories');
    const totalMemories = parseInt(totalMemoriesResult.rows[0].count);
    
    // 获取已有嵌入向量的记忆数
    const withEmbeddingsResult = await client.query('SELECT COUNT(*) AS count FROM memory_embeddings');
    const withEmbeddings = parseInt(withEmbeddingsResult.rows[0].count);
    
    // 获取不同维度的记忆数量
    const dimensionsResult = await client.query(`
      SELECT 
        json_array_length(vector_data) as dimensions, 
        COUNT(*) as count 
      FROM memory_embeddings 
      GROUP BY dimensions 
      ORDER BY dimensions
    `);
    
    log(`总记忆数: ${totalMemories}`, 'info');
    log(`已有嵌入向量的记忆数: ${withEmbeddings}`, 'info');
    log(`缺失嵌入向量的记忆数: ${totalMemories - withEmbeddings}`, 'info');
    log(`完成百分比: ${(withEmbeddings / totalMemories * 100).toFixed(2)}%`, 'success');
    
    log('\n各维度向量统计:', 'info');
    dimensionsResult.rows.forEach(row => {
      const dimensions = parseInt(row.dimensions);
      const count = parseInt(row.count);
      const percentage = (count / withEmbeddings * 100).toFixed(2);
      log(`  维度 ${dimensions}: ${count} 条 (${percentage}%)`, dimensions === 3072 ? 'success' : 'warning');
    });
    
    // 获取缺失嵌入向量的记忆IDs
    const missingEmbeddingsResult = await client.query(`
      SELECT m.id 
      FROM memories m 
      WHERE NOT EXISTS (
        SELECT 1 FROM memory_embeddings me 
        WHERE me.memory_id = m.id
      )
      LIMIT 5
    `);
    
    if (missingEmbeddingsResult.rows.length > 0) {
      log('\n缺失嵌入向量的记忆IDs:', 'warning');
      missingEmbeddingsResult.rows.forEach((row, index) => {
        log(`  ${index + 1}. ${row.id}`, 'warning');
      });
      
      // 如果有非3072维度的记忆，获取一些样本
      const nonStandardResult = await client.query(`
        SELECT me.memory_id, json_array_length(me.vector_data) as dimensions
        FROM memory_embeddings me
        WHERE json_array_length(me.vector_data) != 3072
        LIMIT 5
      `);
      
      if (nonStandardResult.rows.length > 0) {
        log('\n有非3072维度的记忆IDs:', 'warning');
        nonStandardResult.rows.forEach((row, index) => {
          log(`  ${index + 1}. ${row.memory_id} (维度: ${row.dimensions})`, 'warning');
        });
      }
    }
    
    // 获取最近创建的记忆
    const recentMemoriesResult = await client.query(`
      SELECT m.id, m.content, m.user_id, EXISTS(
        SELECT 1 FROM memory_embeddings me WHERE me.memory_id = m.id
      ) as has_embedding
      FROM memories m
      ORDER BY m.timestamp DESC
      LIMIT 5
    `);
    
    log('\n最近创建的记忆:', 'info');
    recentMemoriesResult.rows.forEach((row, index) => {
      const hasEmbedding = row.has_embedding ? '✅' : '❌';
      const content = row.content.length > 50 ? row.content.substring(0, 50) + '...' : row.content;
      log(`  ${index + 1}. ${row.id} [${hasEmbedding}] - 用户ID: ${row.user_id} - ${content}`, row.has_embedding ? 'success' : 'warning');
    });
    
  } catch (error) {
    log(`错误: ${error.message}`, 'error');
  } finally {
    client.release();
  }
}

// 运行脚本
checkVectorDimensions().catch(error => log(`脚本运行时出错: ${error.message}`, 'error')).finally(() => pool.end());