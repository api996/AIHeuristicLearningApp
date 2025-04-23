/**
 * 向量维度修复脚本
 * 用于检查和修复记忆向量嵌入的维度，确保所有向量都是3072维
 */

// 使用CommonJS导入
const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { eq, ne, and } = require('drizzle-orm');
const schema = require('./shared/schema');

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
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

/**
 * 检查并报告向量维度情况
 */
async function checkVectorDimensions() {
  try {
    log('===== 开始检查向量维度 =====', 'info');

    // 查询所有带有嵌入向量的记忆
    const embeddings = await db.select({
      id: schema.memoryEmbeddings.id,
      memoryId: schema.memoryEmbeddings.memoryId,
      vectorData: schema.memoryEmbeddings.vectorData
    })
    .from(schema.memoryEmbeddings);

    log(`找到 ${embeddings.length} 条向量嵌入记录`, 'info');
    
    // 按维度分组统计
    const dimensionCounts = {};
    const invalidEmbeddings = [];

    for (const embedding of embeddings) {
      if (!embedding.vectorData || !Array.isArray(embedding.vectorData)) {
        invalidEmbeddings.push(embedding.memoryId);
        continue;
      }

      const dimension = embedding.vectorData.length;
      dimensionCounts[dimension] = (dimensionCounts[dimension] || 0) + 1;
    }

    // 报告维度统计
    log('向量维度统计:', 'info');
    for (const [dimension, count] of Object.entries(dimensionCounts)) {
      log(`  ${dimension} 维: ${count} 条`, dimension === '3072' ? 'success' : 'warn');
    }

    if (invalidEmbeddings.length > 0) {
      log(`发现 ${invalidEmbeddings.length} 条无效嵌入`, 'warn');
      for (let i = 0; i < Math.min(5, invalidEmbeddings.length); i++) {
        log(`  - 记忆ID: ${invalidEmbeddings[i]}`, 'warn');
      }
      if (invalidEmbeddings.length > 5) {
        log(`  ... 以及其他 ${invalidEmbeddings.length - 5} 条`, 'warn');
      }
    }

    return {
      dimensionCounts,
      invalidEmbeddings
    };
  } catch (error) {
    log(`检查向量维度时出错: ${error}`, 'error');
    throw error;
  }
}

/**
 * 修复非3072维的向量嵌入
 */
async function fixVectorDimensions() {
  try {
    log('===== 开始修复向量维度 =====', 'info');

    // 首先检查
    const { dimensionCounts, invalidEmbeddings } = await checkVectorDimensions();

    // 如果所有向量都是3072维的，则不需要修复
    if (Object.keys(dimensionCounts).length === 1 && dimensionCounts['3072']) {
      log('所有向量都已经是3072维，无需修复', 'success');
      return;
    }

    // 1. 查找所有非3072维的嵌入
    log('查询非3072维的嵌入...', 'info');
    // 使用原始SQL
    const { rows: embeddingsToFix } = await pool.query(`
      SELECT id, memory_id
      FROM memory_embeddings
      WHERE jsonb_array_length(vector_data) != 3072
    `);

    log(`找到 ${embeddingsToFix.length} 条需要修复的嵌入`, 'info');

    // 2. 删除这些嵌入，这样系统会自动重新生成它们
    for (const embedding of embeddingsToFix) {
      // 删除嵌入
      await pool.query(`
        DELETE FROM memory_embeddings
        WHERE id = $1
      `, [embedding.id]);
      
      log(`已删除记忆 ${embedding.memory_id} 的嵌入向量`, 'info');
    }

    log(`已删除 ${embeddingsToFix.length} 条非3072维的嵌入向量`, 'success');
    log('系统将在定时任务中自动重新生成这些嵌入', 'info');

  } catch (error) {
    log(`修复向量维度时出错: ${error}`, 'error');
    throw error;
  }
}

// 执行向量维度检查和修复
async function main() {
  try {
    // 首先检查
    await checkVectorDimensions();
    
    // 询问用户是否要修复
    const shouldFix = process.argv.includes('--fix');
    
    if (shouldFix) {
      await fixVectorDimensions();
      
      // 再次检查以确认修复结果
      await checkVectorDimensions();
    } else {
      log('若要修复向量维度，请使用 --fix 参数运行此脚本', 'info');
    }
    
  } catch (error) {
    log(`执行失败: ${error}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
    process.exit(0);
  }
}

// 执行主函数
main();