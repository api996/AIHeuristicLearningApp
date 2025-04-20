// 记忆ID类型迁移工具 - 简化版
// 仅执行表结构转换，不做数据迁移

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// 配置NeonDB以使用WebSocket
neonConfig.webSocketConstructor = ws;

// 创建数据库连接
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function fixMemoriesTable() {
  console.log('开始修复memories表ID类型...');
  
  try {
    // 1. 检查memories表的ID类型
    const columnInfo = await db.execute(sql`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'memories' AND column_name = 'id';
    `);
    
    const currentType = columnInfo[0]?.data_type;
    console.log(`当前memories.id类型: ${currentType}`);
    
    if (currentType === 'text') {
      console.log('表ID类型已经是text，无需修改');
      return;
    }
    
    // 2. 检查存在的外键约束
    console.log('检查外键约束...');
    const fkInfo = await db.execute(sql`
      SELECT
        tc.constraint_name,
        tc.table_name
      FROM 
        information_schema.table_constraints AS tc
      WHERE 
        tc.constraint_type = 'FOREIGN KEY' AND
        tc.table_name IN ('memory_keywords', 'memory_embeddings') AND
        tc.constraint_name LIKE '%memories%'
    `);
    
    // 3. 删除外键约束
    if (fkInfo.length > 0) {
      console.log(`找到 ${fkInfo.length} 个外键约束`);
      for (const fk of fkInfo) {
        console.log(`删除外键约束: ${fk.constraint_name} 从表 ${fk.table_name}`);
        await db.execute(sql`
          ALTER TABLE ${sql.raw(fk.table_name)} 
          DROP CONSTRAINT IF EXISTS ${sql.raw(fk.constraint_name)};
        `);
      }
    } else {
      console.log('没有找到外键约束，继续...');
    }
    
    // 4. 创建临时表
    console.log('创建临时表...');
    await db.execute(sql`
      CREATE TABLE memories_temp (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'chat',
        timestamp TIMESTAMP DEFAULT NOW(),
        summary TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // 5. 复制数据，转换ID类型
    console.log('复制数据到临时表...');
    await db.execute(sql`
      INSERT INTO memories_temp (
        id, user_id, content, type, timestamp, summary, created_at
      )
      SELECT 
        id::TEXT, user_id, content, type, timestamp, summary, created_at
      FROM 
        memories;
    `);
    
    // 6. 交换表
    console.log('交换表...');
    await db.execute(sql`DROP TABLE memories;`);
    await db.execute(sql`ALTER TABLE memories_temp RENAME TO memories;`);
    
    // 7. 创建索引
    console.log('创建索引...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id);
    `);
    
    console.log('迁移完成！memories表ID类型已从integer转换为text');
  } catch (error) {
    console.error('迁移过程中出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行函数
fixMemoriesTable();