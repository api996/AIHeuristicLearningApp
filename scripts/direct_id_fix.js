// 直接修复知识图谱查询问题
// 检查并添加时间戳格式ID到memory_embeddings和memory_keywords表

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// 配置NeonDB以使用WebSocket
neonConfig.webSocketConstructor = ws;

// 创建数据库连接
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// 检查并添加时间戳ID到memory_keywords表
async function updateMemoryKeywords() {
  console.log('正在修复memory_keywords表中的memory_id引用...');
  
  try {
    // 查找需要更新的关键词记录数量
    const keywordsCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM memory_keywords
      WHERE memory_id ~ '^[0-9]+$'; -- 使用正则表达式匹配纯数字ID
    `);
    console.log(`需要更新的memory_keywords记录数: ${keywordsCount[0]?.count || 0}`);
    
    // 如果没有需要更新的记录，则跳过
    if (!keywordsCount[0]?.count || keywordsCount[0].count === '0') {
      console.log('没有需要更新的memory_keywords记录');
      return;
    }
    
    // 创建新的关键词临时表
    await db.execute(sql`
      ALTER TABLE memory_keywords RENAME TO memory_keywords_old;
      
      CREATE TABLE memory_keywords (
        id SERIAL PRIMARY KEY,
        memory_id TEXT NOT NULL,
        keyword TEXT NOT NULL
      );
      
      -- 复制数据，保持非数字ID不变，将数字ID转换为固定格式的字符串
      INSERT INTO memory_keywords (id, memory_id, keyword)
      SELECT id, 
             CASE WHEN memory_id ~ '^[0-9]+$' THEN 
               'legacy_' || memory_id 
             ELSE 
               memory_id 
             END,
             keyword
      FROM memory_keywords_old;
      
      -- 创建索引
      CREATE INDEX memory_keywords_memory_id_idx ON memory_keywords(memory_id);
      
      -- 删除旧表
      DROP TABLE memory_keywords_old;
    `);
    
    console.log('memory_keywords表修复完成');
  } catch (error) {
    console.error('修复memory_keywords表时出错:', error);
    throw error;
  }
}

// 检查并添加时间戳ID到memory_embeddings表
async function updateMemoryEmbeddings() {
  console.log('正在修复memory_embeddings表中的memory_id引用...');
  
  try {
    // 查找需要更新的嵌入向量记录数量
    const embeddingsCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM memory_embeddings
      WHERE memory_id ~ '^[0-9]+$'; -- 使用正则表达式匹配纯数字ID
    `);
    console.log(`需要更新的memory_embeddings记录数: ${embeddingsCount[0]?.count || 0}`);
    
    // 如果没有需要更新的记录，则跳过
    if (!embeddingsCount[0]?.count || embeddingsCount[0].count === '0') {
      console.log('没有需要更新的memory_embeddings记录');
      return;
    }
    
    // 创建新的嵌入向量临时表
    await db.execute(sql`
      ALTER TABLE memory_embeddings RENAME TO memory_embeddings_old;
      
      CREATE TABLE memory_embeddings (
        id SERIAL PRIMARY KEY,
        memory_id TEXT NOT NULL,
        vector_data JSON NOT NULL
      );
      
      -- 复制数据，保持非数字ID不变，将数字ID转换为固定格式的字符串
      INSERT INTO memory_embeddings (id, memory_id, vector_data)
      SELECT id, 
             CASE WHEN memory_id ~ '^[0-9]+$' THEN 
               'legacy_' || memory_id 
             ELSE 
               memory_id 
             END,
             vector_data
      FROM memory_embeddings_old;
      
      -- 创建索引
      CREATE INDEX memory_embeddings_memory_id_idx ON memory_embeddings(memory_id);
      
      -- 删除旧表
      DROP TABLE memory_embeddings_old;
    `);
    
    console.log('memory_embeddings表修复完成');
  } catch (error) {
    console.error('修复memory_embeddings表时出错:', error);
    throw error;
  }
}

