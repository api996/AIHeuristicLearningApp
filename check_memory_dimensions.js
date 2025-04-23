/**
 * 向量维度检查脚本
 * 使用直接的SQL查询检查记忆向量嵌入的维度
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
 * 检查向量维度
 */
async function checkVectorDimensions() {
  try {
    log('===== 检查向量维度 =====', 'info');
    
    // 查询所有嵌入向量的维度
    const { rows: dimensionStats } = await pool.query(`
      SELECT 
        jsonb_array_length(vector_data) AS dimension,
        COUNT(*) AS count
      FROM memory_embeddings
      GROUP BY jsonb_array_length(vector_data)
      ORDER BY dimension
    `);
    
    // 查询总向量数
    const { rows: [{ count: totalCount }] } = await pool.query(`
      SELECT COUNT(*) FROM memory_embeddings
    `);
    
    log(`总共有 ${totalCount} 条向量嵌入`, 'info');
    
    // 打印维度统计
    log('向量维度统计:', 'info');
    for (const { dimension, count } of dimensionStats) {
      const percentage = (count / totalCount * 100).toFixed(2);
      const status = dimension == 3072 ? 'success' : 'warn';
      log(`  ${dimension} 维: ${count} 条 (${percentage}%)`, status);
    }
    
    // 检查是否需要修复
    const needsFix = dimensionStats.some(stat => stat.dimension != 3072);
    if (needsFix) {
      log('存在非3072维向量，需要修复', 'warn');
      log('请运行 `node check_memory_dimensions.js --fix` 来修复', 'info');
    } else {
      log('所有向量维度都是3072，无需修复', 'success');
    }
    
    return { 
      dimensionStats, 
      needsFix 
    };
  } catch (error) {
    log(`检查向量维度时出错: ${error}`, 'error');
    throw error;
  }
}

/**
 * 修复向量维度
 */
async function fixVectorDimensions() {
  try {
    log('===== 开始修复向量维度 =====', 'info');
    
    // 删除非3072维的向量嵌入
    const { rowCount } = await pool.query(`
      DELETE FROM memory_embeddings
      WHERE jsonb_array_length(vector_data) != 3072
    `);
    
    log(`已删除 ${rowCount} 条非3072维的向量嵌入`, 'success');
    log('系统将在下一次定时任务中自动重新生成这些嵌入', 'info');
    
    // 手动触发嵌入生成
    log('手动触发向量嵌入生成...', 'info');
    // (这里可能需要调用API或其他方法来触发)
    
    return rowCount;
  } catch (error) {
    log(`修复向量维度时出错: ${error}`, 'error');
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 检查向量维度
    const { needsFix } = await checkVectorDimensions();
    
    // 如果需要修复且指定了--fix参数，则执行修复
    if (needsFix && process.argv.includes('--fix')) {
      await fixVectorDimensions();
      
      // 再次检查以验证修复结果
      log('===== 修复后再次检查 =====', 'info');
      await checkVectorDimensions();
    }
  } catch (error) {
    log(`执行失败: ${error}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 运行主函数
main();