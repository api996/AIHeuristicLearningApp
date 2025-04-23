/**
 * 向量维度检查脚本
 * 使用直接的SQL查询检查记忆向量嵌入的维度
 */

const { Pool } = require('pg');
const fs = require('fs');

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
    
    // 查询所有嵌入向量
    const { rows: embeddings } = await pool.query(`
      SELECT id, memory_id, vector_data
      FROM memory_embeddings
      LIMIT 100
    `);
    
    log(`检查了 ${embeddings.length} 条向量嵌入`, 'info');
    
    // 手动计算维度分布
    const dimensionCounts = {};
    let invalidCount = 0;
    
    for (const embedding of embeddings) {
      try {
        // 尝试从JSON解析向量数据
        const vectorData = embedding.vector_data;
        if (!vectorData || !Array.isArray(vectorData)) {
          invalidCount++;
          continue;
        }
        
        const dimension = vectorData.length;
        dimensionCounts[dimension] = (dimensionCounts[dimension] || 0) + 1;
      } catch (err) {
        invalidCount++;
      }
    }
    
    // 打印维度统计
    log('向量维度统计:', 'info');
    for (const [dimension, count] of Object.entries(dimensionCounts)) {
      const percentage = (count / embeddings.length * 100).toFixed(2);
      const status = dimension == 3072 ? 'success' : 'warn';
      log(`  ${dimension} 维: ${count} 条 (${percentage}%)`, status);
    }
    
    if (invalidCount > 0) {
      log(`无效向量: ${invalidCount} 条`, 'warn');
    }
    
    // 检查是否需要修复
    const needsFix = Object.keys(dimensionCounts).some(dim => dim != 3072) || invalidCount > 0;
    if (needsFix) {
      log('存在非3072维向量，需要修复', 'warn');
      log('请运行 `node check_dimensions.cjs --fix` 来修复', 'info');
    } else {
      log('所有向量维度都是3072，无需修复', 'success');
    }
    
    // 随机抽样一个向量记录其长度
    if (embeddings.length > 0) {
      const sample = embeddings[0];
      if (sample.vector_data && Array.isArray(sample.vector_data)) {
        log(`向量样本 (ID: ${sample.memory_id}) 长度: ${sample.vector_data.length}`, 'info');
        log(`向量样本前5个值: ${sample.vector_data.slice(0, 5).join(', ')}`, 'info');
      }
    }
    
    return { 
      dimensionCounts, 
      invalidCount,
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
    
    // 获取所有嵌入记录
    const { rows: embeddings } = await pool.query(`
      SELECT id, memory_id, vector_data
      FROM memory_embeddings
    `);
    
    log(`检查 ${embeddings.length} 条嵌入记录`, 'info');
    
    let fixedCount = 0;
    for (const embedding of embeddings) {
      try {
        // 检查向量维度
        const vectorData = embedding.vector_data;
        if (!vectorData || !Array.isArray(vectorData) || vectorData.length !== 3072) {
          // 删除非3072维的向量嵌入
          await pool.query(`
            DELETE FROM memory_embeddings
            WHERE id = $1
          `, [embedding.id]);
          
          fixedCount++;
          log(`已删除记忆 ${embedding.memory_id} 的嵌入向量 (维度: ${vectorData ? vectorData.length : 'invalid'})`, 'info');
        }
      } catch (err) {
        log(`处理嵌入 ${embedding.id} 时出错: ${err}`, 'error');
      }
    }
    
    log(`已删除 ${fixedCount} 条非3072维的向量嵌入`, 'success');
    log('系统将在下一次定时任务中自动重新生成这些嵌入', 'info');
    
    return fixedCount;
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