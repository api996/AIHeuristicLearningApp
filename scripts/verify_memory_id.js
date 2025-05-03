// 验证内存ID处理
// 测试各种ID格式的处理和查询

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// 配置NeonDB以使用WebSocket
neonConfig.webSocketConstructor = ws;

// 创建数据库连接
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// 创建测试记忆 (使用自定义ID)
async function createTestMemories() {
  console.log('创建测试记忆...');
  
  // 生成时间戳ID
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  
  const timestampId = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${randomSuffix}`;
  const legacyNumericId = "123456"; // 使用纯数字的ID（但是字符串类型）
  
  try {
    // 使用时间戳ID创建记忆
    await db.execute(sql`
      INSERT INTO memories (id, user_id, content, type, summary)
      VALUES (${timestampId}, 6, '这是时间戳ID格式的测试记忆', 'test', '时间戳ID测试');
    `);
    console.log(`创建时间戳ID记忆成功，ID: ${timestampId}`);
    
    // 使用数字字符串ID创建记忆
    await db.execute(sql`
      INSERT INTO memories (id, user_id, content, type, summary)
      VALUES (${legacyNumericId}, 6, '这是数字字符串ID格式的测试记忆', 'test', '数字字符串ID测试');
    `);
    console.log(`创建数字字符串ID记忆成功，ID: ${legacyNumericId}`);
    
    // 为每种类型记忆创建关键词和向量
    await createKeywordsAndEmbeddings(timestampId);
    await createKeywordsAndEmbeddings(legacyNumericId);
    
    return { timestampId, legacyNumericId };
  } catch (error) {
    console.error('创建测试记忆失败:', error);
    throw error;
  }
}

// 为记忆创建关键词和向量嵌入
async function createKeywordsAndEmbeddings(memoryId) {
  try {
    // 创建关键词
    await db.execute(sql`
      INSERT INTO memory_keywords (memory_id, keyword)
      VALUES (${memoryId}, 'ID测试'), (${memoryId}, '验证');
    `);
    console.log(`为记忆 ${memoryId} 创建关键词成功`);
    
    // 创建向量嵌入
    const mockVector = JSON.stringify(Array.from({length: 10}, () => Math.random() * 2 - 1));
    await db.execute(sql`
      INSERT INTO memory_embeddings (memory_id, vector_data)
      VALUES (${memoryId}, ${mockVector}::json);
    `);
    console.log(`为记忆 ${memoryId} 创建向量嵌入成功`);
  } catch (error) {
    console.error(`为记忆 ${memoryId} 创建关键词和向量失败:`, error);
    throw error;
  }
}

// 测试记忆查询 - 使用不同格式的ID
async function testMemoryQueries(ids) {
  console.log('\n测试记忆查询...');
  
  // 获取指定ID的记忆
  for (const [key, id] of Object.entries(ids)) {
    try {
      // 使用id参数化查询
      const result = await db.execute(sql`
        SELECT id, user_id, content, summary
        FROM memories
        WHERE id = ${id};
      `);
      
      if (result.length > 0) {
        console.log(`✅ 成功查询到${key}记忆:`, result[0].id);
        
        // 测试关键词查询
        const keywords = await db.execute(sql`
          SELECT keyword FROM memory_keywords
          WHERE memory_id = ${id};
        `);
        console.log(`  关键词 (${keywords.length}):`, keywords.map(k => k.keyword).join(', '));
        
        // 测试向量嵌入查询
        const embedding = await db.execute(sql`
          SELECT id FROM memory_embeddings
          WHERE memory_id = ${id};
        `);
        console.log(`  向量嵌入:`, embedding.length > 0 ? '存在' : '不存在');
      } else {
        console.log(`❌ 未查询到${key}记忆: ${id}`);
      }
    } catch (error) {
      console.error(`查询${key}记忆时出错:`, error);
    }
  }
  
  // 用数字类型的ID参数直接查询（模拟可能的类型不匹配）
  try {
    const numericId = 123456; // 注意这里是数字类型，而不是字符串
    const result = await db.execute(sql`
      SELECT id, user_id, content, summary
      FROM memories
      WHERE id = ${numericId};
    `);
    
    console.log(`\n使用数字类型ID (${numericId}) 查询结果:`, result.length > 0 ? '找到' : '未找到');
  } catch (error) {
    console.error('使用数字类型ID查询时出错:', error);
  }
}

// 主函数
async function main() {
  try {
    // 创建测试记忆
    const ids = await createTestMemories();
    
    // 测试记忆查询
    await testMemoryQueries(ids);
    
    console.log('\n验证完成');
  } catch (error) {
    console.error('验证过程出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行主函数
main();