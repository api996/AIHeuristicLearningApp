/**
 * 黄金价格记忆向量嵌入修复脚本
 * 为特定的黄金价格记忆生成向量嵌入并触发聚类重新计算
 */
import pkg from 'pg';
const { Pool } = pkg;

// 连接数据库
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 打印彩色日志
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
  };
  const color = colors[type] || colors.info;
  console.log(`${color}[${type.toUpperCase()}]\x1b[0m ${message}`);
}

/**
 * 使用Gemini API生成向量嵌入（确保与系统中其他嵌入一致性）
 */
async function generateEmbedding(text) {
  log(`为文本生成向量嵌入: "${text.substring(0, 50)}..."`);
  
  try {
    import { GoogleGenerativeAI } from '@google/generative-ai';
    
    // 确保GEMINI_API_KEY存在
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('缺少GEMINI_API_KEY环境变量');
    }
    
    // 初始化GoogleAI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 调用embedContent API，与服务端Python代码使用相同的模型
    log('使用Gemini API (models/gemini-embedding-exp-03-07) 生成嵌入向量...');
    const result = await genAI.embedContent({
      model: 'models/gemini-embedding-exp-03-07',
      content: text,
      taskType: 'retrieval_document'
    });
    
    if (result && result.embedding) {
      log(`成功生成 ${result.embedding.length} 维向量嵌入`, 'success');
      return result.embedding;
    } else {
      throw new Error('API响应格式不符合预期');
    }
  } catch (error) {
    log(`生成向量嵌入失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 保存记忆的向量嵌入到数据库
 */
async function saveMemoryEmbedding(memoryId, vectorData) {
  try {
    // 检查是否已存在
    const checkResult = await pool.query(
      'SELECT id FROM memory_embeddings WHERE memory_id = $1',
      [memoryId]
    );
    
    if (checkResult.rows.length > 0) {
      log(`记忆ID ${memoryId} 已存在向量嵌入，将进行更新`, 'warn');
      
      // 更新现有的向量嵌入
      await pool.query(
        'UPDATE memory_embeddings SET vector_data = $1, updated_at = NOW() WHERE memory_id = $2',
        [vectorData, memoryId]
      );
      
      log(`记忆ID ${memoryId} 的向量嵌入已更新`, 'success');
    } else {
      // 插入新的向量嵌入
      await pool.query(
        'INSERT INTO memory_embeddings (memory_id, vector_data, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
        [memoryId, vectorData]
      );
      
      log(`记忆ID ${memoryId} 的向量嵌入已保存`, 'success');
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
    await pool.query(
      'DELETE FROM cluster_result_cache WHERE user_id = $1',
      [userId]
    );
    log(`用户ID ${userId} 的聚类缓存已清除`, 'success');
    return true;
  } catch (error) {
    log(`清除聚类缓存失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 处理特定记忆ID
 */
async function processMemory(memoryId) {
  try {
    // 获取记忆内容
    const memoryResult = await pool.query(
      'SELECT content, user_id FROM memories WHERE id = $1',
      [memoryId]
    );
    
    if (memoryResult.rows.length === 0) {
      log(`找不到记忆ID ${memoryId}`, 'error');
      return false;
    }
    
    const { content, user_id } = memoryResult.rows[0];
    log(`找到记忆: "${content}"`);
    
    // 生成向量嵌入
    const vectorData = await generateEmbedding(content);
    
    // 保存向量嵌入
    await saveMemoryEmbedding(memoryId, vectorData);
    
    // 清除用户的聚类缓存
    await clearClusterCache(user_id);
    
    log(`记忆ID ${memoryId} 处理完成`, 'success');
    return true;
  } catch (error) {
    log(`处理记忆ID ${memoryId} 失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const memoryId = '20250503093933042955'; // 黄金价格记忆的ID
    
    log(`开始处理记忆ID ${memoryId}`);
    await processMemory(memoryId);
    
    log('处理完成', 'success');
  } catch (error) {
    log(`出错: ${error.message}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 运行主函数
main();
