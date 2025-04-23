/**
 * 记忆向量嵌入监控脚本
 * 用于监控向量嵌入的生成进度和维度一致性
 */

const { Pool } = require('pg');

// 简单的日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m',    // 黄色
    error: '\x1b[31m',   // 红色
    reset: '\x1b[0m'     // 重置
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

// 初始化数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * 监控向量嵌入生成进度
 * 
 * 1. 检查有多少记忆没有对应的向量嵌入
 * 2. 检查向量维度分布
 * 3. 检查向量嵌入对应的记忆数量
 */
async function monitorEmbeddingsProgress() {
  try {
    log('===== 向量嵌入监控 =====', 'info');
    
    // 查询总记忆数量
    const { rows: [{ count: totalMemories }] } = await pool.query(`
      SELECT COUNT(*) FROM memories
    `);
    
    // 查询有向量嵌入的记忆数量
    const { rows: [{ count: memoriesWithEmbeddings }] } = await pool.query(`
      SELECT COUNT(DISTINCT memory_id) 
      FROM memory_embeddings
    `);
    
    // 查询向量维度分布
    const { rows: dimensions } = await pool.query(`
      SELECT 
        json_array_length(vector_data) as dimension,
        COUNT(*) as count
      FROM memory_embeddings
      GROUP BY dimension
      ORDER BY dimension
    `);
    
    // 计算百分比
    const embeddingsPercentage = Math.round((memoriesWithEmbeddings / totalMemories) * 100);
    
    // 打印统计信息
    log(`总记忆数量: ${totalMemories}`, 'info');
    log(`已有向量嵌入的记忆数量: ${memoriesWithEmbeddings} (${embeddingsPercentage}%)`, embeddingsPercentage === 100 ? 'success' : 'info');
    
    if (totalMemories > memoriesWithEmbeddings) {
      log(`待生成向量嵌入的记忆数量: ${totalMemories - memoriesWithEmbeddings}`, 'warn');
    }
    
    // 打印维度分布
    log('向量维度分布:', 'info');
    for (const { dimension, count } of dimensions) {
      const status = dimension == 3072 ? 'success' : 'warn';
      log(`  ${dimension} 维: ${count} 条`, status);
    }
    
    return {
      totalMemories,
      memoriesWithEmbeddings,
      dimensions: dimensions.map(d => ({ dimension: d.dimension, count: parseInt(d.count) }))
    };
  } catch (error) {
    log(`监控向量嵌入时出错: ${error}`, 'error');
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    await monitorEmbeddingsProgress();
  } catch (error) {
    log(`执行失败: ${error}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 运行主函数
main();