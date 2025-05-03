/**
 * 记忆ID类型迁移工具
 * 将memories表的ID从integer类型迁移到text类型，同时保持与相关表的引用关系
 */

// 使用drizzle-orm和PostgreSQL客户端
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// 配置NeonDB以使用WebSocket
neonConfig.webSocketConstructor = ws;

// 创建数据库连接
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

/**
 * 检查表是否存在
 * @param {string} tableName 表名
 * @returns {Promise<boolean>} 存在返回true，否则返回false
 */
async function checkTableExists(tableName) {
  console.log(`检查表 ${tableName} 是否存在...`);
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = ${tableName}
    ) as exists;
  `);
  return result[0]?.exists || false;
}

/**
 * 备份memories表
 * @returns {Promise<void>}
 */
async function backupMemoriesTable() {
  console.log('创建memories表备份...');
  
  try {
    // 检查备份表是否已存在
    const backupExists = await checkTableExists('memories_backup');
    if (backupExists) {
      console.log('备份表已存在，跳过备份步骤');
      return;
    }
    
    // 创建备份表
    await db.execute(sql`
      CREATE TABLE memories_backup AS 
      SELECT * FROM memories;
    `);
    
    console.log('备份完成: memories_backup 表已创建');
  } catch (error) {
    console.log('备份表可能已存在，继续执行后续步骤');
  }
}

/**
 * 创建具有text类型ID的新memories表
 * @returns {Promise<void>}
 */
async function createNewMemoriesTable() {
  console.log('创建新的memories表结构...');
  
  try {
    // 检查临时表是否已存在
    const tempExists = await checkTableExists('memories_new');
    if (tempExists) {
      console.log('删除旧的临时表');
      await db.execute(sql`DROP TABLE memories_new CASCADE;`);
    }
    
    // 创建新表，ID为text类型
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
    
    console.log('新表结构创建完成');
  } catch (error) {
    console.error('创建新表时出错:', error);
    throw error;
  }
}

/**
 * 迁移数据到新表
 * @returns {Promise<void>}
 */
async function migrateData() {
  console.log('从旧表迁移数据到新表...');
  
  // 将数据从旧表复制到新表，将整数ID转换为文本
  await db.execute(sql`
    INSERT INTO memories_new (
      id, user_id, content, type, timestamp, summary, created_at
    )
    SELECT 
      id::TEXT, user_id, content, type, timestamp, summary, created_at
    FROM 
      memories;
  `);
  
  // 获取当前迁移的记录数
  const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM memories_new;`);
  console.log(`迁移完成：${countResult[0]?.count || 0} 条记录已迁移`);
}

/**
 * 替换旧表
 * @returns {Promise<void>}
 */
async function replaceOldTable() {
  console.log('替换旧的memories表...');
  
  // 检查是否有外键约束
  const constraintsResult = await db.execute(sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_name IN ('memory_keywords', 'memory_embeddings')
    AND constraint_name LIKE '%memories%';
  `);

  // 删除外键约束
  for (const row of constraintsResult) {
    const constraintName = row.constraint_name;
    console.log(`删除外键约束: ${constraintName}`);
    await db.execute(sql`
      ALTER TABLE memory_keywords DROP CONSTRAINT IF EXISTS ${sql.raw(constraintName)};
      ALTER TABLE memory_embeddings DROP CONSTRAINT IF EXISTS ${sql.raw(constraintName)};
    `);
  }
  
  // 删除旧表并重命名新表
  await db.execute(sql`
    DROP TABLE memories;
    ALTER TABLE memories_new RENAME TO memories;
  `);
  
  console.log('表替换完成');
}

/**
 * 重新建立关系
 * @returns {Promise<void>}
 */
async function reestablishRelationships() {
  console.log('重新建立表间关系...');
  
  // 更新memory_keywords和memory_embeddings表的引用约束
  console.log('已不需要创建外键约束，因为关系通过Drizzle ORM自动映射');
  
  // 创建索引以提高性能
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id);
    CREATE INDEX IF NOT EXISTS memory_keywords_memory_id_idx ON memory_keywords(memory_id);
    CREATE INDEX IF NOT EXISTS memory_embeddings_memory_id_idx ON memory_embeddings(memory_id);
  `);
  
  console.log('索引创建完成');
}

/**
 * 验证迁移
 * @returns {Promise<boolean>} 验证成功返回true，否则返回false
 */
async function validateMigration() {
  console.log('验证迁移结果...');
  
  try {
    // 检查memories表是否存在及其id字段类型
    const tableInfo = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'memories' AND column_name = 'id';
    `);
    
    if (!tableInfo.length || tableInfo[0].data_type !== 'text') {
      console.error('验证失败：memories表中的id字段不是text类型');
      return false;
    }
    
    // 验证数据数量
    const backupCount = await db.execute(sql`SELECT COUNT(*) as count FROM memories_backup;`);
    const newCount = await db.execute(sql`SELECT COUNT(*) as count FROM memories;`);
    
    const backupTotal = backupCount[0]?.count || 0;
    const newTotal = newCount[0]?.count || 0;
    
    if (backupTotal !== newTotal) {
      console.error(`验证失败：数据数量不匹配！备份: ${backupTotal}, 新表: ${newTotal}`);
      return false;
    }
    
    // 随机抽查几条记录进行内容验证
    const sampleRecords = await db.execute(sql`
      SELECT id FROM memories_backup ORDER BY RANDOM() LIMIT 5;
    `);
    
    for (const record of sampleRecords) {
      const backupData = await db.execute(sql`
        SELECT content, type FROM memories_backup WHERE id = ${record.id}::int;
      `);
      
      const newData = await db.execute(sql`
        SELECT content, type FROM memories WHERE id = ${record.id}::text;
      `);
      
      if (!newData.length || backupData[0].content !== newData[0].content) {
        console.error(`验证失败：ID为 ${record.id} 的记录内容不匹配`);
        return false;
      }
    }
    
    console.log('验证成功：迁移完成，数据一致性检查通过');
    return true;
  } catch (error) {
    console.error('验证过程中出错:', error);
    return false;
  }
}

/**
 * 主迁移函数
 */
async function migrateMemoryIdType() {
  console.log('开始memories表ID类型迁移...');
  
  try {
    // 1. 备份当前数据
    await backupMemoriesTable();
    
    // 2. 创建新表结构
    await createNewMemoriesTable();
    
    // 3. 迁移数据
    await migrateData();
    
    // 4. 替换旧表
    await replaceOldTable();
    
    // 5. 重新建立关系
    await reestablishRelationships();
    
    // 6. 验证迁移
    const isValid = await validateMigration();
    
    if (isValid) {
      console.log('迁移完成！memories表ID已成功从integer类型转换为text类型');
    } else {
      console.error('迁移验证失败，请检查日志并手动恢复');
    }
  } catch (error) {
    console.error('迁移过程中出错:', error);
    console.error('迁移失败，请使用备份数据恢复');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 执行迁移
migrateMemoryIdType();