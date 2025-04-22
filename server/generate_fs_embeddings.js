/**
 * 为文件系统中的记忆生成向量嵌入
 * 扫描memory_space目录，将文件系统中的记忆导入到数据库并生成向量嵌入
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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

// 保存的记忆数量统计
let importedCount = 0;
let existingCount = 0;
let errorCount = 0;
let embeddingFromFileCount = 0;
let embeddingGeneratedCount = 0;
let processedMemories = 0;

/**
 * 简单的向量嵌入生成器
 */
class SimpleEmbeddingGenerator {
  async init() {
    console.log("SimpleEmbeddingGenerator已初始化");
    return true;
  }
  
  async generateEmbedding(text) {
    // 生成一个固定大小的随机向量，实际应用中应使用proper ML模型
    console.log("生成随机向量嵌入（仅用于演示）");
    const embedding = Array(768).fill(0).map(() => Math.random() * 2 - 1);
    return embedding;
  }
}

// 实例化嵌入生成器
const genAiService = new SimpleEmbeddingGenerator();

/**
 * 检查记忆是否已存在于数据库中
 */
async function isMemoryInDatabase(memoryId) {
  try {
    const query = `
      SELECT id FROM memories 
      WHERE id = $1
    `;
    const result = await pool.query(query, [memoryId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error(`查询记忆 ${memoryId} 时出错: ${error}`);
    return false;
  }
}

/**
 * 检查记忆是否已有向量嵌入
 */
async function hasVectorEmbedding(memoryId) {
  try {
    const query = `
      SELECT id FROM memory_embeddings 
      WHERE memory_id = $1
    `;
    const result = await pool.query(query, [memoryId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error(`查询记忆向量 ${memoryId} 时出错: ${error}`);
    return false;
  }
}

/**
 * 将记忆导入到数据库
 */
async function importMemoryToDatabase(memory, fileName, userId) {
  try {
    // 从文件名中提取ID
    const id = fileName.replace('.json', '');
    
    const {
      content,
      timestamp,
      type = 'summary',
      keywords = [],
      summary = ''
    } = memory;
    
    // 用户ID是参数传入的
    const user_id = userId;
    
    // 检查记忆是否已存在
    if (await isMemoryInDatabase(id)) {
      console.log(`记忆 ${id} 已存在于数据库中`);
      existingCount++;
      return true;
    }
    
    // 格式化时间戳
    const created_at = timestamp ? new Date(timestamp) : new Date();
    
    // 导入记忆到数据库，使用正确的列名
    const query = `
      INSERT INTO memories (
        id, user_id, content, created_at, type, summary, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    
    const result = await pool.query(query, [
      id,
      user_id,
      content,
      created_at,
      type,
      summary,
      created_at // timestamp和created_at相同
    ]);
    
    if (result.rows.length > 0) {
      console.log(`记忆 ${id} 成功导入数据库`);
      importedCount++;
      return true;
    } else {
      console.log(`记忆 ${id} 导入失败或已存在`);
      existingCount++;
      return false;
    }
  } catch (error) {
    console.error(`导入记忆 ${memory.id} 时出错: ${error}`);
    errorCount++;
    return false;
  }
}

/**
 * 生成并保存向量嵌入
 */
async function generateAndSaveEmbedding(memoryId, content, existingEmbedding = null) {
  // 检查记忆是否已有向量嵌入
  if (await hasVectorEmbedding(memoryId)) {
    console.log(`记忆 ${memoryId} 已有向量嵌入`);
    return true;
  }
  
  try {
    let embedding = null;
    
    // 如果提供了现有嵌入，优先使用它
    if (existingEmbedding && Array.isArray(existingEmbedding) && existingEmbedding.length > 0) {
      console.log(`使用记忆文件中现有的向量嵌入 (维度=${existingEmbedding.length})`);
      embedding = existingEmbedding;
      embeddingFromFileCount++;
    } else {
      // 没有现有嵌入，生成新的
      // 清理文本，移除多余空白
      const cleanedText = content
        .replace(/\s+/g, ' ')
        .trim();

      // 截断文本，如果过长
      const truncatedText = cleanedText.length > 8000 
        ? cleanedText.substring(0, 8000)
        : cleanedText;
      
      // 生成向量嵌入
      await genAiService.init();
      embedding = await genAiService.generateEmbedding(truncatedText);
      embeddingGeneratedCount++;
    }
    
    if (!embedding) {
      console.log(`为记忆 ${memoryId} 生成或获取向量嵌入失败`);
      return false;
    }
    
    // 保存向量嵌入
    const query = `
      INSERT INTO memory_embeddings (memory_id, vector_data)
      VALUES ($1, $2)
      ON CONFLICT (memory_id) DO NOTHING
    `;
    
    await pool.query(query, [memoryId, JSON.stringify(embedding)]);
    console.log(`成功为记忆 ${memoryId} 保存向量嵌入`);
    return true;
  } catch (error) {
    console.error(`为记忆 ${memoryId} 生成向量嵌入时出错: ${error}`);
    return false;
  }
}

/**
 * 处理单个记忆文件
 */
async function processMemoryFile(filePath, userId) {
  try {
    // 读取记忆文件
    const data = fs.readFileSync(filePath, 'utf8');
    const memory = JSON.parse(data);
    
    // 从文件路径中提取文件名
    const fileName = path.basename(filePath);
    const memoryId = fileName.replace('.json', '');
    
    // 尝试导入记忆到数据库
    const imported = await importMemoryToDatabase(memory, fileName, userId);
    
    if (imported && memory.content) {
      // 使用文件中的向量嵌入（如果有）
      await generateAndSaveEmbedding(memoryId, memory.content, memory.embedding);
    }
    
    processedMemories++;
    
    // 显示进度
    if (processedMemories % 5 === 0) {
      console.log(`已处理 ${processedMemories} 个记忆文件...`);
    }
    
    return true;
  } catch (error) {
    console.error(`处理记忆文件 ${filePath} 时出错: ${error}`);
    errorCount++;
    return false;
  }
}

/**
 * 处理特定用户的所有记忆文件
 */
async function processUserMemories(userId) {
  const userDir = path.join('memory_space', userId.toString());
  
  if (!fs.existsSync(userDir)) {
    console.log(`用户 ${userId} 的记忆目录不存在`);
    return false;
  }
  
  console.log(`处理用户 ${userId} 的记忆文件...`);
  const files = fs.readdirSync(userDir);
  
  // 计算总文件数
  const totalFiles = files.filter(file => file.endsWith('.json')).length;
  console.log(`找到 ${totalFiles} 个记忆文件`);
  
  // 重置计数器
  processedMemories = 0;
  
  // 批量处理文件
  const batchSize = 10;
  let currentBatch = [];
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(userDir, file);
      currentBatch.push(filePath);
      
      if (currentBatch.length >= batchSize) {
        await Promise.all(currentBatch.map(fp => processMemoryFile(fp, userId)));
        currentBatch = [];
        // 添加小延迟，避免数据库连接问题
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // 处理最后一批
  if (currentBatch.length > 0) {
    await Promise.all(currentBatch.map(fp => processMemoryFile(fp, userId)));
  }
  
  console.log(`用户 ${userId} 的记忆文件处理完成`);
  return true;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log("=== 开始处理文件系统记忆并生成向量嵌入 ===");
    
    // 指定要处理的用户ID
    const targetUserId = 6;
    
    // 处理指定用户的记忆
    await processUserMemories(targetUserId);
    
    console.log(`
=== 处理完成 ===
导入记忆: ${importedCount}
已存在记忆: ${existingCount}
出错记忆: ${errorCount}
使用文件嵌入: ${embeddingFromFileCount}
生成新嵌入: ${embeddingGeneratedCount}
总处理: ${processedMemories}
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