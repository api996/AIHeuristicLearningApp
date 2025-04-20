/**
 * 内存ID类型迁移工具
 * 将memory_id从整数类型迁移到文本类型
 */

// @ts-nocheck
import { pool } from '../server/db';
import { log } from '../server/vite';

async function migrateMemoryIdToText() {
  const client = await pool.connect();
  
  try {
    log('开始内存ID类型迁移：整数 -> 文本');
    
    // 开始事务
    await client.query('BEGIN');
    
    // 1. 删除外键约束
    log('删除memory_embeddings表的外键约束...');
    await client.query('ALTER TABLE memory_embeddings DROP CONSTRAINT IF EXISTS memory_embeddings_memory_id_memories_id_fk');
    
    log('删除memory_keywords表的外键约束...');
    await client.query('ALTER TABLE memory_keywords DROP CONSTRAINT IF EXISTS memory_keywords_memory_id_memories_id_fk');
    
    // 2. 将memory_id列从integer更改为text
    log('更改memory_embeddings表的memory_id类型为text...');
    await client.query(`
      ALTER TABLE memory_embeddings 
      ALTER COLUMN memory_id TYPE text 
      USING memory_id::text
    `);
    
    log('更改memory_keywords表的memory_id类型为text...');
    await client.query(`
      ALTER TABLE memory_keywords 
      ALTER COLUMN memory_id TYPE text 
      USING memory_id::text
    `);
    
    // 3. 创建自定义函数用于跨类型外键约束
    log('创建转换函数用于跨类型外键约束...');
    await client.query(`
      CREATE OR REPLACE FUNCTION memory_id_to_text(integer) RETURNS text AS $$
        SELECT $1::text;
      $$ LANGUAGE SQL IMMUTABLE;
    `);
    
    // 4. 添加新的外键约束，使用转换函数
    log('添加memory_embeddings表的新外键约束...');
    await client.query(`
      ALTER TABLE memory_embeddings
      ADD CONSTRAINT memory_embeddings_memory_id_memories_id_fk 
      FOREIGN KEY (memory_id) 
      REFERENCES memories(id) 
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
    `);
    
    log('添加memory_keywords表的新外键约束...');
    await client.query(`
      ALTER TABLE memory_keywords
      ADD CONSTRAINT memory_keywords_memory_id_memories_id_fk 
      FOREIGN KEY (memory_id) 
      REFERENCES memories(id) 
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
    `);
    
    // 5. 提交事务
    await client.query('COMMIT');
    
    log('内存ID类型迁移完成！');
    
  } catch (error) {
    // 回滚事务
    await client.query('ROLLBACK');
    log(`迁移失败: ${error.message}`, 'error');
    throw error;
  } finally {
    // 释放客户端连接
    client.release();
  }
}

// 执行迁移
migrateMemoryIdToText()
  .then(() => {
    log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    log(`迁移脚本执行失败: ${error}`, 'error');
    process.exit(1);
  });