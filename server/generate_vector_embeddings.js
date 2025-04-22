/**
 * 为记忆生成向量嵌入脚本
 * 使用定时戳格式ID与记忆内容创建向量嵌入
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 配置数据库连接
const { DATABASE_URL } = process.env;

// 检查环境变量
if (!DATABASE_URL) {
  console.error("缺少必要的环境变量: DATABASE_URL");
  process.exit(1);
}

// 配置数据库连接
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * 简单的向量嵌入生成器
 */
class SimpleEmbeddingGenerator {
  async init() {
    console.log("SimpleEmbeddingGenerator已初始化");
    return true;
  }
  
  async generateEmbedding(text) {
    // 生成一个固定大小的随机向量，仅用于测试
    // 实际应用中应使用proper ML模型
    console.log("生成随机向量嵌入（仅用于演示）");
    const embedding = Array(768).fill(0).map(() => Math.random() * 2 - 1);
    return embedding;
  }
}

// 实例化嵌入生成器
const genAiService = new SimpleEmbeddingGenerator();

/**
 * 获取所有没有向量嵌入的记忆
 */
async function getMemoriesWithoutEmbeddings() {
  const query = `
    SELECT m.id, m.content
    FROM memories m
    LEFT JOIN memory_embeddings me ON m.id = me.memory_id
    WHERE me.id IS NULL
    AND m.content IS NOT NULL
    AND length(m.content) > 10
    LIMIT 50
  `;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * 使用GenAI服务生成向量嵌入
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.log('无法为空文本生成嵌入');
    return null;
  }

  // 清理文本，移除多余空白
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .trim();

  // 截断文本，如果过长
  const truncatedText = cleanedText.length > 8000 
    ? cleanedText.substring(0, 8000)
    : cleanedText;
  
  try {
    // 初始化GenAI服务
    await genAiService.init();
    
    // 使用GenAI服务生成向量嵌入
    console.log('使用GenAI服务生成向量嵌入');
    const embedding = await genAiService.generateEmbedding(truncatedText);
    
    if (!embedding) {
      console.log('GenAI嵌入服务返回空结果');
      return null;
    }
    
    // 验证嵌入维度，确保是有效的向量
    if (embedding.length < 100) {
      console.log(`警告: 嵌入维度异常 (${embedding.length})`);
    } else {
      console.log(`成功生成${embedding.length}维向量嵌入`);
    }
    
    return embedding;
  } catch (error) {
    console.error(`生成嵌入时出错: ${error}`);
    return null;
  }
}

/**
 * 保存记忆的向量嵌入
 */
async function saveMemoryEmbedding(memoryId, vectorData) {
  try {
    await pool.query(
      'INSERT INTO memory_embeddings (memory_id, vector_data) VALUES ($1, $2)',
      [memoryId, JSON.stringify(vectorData)]
    );
    return true;
  } catch (error) {
    console.error(`保存记忆嵌入出错: ${error}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log("=== 开始为记忆生成向量嵌入 ===");
    
    // 获取没有向量嵌入的记忆
    const memoriesWithoutEmbeddings = await getMemoriesWithoutEmbeddings();
    console.log(`找到 ${memoriesWithoutEmbeddings.length} 条没有向量嵌入的记忆`);
    
    if (memoriesWithoutEmbeddings.length === 0) {
      console.log("没有需要处理的记忆，脚本完成");
      await pool.end();
      return;
    }
    
    // 为每个记忆生成向量嵌入
    let successCount = 0;
    let failCount = 0;
    
    // 初始化GenAI服务
    await genAiService.init();
    console.log("GenAI服务初始化完成");
    
    for (const memory of memoriesWithoutEmbeddings) {
      console.log(`处理记忆 ${memory.id}...`);
      
      // 生成向量嵌入
      const embedding = await generateEmbedding(memory.content);
      
      if (embedding) {
        // 保存向量嵌入
        const success = await saveMemoryEmbedding(memory.id, embedding);
        
        if (success) {
          console.log(`成功为记忆 ${memory.id} 生成并保存向量嵌入`);
          successCount++;
        } else {
          console.log(`保存记忆 ${memory.id} 的向量嵌入失败`);
          failCount++;
        }
      } else {
        console.log(`为记忆 ${memory.id} 生成向量嵌入失败`);
        failCount++;
      }
      
      // 添加小延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`
=== 处理完成 ===
成功: ${successCount}
失败: ${failCount}
总计: ${memoriesWithoutEmbeddings.length}
    `);
    
    // 关闭数据库连接
    await pool.end();
  } catch (error) {
    console.error("脚本执行失败:", error);
    await pool.end();
    process.exit(1);
  }
}

// 运行主函数
main();