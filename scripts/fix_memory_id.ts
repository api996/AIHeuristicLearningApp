/**
 * 记忆ID修复工具
 * 修复内存ID超出整数范围的问题
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

// 简单的日志函数
function log(message: string) {
  console.log(`[fix_memory_id] ${message}`);
}

async function fixMemoryIdIssue() {
  log("开始修复记忆ID类型问题...");
  
  try {
    // 检查数据库表结构
    log("检查数据库表结构...");
    
    // 修改memory_keywords表的memory_id列类型为TEXT
    log("修改memory_keywords表的memory_id列类型...");
    await db.execute(sql`
      ALTER TABLE memory_keywords 
      ALTER COLUMN memory_id TYPE TEXT
    `);
    
    // 修改memory_embeddings表的memory_id列类型为TEXT
    log("修改memory_embeddings表的memory_id列类型...");
    await db.execute(sql`
      ALTER TABLE memory_embeddings 
      ALTER COLUMN memory_id TYPE TEXT
    `);
    
    // 更新memory_id类型后需要重新创建索引
    log("重新创建索引...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS memory_keywords_memory_id_idx ON memory_keywords(memory_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS memory_embeddings_memory_id_idx ON memory_embeddings(memory_id)
    `);
    
    log("记忆ID类型修复完成！");
  } catch (error) {
    log(`修复过程中出错: ${error}`);
  }
}

// 执行修复
fixMemoryIdIssue()
  .then(() => {
    log("修复脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    log(`脚本执行失败: ${error}`);
    process.exit(1);
  });