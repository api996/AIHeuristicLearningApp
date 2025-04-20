// 修复内存ID引用关系
// 此脚本创建新的memories表并迁移现有数据

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// 配置NeonDB以使用WebSocket
neonConfig.webSocketConstructor = ws;

// 创建数据库连接
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// 创建测试记忆 (用于验证新格式)
async function createTestMemory() {
  console.log('创建测试记忆...');
  
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
      VALUES (${memoryId}, 6, '这是测试记忆，用于验证ID格式和关联查询', 'test', '测试记忆');
    `);
    
    // 创建关键词
    await db.execute(sql`
      INSERT INTO memory_keywords (memory_id, keyword)
      VALUES (${memoryId}, '测试'), (${memoryId}, 'ID格式'), (${memoryId}, '验证');
    `);
    
    // 创建向量嵌入
    const mockVector = JSON.stringify(Array.from({length: 768}, () => Math.random() * 2 - 1));
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

// 验证记忆引用关系
async function validateMemoryReferences(testMemoryId) {
  console.log('验证记忆引用关系...');
  
  try {
    // 检查测试记忆是否存在
    const memory = await db.execute(sql`
      SELECT id, user_id, content, summary FROM memories 
      WHERE id = ${testMemoryId};
    `);
    
    if (memory.length > 0) {
      console.log('找到测试记忆:', memory[0].id);
      
      // 检查关键词是否存在
      const keywords = await db.execute(sql`
        SELECT keyword FROM memory_keywords 
        WHERE memory_id = ${testMemoryId};
      `);
      
      console.log(`找到 ${keywords.length} 个关键词:`, keywords.map(k => k.keyword).join(', '));
      
      // 检查向量嵌入是否存在
      const embedding = await db.execute(sql`
        SELECT id FROM memory_embeddings 
        WHERE memory_id = ${testMemoryId};
      `);
      
      console.log(`找到 ${embedding.length} 个向量嵌入`);
      
      return true;
    } else {
      console.error('未找到测试记忆:', testMemoryId);
      return false;
    }
  } catch (error) {
    console.error('验证记忆引用关系时出错:', error);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    // 创建测试记忆
    const testMemoryId = await createTestMemory();
    
    // 验证记忆引用关系
    const isValid = await validateMemoryReferences(testMemoryId);
    
    if (isValid) {
      console.log('记忆引用关系正常');
    } else {
      console.error('记忆引用关系异常');
    }
    
    console.log('脚本执行完成');
  } catch (error) {
    console.error('执行脚本时出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行主函数
main();