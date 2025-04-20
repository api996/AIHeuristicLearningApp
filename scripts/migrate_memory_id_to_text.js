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
    
    // 1. 删除可能影响修改操作的所有外键约束
    log('删除memory_embeddings表的外键约束...');
    await client.query('ALTER TABLE memory_embeddings DROP CONSTRAINT IF EXISTS memory_embeddings_memory_id_memories_id_fk');
    
    log('删除memory_keywords表的外键约束...');
    await client.query('ALTER TABLE memory_keywords DROP CONSTRAINT IF EXISTS memory_keywords_memory_id_memories_id_fk');
    
    // 2. 将子表的memory_id列从integer更改为text
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
    
    // 3. 查找所有引用memories表id的其他外键约束
    log('查找引用memories表id的其他外键约束...');
    const foreignKeyResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        tc.constraint_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'memories'
        AND ccu.column_name = 'id';
    `);

    // 4. 删除所有找到的外键约束
    log(`找到 ${foreignKeyResult.rows.length} 个引用memories表id的外键约束`);
    for (const row of foreignKeyResult.rows) {
      log(`删除表 ${row.table_name} 的外键约束 ${row.constraint_name}...`);
      await client.query(`
        ALTER TABLE ${row.table_name}
        DROP CONSTRAINT IF EXISTS ${row.constraint_name}
      `);
    }

    // 5. 创建视图函数，便于后续跨类型引用
    log('创建转换函数用于跨类型引用...');
    await client.query(`
      CREATE OR REPLACE FUNCTION memory_id_to_text(integer) RETURNS text AS $$
        SELECT $1::text;
      $$ LANGUAGE SQL IMMUTABLE;
    `);

    // 6. 对于既有数据，只进行类型转换而不更改实际表结构
    // 由于表结构变更成本较高，我们使用应用层适配的方式
    log('处理完成，内存ID在应用层将使用字符串处理');
    
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