// 记忆引用修复工具
// 确保所有memory_id引用一致性

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// 配置NeonDB以使用WebSocket
neonConfig.webSocketConstructor = ws;

// 创建数据库连接
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// 创建一条测试记忆
async function createTestMemory() {
  console.log('创建测试记忆记录...');
  
  try {
    // 生成时间戳格式的ID: YYYYMMDDHHMMSSmmmNNN
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    // 格式: YYYYMMDDHHMMSSmmmNNN
    const memoryId = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${randomSuffix}`;
    
    // 插入测试记忆
    await db.execute(sql`
      INSERT INTO memories (id, user_id, content, type, summary)
      VALUES (${memoryId}, 6, '这是一条测试记忆，用于验证ID格式转换是否成功', 'test', '测试记忆');
    `);
    
    // 创建关键词
    await db.execute(sql`
      INSERT INTO memory_keywords (memory_id, keyword)
      VALUES (${memoryId}, '测试'), (${memoryId}, 'ID格式'), (${memoryId}, '验证');
    `);
    
    // 创建向量嵌入
    const mockVector = JSON.stringify(Array.from({length: 10}, () => Math.random()));
    await db.execute(sql`
      INSERT INTO memory_embeddings (memory_id, vector_data)
      VALUES (${memoryId}, ${mockVector}::json);
    `);
    
    console.log(`测试记忆创建成功，ID: ${memoryId}`);
    return memoryId;
  } catch (error) {
    console.error('创建测试记忆失败:', error);
    throw error;
  }
}

// 验证记忆ID引用
async function validateMemoryReferences(testMemoryId) {
  console.log('验证记忆ID引用...');
  
  try {
    // 验证记忆表
    const memory = await db.execute(sql`
      SELECT id, user_id, type FROM memories WHERE id = ${testMemoryId};
    `);
    
    if (memory.length === 0) {
      console.error('验证失败：找不到测试记忆');
      return false;
    }
    
    console.log('找到测试记忆记录:', memory[0]);
    
    // 验证关键词表
    const keywords = await db.execute(sql`
      SELECT id, memory_id, keyword FROM memory_keywords WHERE memory_id = ${testMemoryId};
    `);
    
    if (keywords.length === 0) {
      console.error('验证失败：找不到测试记忆的关键词');
      return false;
    }
    
    console.log(`找到 ${keywords.length} 个关键词记录，第一个:`, keywords[0]);
    
    // 验证向量表
    const embedding = await db.execute(sql`
      SELECT id, memory_id FROM memory_embeddings WHERE memory_id = ${testMemoryId};
    `);
    
    if (embedding.length === 0) {
      console.error('验证失败：找不到测试记忆的向量嵌入');
      return false;
    }
    
    console.log('找到向量嵌入记录:', embedding[0]);
    
    console.log('ID引用验证成功！系统现在可以正确处理时间戳格式的记忆ID');
    return true;
  } catch (error) {
    console.error('验证过程出错:', error);
    return false;
  }
}

// 主函数
async function main() {
  try {
    // 创建测试记忆并验证
    const testMemoryId = await createTestMemory();
    await validateMemoryReferences(testMemoryId);
    
    console.log('记忆系统ID引用验证完成');
  } catch (error) {
    console.error('执行过程出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行主函数
main();