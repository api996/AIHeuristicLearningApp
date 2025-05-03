/**
 * 全量记忆向量嵌入修复脚本
 * 使用与服务器端一致的Gemini API重新生成所有记忆的向量嵌入
 */

import axios from 'axios';
import pg from 'pg';
import fs from 'fs';

// 环境变量
const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 创建日志文件
const LOG_FILE = './fix_embedding_results.log';
// 初始化日志文件
fs.writeFileSync(LOG_FILE, `开始修复向量嵌入 - ${new Date().toISOString()}\n`, 'utf8');

// 数据库连接
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

/**
 * 打印彩色日志并输出到文件
 */
function log(message, type = 'info') {
  const date = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
  };
  const color = colors[type] || colors.info;
  const logMessage = `[${date}] [${type.toUpperCase()}] ${message}`;
  console.log(`${color}${logMessage}\x1b[0m`);
  
  // 同时输出到文件
  fs.appendFileSync(LOG_FILE, logMessage + '\n', 'utf8');
}

/**
 * 使用Gemini API生成向量嵌入
 */
async function generateEmbedding(text) {
  log(`生成文本嵌入: "${text.substring(0, 50)}..."`);
  
  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-embedding-exp-03-07:embedContent',
      {
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
      },
      {
        params: { key: GEMINI_API_KEY },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    const embedding = response.data.embedding;
    log(`成功生成向量嵌入，维度: ${embedding.values.length}`, 'success');
    return embedding.values;
  } catch (error) {
    log(`调用Gemini API失败: ${error.response?.data?.error?.message || error.message}`, 'error');
    throw error;
  }
}

/**
 * 保存记忆的向量嵌入到数据库
 */