// 更新memories表ID格式
async function updateMemoriesIdFormat() {
  console.log('正在修复memories表中的ID格式...');
  
  try {
    // 查找需要更新的记忆记录数量
    const memoriesCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM memories
      WHERE id ~ '^[0-9]+$'; -- 使用正则表达式匹配纯数字ID
    `);
    console.log(`需要更新的memories记录数: ${memoriesCount[0]?.count || 0}`);
    
    // 如果没有需要更新的记录，则跳过
    if (!memoriesCount[0]?.count || memoriesCount[0].count === '0') {
      console.log('没有需要更新的memories记录');
      return;
    }
    
    // 创建新的记忆临时表
    await db.execute(sql`
      ALTER TABLE memories RENAME TO memories_old;
      
      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'chat',
        timestamp TIMESTAMP DEFAULT NOW(),
        summary TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      -- 复制数据，保持非数字ID不变，将数字ID转换为固定格式的字符串
      INSERT INTO memories (id, user_id, content, type, timestamp, summary, created_at)
      SELECT 
        CASE WHEN id ~ '^[0-9]+$' THEN 
          'legacy_' || id 
        ELSE 
          id 
        END,
        user_id, content, type, timestamp, summary, created_at
      FROM memories_old;
      
      -- 创建索引
      CREATE INDEX memories_user_id_idx ON memories(user_id);
      
      -- 删除旧表
      DROP TABLE memories_old;
    `);
    
    console.log('memories表修复完成');
  } catch (error) {
    console.error('修复memories表时出错:', error);
    throw error;
  }
}

// 验证修复结果
async function validateFix() {
  console.log('验证修复结果...');
  
  try {
    // 检查记录数量
    const memoriesCount = await db.execute(sql`SELECT COUNT(*) as count FROM memories;`);
    const keywordsCount = await db.execute(sql`SELECT COUNT(*) as count FROM memory_keywords;`);
    const embeddingsCount = await db.execute(sql`SELECT COUNT(*) as count FROM memory_embeddings;`);
    
    console.log(`memories表记录数: ${memoriesCount[0]?.count || 0}`);
    console.log(`memory_keywords表记录数: ${keywordsCount[0]?.count || 0}`);
    console.log(`memory_embeddings表记录数: ${embeddingsCount[0]?.count || 0}`);
    
    // 抽查数据格式
    const legacyMemorySample = await db.execute(sql`
      SELECT id FROM memories 
      WHERE id LIKE 'legacy_%' 
      LIMIT 3;
    `);
    console.log('旧格式ID样本:', legacyMemorySample.map(m => m.id).join(', '));
    
    const timestampMemorySample = await db.execute(sql`
      SELECT id FROM memories 
      WHERE id NOT LIKE 'legacy_%' 
      LIMIT 3;
    `);
    console.log('时间戳格式ID样本:', timestampMemorySample.map(m => m.id).join(', '));
    
    // 测试嵌入表关联查询
    const randomMemoryId = await db.execute(sql`
      SELECT id FROM memories 
      ORDER BY RANDOM() 
      LIMIT 1;
    `);
    
    if (randomMemoryId.length > 0) {
      const testId = randomMemoryId[0].id;
      console.log(`测试ID关联查询: ${testId}`);
      
      const memoryEmb = await db.execute(sql`
        SELECT id FROM memory_embeddings 
        WHERE memory_id = ${testId}
        LIMIT 1;
      `);
      
      console.log(`关联的嵌入记录: ${memoryEmb.length > 0 ? '找到' : '未找到'}`);
    }
    
    console.log('验证完成');
  } catch (error) {
    console.error('验证过程出错:', error);
    throw error;
  }
}

// 创建测试记忆
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
      VALUES (${memoryId}, 6, '这是修复后创建的测试记忆，用于验证ID格式和关联查询', 'test', '测试记忆-修复后');
    `);
    
    // 创建关键词
    await db.execute(sql`
      INSERT INTO memory_keywords (memory_id, keyword)
      VALUES (${memoryId}, '测试'), (${memoryId}, 'ID格式修复'), (${memoryId}, '验证');
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

// 主函数
async function main() {
  try {
    // 执行修复
    await updateMemoryKeywords();
    await updateMemoryEmbeddings();
    await updateMemoriesIdFormat();
    
    // 验证修复结果
    await validateFix();
    
    // 创建测试记忆
    await createTestMemory();
    
    console.log('修复完成');
  } catch (error) {
    console.error('修复过程出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行主函数
main();