/**
 * 记忆ID格式修复脚本
 * 将数据库中的简单数字ID转换为时间戳格式ID
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

// 配置数据库连接
const { DATABASE_URL } = process.env;

// 检查环境变量
if (!DATABASE_URL) {
  console.error("缺少必要的环境变量: DATABASE_URL");
  process.exit(1);
}

// 配置数据库连接
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * 生成时间戳格式的记忆ID
 */
function generateTimestampId() {
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
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${randomSuffix}`;
}

/**
 * 检测ID是否是时间戳格式
 */
function isTimestampId(id) {
  // 时间戳格式ID应为20位数字
  return /^\d{20}$/.test(id);
}

/**
 * 获取所有需要转换的记忆记录
 */
async function getMemoriesToFix() {
  const query = `SELECT id FROM memories WHERE id ~ '^\\d+$' AND length(id) < 10`;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * 更新单个记忆ID
 */
async function updateMemoryId(oldId, newId) {
  console.log(`正在更新记忆ID: ${oldId} -> ${newId}`);
  
  // 开始事务
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. 先更新关联表中的引用
    await client.query(
      'UPDATE memory_keywords SET memory_id = $1 WHERE memory_id = $2',
      [newId, oldId]
    );
    
    await client.query(
      'UPDATE memory_embeddings SET memory_id = $1 WHERE memory_id = $2',
      [newId, oldId]
    );
    
    // 2. 更新记忆记录本身的ID
    await client.query(
      'UPDATE memories SET id = $1 WHERE id = $2',
      [newId, oldId]
    );
    
    await client.query('COMMIT');
    console.log(`成功更新记忆 ${oldId}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`更新记忆 ${oldId} 失败:`, error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log("=== 开始修复记忆ID格式 ===");
    
    // 获取需要修复的记忆
    const memoriesToFix = await getMemoriesToFix();
    console.log(`找到 ${memoriesToFix.length} 条需要转换的记忆记录`);
    
    if (memoriesToFix.length === 0) {
      console.log("没有需要修复的记忆ID，脚本完成");
      await pool.end();
      return;
    }
    
    // 更新记忆ID
    let successCount = 0;
    let failCount = 0;
    
    for (const memory of memoriesToFix) {
      const oldId = memory.id;
      const newId = generateTimestampId();
      
      const success = await updateMemoryId(oldId, newId);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // 添加小延迟，防止ID冲突
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`
=== 修复完成 ===
成功: ${successCount}
失败: ${failCount}
总计: ${memoriesToFix.length}
    `);
    
    // 关闭数据库连接
    await pool.end();
  } catch (error) {
    console.error("脚本执行失败:", error);
    await pool.end();
    process.exit(1);
  }
}

// 运行主函数
main();