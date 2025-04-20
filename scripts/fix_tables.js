// 修复数据库表
// 恢复数据一致性并添加样本记录

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// 配置NeonDB以使用WebSocket
neonConfig.webSocketConstructor = ws;

// 创建数据库连接
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// 清理和重建表
async function rebuildTables() {
  console.log('开始重建数据库表...');
  
  try {
    // 删除冗余表和临时表
    await db.execute(sql`DROP TABLE IF EXISTS memories_new;`);
    await db.execute(sql`DROP TABLE IF EXISTS memories_backup;`);
    await db.execute(sql`DROP TABLE IF EXISTS memory_id_mapping;`);
    
    // 检查是否有数据
    const memoryCount = await db.execute(sql`SELECT COUNT(*) as count FROM memories;`);
    const count = memoryCount[0]?.count || 0;
    console.log(`当前memories表记录数: ${count}`);
    
    if (parseInt(count, 10) === 0) {
      console.log('memories表为空，重新创建样本数据...');
      
      // 创建样本记忆
      await createSampleMemories();
    }
    
    console.log('重建完成');
  } catch (error) {
    console.error('重建数据库表时出错:', error);
    throw error;
  }
}

// 创建样本记忆
async function createSampleMemories() {
  console.log('创建样本记忆数据...');
  
  try {
    // 创建10条样本记忆
    for (let i = 0; i < 10; i++) {
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
        VALUES (
          ${memoryId}, 
          6, 
          ${"这是样本记忆 #" + (i+1) + "，用于测试知识图谱功能"}, 
          'test', 
          ${"样本记忆-" + (i+1)}
        );
      `);
      
      // 等待一小段时间，确保ID不会重复
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 创建关键词
      await db.execute(sql`
        INSERT INTO memory_keywords (memory_id, keyword)
        VALUES 
          (${memoryId}, '知识图谱'), 
          (${memoryId}, '样本数据'), 
          (${memoryId}, ${"关键词" + (i+1)});
      `);
      
      // 创建向量嵌入 (生成随机向量)
      const mockVector = JSON.stringify(Array.from({length: 10}, () => Math.random()));
      await db.execute(sql`
        INSERT INTO memory_embeddings (memory_id, vector_data)
        VALUES (${memoryId}, ${mockVector}::json);
      `);
      
      console.log(`创建样本记忆 #${i+1}，ID: ${memoryId}`);
    }
    
    console.log('样本记忆创建完成');
  } catch (error) {
    console.error('创建样本记忆时出错:', error);
    throw error;
  }
}

// 验证数据
async function validateData() {
  console.log('验证数据...');
  
  try {
    // 检查记录数量
    const memoriesCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM memories;`);
    const keywordsCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM memory_keywords;`);
    const embeddingsCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM memory_embeddings;`);
    
    const memoriesCount = memoriesCountResult[0]?.count || 0;
    const keywordsCount = keywordsCountResult[0]?.count || 0;
    const embeddingsCount = embeddingsCountResult[0]?.count || 0;
    
    console.log(`memories表记录数: ${memoriesCount}`);
    console.log(`memory_keywords表记录数: ${keywordsCount}`);
    console.log(`memory_embeddings表记录数: ${embeddingsCount}`);
    
    // 验证关联关系
    if (parseInt(memoriesCount, 10) > 0) {
      const sampleMemoryResult = await db.execute(sql`
        SELECT id FROM memories ORDER BY RANDOM() LIMIT 1;
      `);
      
      if (sampleMemoryResult.length > 0) {
        const memoryId = sampleMemoryResult[0].id;
        console.log(`抽样验证记忆ID: ${memoryId}`);
        
        // 验证关键词
        const keywordsResult = await db.execute(sql`
          SELECT keyword FROM memory_keywords WHERE memory_id = ${memoryId};
        `);
        
        console.log(`关联的关键词数量: ${keywordsResult.length}`);
        if (keywordsResult.length > 0) {
          console.log(`关联的关键词: ${keywordsResult.map(k => k.keyword).join(', ')}`);
        }
        
        // 验证向量嵌入
        const embeddingResult = await db.execute(sql`
          SELECT id FROM memory_embeddings WHERE memory_id = ${memoryId};
        `);
        
        console.log(`关联的向量嵌入数量: ${embeddingResult.length}`);
      }
    }
    
    console.log('验证完成');
  } catch (error) {
    console.error('验证数据时出错:', error);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    await rebuildTables();
    await validateData();
    console.log('数据修复完成');
  } catch (error) {
    console.error('修复过程出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行主函数
main();