async function saveMemoryEmbedding(memoryId, vectorData) {
  try {
    // 先检查是否已存在向量嵌入
    const checkResult = await pool.query(
      'SELECT id FROM memory_embeddings WHERE memory_id = $1',
      [memoryId]
    );

    if (checkResult.rows.length > 0) {
      // 如果已存在，更新向量数据
      const embeddingId = checkResult.rows[0].id;
      log(`更新记忆 ${memoryId} 的向量嵌入（ID: ${embeddingId}）`);

      await pool.query(
        'UPDATE memory_embeddings SET vector_data = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify({ vector: vectorData }), embeddingId]
      );
      log(`向量嵌入已更新，记忆ID: ${memoryId}`, 'success');
    } else {
      // 如果不存在，创建新的向量嵌入记录
      log(`为记忆 ${memoryId} 创建新的向量嵌入`);

      await pool.query(
        'INSERT INTO memory_embeddings (memory_id, vector_data, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
        [memoryId, JSON.stringify({ vector: vectorData })]
      );
      log(`向量嵌入已保存，记忆ID: ${memoryId}`, 'success');
    }
    return true;
  } catch (error) {
    log(`保存向量嵌入失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 检查向量维度是否正确
 */
async function checkVectorDimensions() {
  try {
    log('开始检查向量维度...');
    
    const result = await pool.query(
      'SELECT memory_id, jsonb_array_length(vector_data->>\'vector\') as dimensions FROM memory_embeddings LIMIT 10'
    );

    if (result.rows.length === 0) {
      log('没有找到向量嵌入记录', 'warning');
      return [];
    }

    // 分析维度情况
    const dimensionCounts = {};
    for (const row of result.rows) {
      const dim = parseInt(row.dimensions);
      dimensionCounts[dim] = (dimensionCounts[dim] || 0) + 1;
      log(`记忆 ${row.memory_id} 的向量维度: ${dim}`);
    }

    // 输出维度分布
    log('向量维度分布:');
    for (const [dim, count] of Object.entries(dimensionCounts)) {
      log(`  ${dim} 维向量: ${count} 条`);
    }

    return result.rows;
  } catch (error) {
    log(`检查向量维度时出错: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 清除所有用户的聚类缓存
 */
async function clearAllClusterCache() {
  try {
    const result = await pool.query(
      'DELETE FROM cluster_result_cache'
    );
    log(`已清除所有聚类缓存，影响行数: ${result.rowCount}`, 'success');
    return true;
  } catch (error) {
    log(`清除聚类缓存失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 获取需要处理的记忆
 */
async function getMemoriesNeedingFix(limit = 10) {
  try {
    // 两种情况需要修复：
    // 1. 没有向量嵌入的记忆
    // 2. 向量维度不是3072的记忆
    
    // 首先获取没有向量嵌入的记忆
    const missingResult = await pool.query(
      `SELECT m.id, m.content, m.user_id 
       FROM memories m 
       LEFT JOIN memory_embeddings e ON m.id = e.memory_id 
       WHERE e.id IS NULL AND LENGTH(m.content) > 10
       LIMIT $1`,
      [limit]
    );
    
    const memoriesWithoutEmbeddings = missingResult.rows;
    log(`没有向量嵌入的记忆数量: ${memoriesWithoutEmbeddings.length}`);
    
    // 如果没有足够的记录，再获取向量维度不正确的记录
    if (memoriesWithoutEmbeddings.length < limit) {
      const wrongDimResult = await pool.query(
        `SELECT m.id, m.content, m.user_id 
         FROM memories m 
         JOIN memory_embeddings e ON m.id = e.memory_id 
         WHERE jsonb_array_length(e.vector_data->>'vector') != 3072 
         LIMIT $1`,
        [limit - memoriesWithoutEmbeddings.length]
      );
      
      const memoriesWithWrongDimensions = wrongDimResult.rows;
      log(`向量维度不正确的记忆数量: ${memoriesWithWrongDimensions.length}`);
      
      return [...memoriesWithoutEmbeddings, ...memoriesWithWrongDimensions];
    }
    
    return memoriesWithoutEmbeddings;
  } catch (error) {
    log(`获取需要修复的记忆时出错: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 分批处理记忆
 */
async function processBatch(batchSize = 10, maxTotal = 100) {
  try {
    let processedCount = 0;
    let successCount = 0;
    
    while (processedCount < maxTotal) {
      const memories = await getMemoriesNeedingFix(batchSize);
      
      if (memories.length === 0) {
        log('没有需要修复的记忆了', 'success');
        break;
      }
      
      log(`开始处理批次，共 ${memories.length} 条记录`);
      
      for (const memory of memories) {
        try {
          log(`处理记忆 ${memory.id}，用户ID: ${memory.user_id}`);
          
          // 生成向量嵌入
          const vectorData = await generateEmbedding(memory.content);
          
          // 检查维度
          if (vectorData.length !== 3072) {
            log(`警告: 生成的向量维度为 ${vectorData.length}，而不是预期的 3072`, 'warning');
          }
          
          // 保存向量嵌入
          await saveMemoryEmbedding(memory.id, vectorData);
          
          successCount++;
          log(`记忆 ${memory.id} 处理成功`, 'success');
        } catch (memoryError) {
          log(`处理记忆 ${memory.id} 失败: ${memoryError.message}`, 'error');
        }
        
        processedCount++;
        if (processedCount >= maxTotal) break;
      }
      
      // 批次间隔
      log(`批次完成，已处理 ${processedCount} 条，成功 ${successCount} 条`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
    }
    
    return { processedCount, successCount };
  } catch (error) {
    log(`批处理失败: ${error.message}`, 'error');
    return { processedCount: 0, successCount: 0 };
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    log('开始全量记忆向量嵌入修复...');
    
    // 检查当前向量维度状况
    await checkVectorDimensions();
    
    // 清除所有聚类缓存
    await clearAllClusterCache();
    
    // 分批处理记忆
    const { processedCount, successCount } = await processBatch(10, 50);
    
    log(`全部处理完成，总共处理 ${processedCount} 条记录，成功 ${successCount} 条`, 'success');
    
    // 再次检查向量维度状况
    await checkVectorDimensions();
  } catch (error) {
    log(`脚本执行失败: ${error.message}`, 'error');
  } finally {
    pool.end();
    log('已关闭数据库连接');
  }
}

main();
