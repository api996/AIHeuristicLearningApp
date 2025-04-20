// 记忆ID映射修复工具
// 确保memory_keywords和memory_embeddings表中的memory_id与memories表中的id匹配

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// 配置NeonDB以使用WebSocket
neonConfig.webSocketConstructor = ws;

// 创建数据库连接
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// 创建内存ID映射表（临时表）
async function createMappingTable() {
  console.log('创建内存ID映射表...');
  
  try {
    // 删除可能存在的旧映射表
    await db.execute(sql`DROP TABLE IF EXISTS memory_id_mapping`);
    
    // 创建新的映射表
    await db.execute(sql`
      CREATE TABLE memory_id_mapping (
        old_id TEXT NOT NULL,
        new_id TEXT NOT NULL UNIQUE,
        PRIMARY KEY (old_id)
      );
    `);
    
    console.log('映射表创建成功');
  } catch (error) {
    console.error('创建映射表失败:', error);
    throw error;
  }
}

// 向映射表中填充数据
async function populateMappingTable() {
  console.log('填充ID映射表...');
  
  try {
    // 从内存表中获取当前所有记录
    const memoriesResult = await db.execute(sql`SELECT id FROM memories;`);
    const memories = memoriesResult || [];
    console.log(`找到 ${memories.length} 条内存记录`);
    
    // 为每个ID创建映射（旧ID -> 新的时间戳格式ID）
    for (const memory of memories) {
      const oldId = memory.id;
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
      const newId = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${randomSuffix}`;
      
      // 把映射保存到映射表中
      await db.execute(sql`
        INSERT INTO memory_id_mapping (old_id, new_id)
        VALUES (${oldId}, ${newId});
      `);
    }
    
    console.log('ID映射表填充完成');
  } catch (error) {
    console.error('填充映射表失败:', error);
    throw error;
  }
}

// 更新memories表中的ID
async function updateMemoriesIds() {
  console.log('更新memories表ID...');
  
  try {
    // 创建临时表
    await db.execute(sql`
      CREATE TABLE memories_new (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'chat',
        timestamp TIMESTAMP DEFAULT NOW(),
        summary TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // 使用映射表复制数据到新表
    await db.execute(sql`
      INSERT INTO memories_new (id, user_id, content, type, timestamp, summary, created_at)
      SELECT m.new_id, mem.user_id, mem.content, mem.type, mem.timestamp, mem.summary, mem.created_at
      FROM memories mem
      JOIN memory_id_mapping m ON mem.id = m.old_id;
    `);
    
    // 交换表
    await db.execute(sql`DROP TABLE memories;`);
    await db.execute(sql`ALTER TABLE memories_new RENAME TO memories;`);
    
    console.log('memories表ID更新完成');
  } catch (error) {
    console.error('更新memories表ID失败:', error);
    throw error;
  }
}

// 更新memory_keywords表中的memory_id引用
async function updateKeywordsReferences() {
  console.log('更新memory_keywords表引用...');
  
  try {
    // 创建临时表
    await db.execute(sql`
      CREATE TABLE memory_keywords_new (
        id SERIAL PRIMARY KEY,
        memory_id TEXT NOT NULL,
        keyword TEXT NOT NULL
      );
    `);
    
    // 使用映射表复制数据到新表
    await db.execute(sql`
      INSERT INTO memory_keywords_new (id, memory_id, keyword)
      SELECT kw.id, m.new_id, kw.keyword
      FROM memory_keywords kw
      JOIN memory_id_mapping m ON kw.memory_id = m.old_id;
    `);
    
    // 交换表
    await db.execute(sql`DROP TABLE memory_keywords;`);
    await db.execute(sql`ALTER TABLE memory_keywords_new RENAME TO memory_keywords;`);
    
    console.log('memory_keywords表引用更新完成');
  } catch (error) {
    console.error('更新memory_keywords表引用失败:', error);
    throw error;
  }
}

// 更新memory_embeddings表中的memory_id引用
async function updateEmbeddingsReferences() {
  console.log('更新memory_embeddings表引用...');
  
  try {
    // 创建临时表
    await db.execute(sql`
      CREATE TABLE memory_embeddings_new (
        id SERIAL PRIMARY KEY,
        memory_id TEXT NOT NULL,
        vector_data JSON NOT NULL
      );
    `);
    
    // 使用映射表复制数据到新表
    await db.execute(sql`
      INSERT INTO memory_embeddings_new (id, memory_id, vector_data)
      SELECT emb.id, m.new_id, emb.vector_data
      FROM memory_embeddings emb
      JOIN memory_id_mapping m ON emb.memory_id = m.old_id;
    `);
    
    // 交换表
    await db.execute(sql`DROP TABLE memory_embeddings;`);
    await db.execute(sql`ALTER TABLE memory_embeddings_new RENAME TO memory_embeddings;`);
    
    console.log('memory_embeddings表引用更新完成');
  } catch (error) {
    console.error('更新memory_embeddings表引用失败:', error);
    throw error;
  }
}

// 创建索引
async function createIndices() {
  console.log('创建索引...');
  
  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id);
      CREATE INDEX IF NOT EXISTS memory_keywords_memory_id_idx ON memory_keywords(memory_id);
      CREATE INDEX IF NOT EXISTS memory_embeddings_memory_id_idx ON memory_embeddings(memory_id);
    `);
    
    console.log('索引创建完成');
  } catch (error) {
    console.error('创建索引失败:', error);
    throw error;
  }
}

// 验证修复结果
async function validateFix() {
  console.log('验证ID修复结果...');
  
  try {
    // 检查memories表中的记录数
    const memoriesCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM memories;`);
    const memoriesCount = memoriesCountResult[0]?.count || 0;
    console.log(`memories表中有 ${memoriesCount} 条记录`);
    
    // 检查memory_keywords表中的记录数
    const keywordsCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM memory_keywords;`);
    const keywordsCount = keywordsCountResult[0]?.count || 0;
    console.log(`memory_keywords表中有 ${keywordsCount} 条记录`);
    
    // 检查memory_embeddings表中的记录数
    const embeddingsCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM memory_embeddings;`);
    const embeddingsCount = embeddingsCountResult[0]?.count || 0;
    console.log(`memory_embeddings表中有 ${embeddingsCount} 条记录`);
    
    // 检查memory_id格式
    const memoryIdSampleResult = await db.execute(sql`SELECT id FROM memories LIMIT 5;`);
    const memoryIdSamples = memoryIdSampleResult || [];
    console.log('memories表ID样本:', memoryIdSamples.map(m => m.id).join(', '));
    
    // 检查memory_keywords表中的memory_id
    const keywordIdSampleResult = await db.execute(sql`SELECT memory_id FROM memory_keywords LIMIT 5;`);
    const keywordIdSamples = keywordIdSampleResult || [];
    console.log('memory_keywords表memory_id样本:', keywordIdSamples.map(k => k.memory_id).join(', '));
    
    // 检查memory_embeddings表中的memory_id
    const embeddingIdSampleResult = await db.execute(sql`SELECT memory_id FROM memory_embeddings LIMIT 5;`);
    const embeddingIdSamples = embeddingIdSampleResult || [];
    console.log('memory_embeddings表memory_id样本:', embeddingIdSamples.map(e => e.memory_id).join(', '));
    
    console.log('验证完成，所有ID已更新为时间戳格式');
  } catch (error) {
    console.error('验证失败:', error);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    await createMappingTable();
    await populateMappingTable();
    await updateMemoriesIds();
    await updateKeywordsReferences();
    await updateEmbeddingsReferences();
    await createIndices();
    await validateFix();
    
    console.log('记忆ID映射修复完成');
  } catch (error) {
    console.error('修复过程出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行主函数
main();