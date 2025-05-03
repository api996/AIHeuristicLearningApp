/**
 * 黄金价格记忆向量嵌入修复脚本 (ESM版本)
 * 为特定的黄金价格记忆生成向量嵌入并触发聚类重新计算
 */

import axios from 'axios';
import pg from 'pg';

// 环境变量
const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 数据库连接
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

/**
 * 打印彩色日志
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
  console.log(`${color}[${date}] [${type.toUpperCase()}] ${message}\x1b[0m`);
}

/**
 * 使用Gemini API生成向量嵌入（保持与系统中其他嵌入一致）
 */
async function generateEmbedding(text) {
  log(`生成文本嵌入: "${text}"`);
  
  try {
    // 这里使用正确的Gemini模型和API路径
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
 * 清除用户的聚类缓存，强制重新计算
 */
async function clearClusterCache(userId) {
  try {
    const result = await pool.query(
      'DELETE FROM cluster_result_cache WHERE user_id = $1',
      [userId]
    );
    log(`已清除用户 ${userId} 的聚类缓存，影响行数: ${result.rowCount}`, 'success');
    return true;
  } catch (error) {
    log(`清除聚类缓存失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 获取记忆内容
 */
async function getMemoryContent(memoryId) {
  try {
    const result = await pool.query(
      'SELECT content, user_id FROM memories WHERE id = $1',
      [memoryId]
    );

    if (result.rows.length === 0) {
      log(`记忆 ${memoryId} 不存在`, 'error');
      return null;
    }

    return {
      content: result.rows[0].content,
      userId: result.rows[0].user_id
    };
  } catch (error) {
    log(`获取记忆内容失败: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 处理特定记忆ID
 */
async function processMemory(memoryId) {
  try {
    // 1. 获取记忆内容
    const memoryData = await getMemoryContent(memoryId);
    if (!memoryData) {
      log(`跳过记忆 ${memoryId}: 无法获取内容`, 'warning');
      return false;
    }

    // 2. 生成向量嵌入
    log(`处理记忆 ${memoryId}，用户ID: ${memoryData.userId}`);
    log(`记忆内容: ${memoryData.content.substring(0, 100)}...`);
    
    const vectorData = await generateEmbedding(memoryData.content);
    
    // 3. 保存向量嵌入
    await saveMemoryEmbedding(memoryId, vectorData);
    
    // 4. 清除用户的聚类缓存
    await clearClusterCache(memoryData.userId);
    
    log(`记忆 ${memoryId} 处理完成`, 'success');
    return true;
  } catch (error) {
    log(`处理记忆 ${memoryId} 失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    log('开始处理黄金价格记忆向量嵌入修复...');
    
    // 处理特定的黄金价格记忆
    const memoryIds = [
      '20230516123456',  // 示例记忆ID，在实际运行时替换为真实的ID
    ];

    let successCount = 0;
    for (const memoryId of memoryIds) {
      const success = await processMemory(memoryId);
      if (success) successCount++;
    }

    log(`处理完成，成功: ${successCount}/${memoryIds.length}`, 'success');
  } catch (error) {
    log(`脚本执行失败: ${error.message}`, 'error');
  } finally {
    pool.end();
    log('已关闭数据库连接');
  }
}

main();
