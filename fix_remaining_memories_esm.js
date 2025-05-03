/**
 * 修复剩余记忆向量嵌入脚本 (ESM版本)
 * 手动处理特定的记忆ID，为其生成向量嵌入并使用与EmbeddingService相同的Gemini API
 */
import fs from 'fs';
import pkg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const { Pool } = pkg;

// 连接数据库
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 待处理的记忆ID列表
const memoryIds = [
  // 添加需要处理的记忆ID
  '20250415151642368999',
  '20250416123245788201',
  '20250417145502122422',
  '20250415151642368999',
];

// 彩色日志输出函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
  };
  
  const color = colors[type] || colors.info;
  const reset = '\x1b[0m';
  console.log(`${color}[${type.toUpperCase()}]${reset} ${message}`);
}

/**
 * 使用Gemini API生成向量嵌入（确保与系统中其他嵌入一致性）
 */
async function generateEmbedding(text) {
  log(`正在为文本生成嵌入: "${text.substring(0, 50)}"`, 'info');
  
  // 如果文本为空或者仅包含空白字符，生成一个默认的替代文本
  if (!text || text.trim() === '' || text === '1') {
    text = "这是一个占位符内容，用于测试向量嵌入生成功能。";
    log(`使用默认替代文本: "${text}"`, 'warning');
  }
  
  try {
    // 确保GEMINI_API_KEY存在
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('缺少GEMINI_API_KEY环境变量');
    }
    
    // 初始化GoogleAI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 最新的@google/generative-ai包使用不同的API
    log('使用Gemini API (models/embedding-001) 生成嵌入向量...');
    
    // 获取嵌入模型
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    
    // 生成嵌入
    const result = await embeddingModel.embedContent(text);
    const embedding = result.embedding.values;
    
    if (embedding && embedding.length > 0) {
      log(`成功生成 ${embedding.length} 维向量嵌入`, 'success');
      return embedding;
    } else {
      throw new Error('API响应格式不符合预期');
    }
  } catch (error) {
    log(`生成向量嵌入失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 将向量嵌入保存到数据库
 */
async function saveMemoryEmbedding(memoryId, vectorData) {
  try {
    // 将JavaScript数组转换为JSON字符串，用于PostgreSQL的jsonb类型
    const vectorJson = JSON.stringify(vectorData);
    log(`向量维度: ${vectorData.length}, 已转换为JSON`);
    
    // 检查向量是否已存在
    const checkQuery = 'SELECT id FROM memory_embeddings WHERE memory_id = $1';
    const checkResult = await pool.query(checkQuery, [memoryId]);
    
    if (checkResult.rows.length > 0) {
      // 更新现有向量
      log(`更新现有向量嵌入: ${memoryId}`, 'info');
      const updateQuery = 'UPDATE memory_embeddings SET vector_data = $1::jsonb WHERE memory_id = $2';
      await pool.query(updateQuery, [vectorJson, memoryId]);
    } else {
      // 插入新向量
      log(`插入新向量嵌入: ${memoryId}`, 'info');
      const insertQuery = 'INSERT INTO memory_embeddings (memory_id, vector_data) VALUES ($1, $2::jsonb)';
      await pool.query(insertQuery, [memoryId, vectorJson]);
    }
    
    log(`已保存向量嵌入: ${memoryId}`, 'success');
    return true;
  } catch (error) {
    log(`保存向量嵌入失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 清除用户的聚类缓存
 */
async function clearClusterCache(userId) {
  try {
    const query = 'DELETE FROM cluster_result_cache WHERE user_id = $1';
    await pool.query(query, [userId]);
    log(`已清除用户的聚类缓存: ${userId}`, 'success');
    return true;
  } catch (error) {
    log(`清除聚类缓存失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 处理单个记忆ID
 */
async function processMemory(memoryId) {
  try {
    // 获取记忆内容
    const query = 'SELECT content, user_id FROM memories WHERE id = $1';
    const result = await pool.query(query, [memoryId]);
    
    if (result.rows.length === 0) {
      log(`找不到记忆: ${memoryId}`, 'error');
      return false;
    }
    
    const { content, user_id } = result.rows[0];
    log(`找到记忆: ${memoryId}, 用户ID: ${user_id}`, 'info');
    
    // 生成向量嵌入
    const vectorData = await generateEmbedding(content);
    
    // 保存向量嵌入
    await saveMemoryEmbedding(memoryId, vectorData);
    
    // 清除用户的聚类缓存
    await clearClusterCache(user_id);
    
    log(`处理完成: ${memoryId}`, 'success');
    return true;
  } catch (error) {
    log(`处理记忆失败: ${memoryId}, 错误: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  log(`开始处理 ${memoryIds.length} 个记忆ID`, 'info');
  
  let successCount = 0;
  let failCount = 0;
  
  // 处理每个记忆ID
  for (const memoryId of memoryIds) {
    log(`正在处理记忆ID: ${memoryId}`, 'info');
    
    const success = await processMemory(memoryId);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // 添加延迟，避免API限制
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  log(`处理完成: 成功 ${successCount} 个, 失败 ${failCount} 个`, 'info');
}

// 执行主函数
main().then(() => {
  log('脚本执行完成', 'success');
  pool.end();
}).catch(error => {
  log(`脚本执行失败: ${error.message}`, 'error');
  pool.end();
});
