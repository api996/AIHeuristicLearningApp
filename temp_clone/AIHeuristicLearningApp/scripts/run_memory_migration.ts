/**
 * 执行记忆文件系统到数据库的迁移
 */

import { exec } from 'child_process';
import { log } from '../server/vite';

// 执行数据库表结构推送
async function pushDatabaseSchema() {
  return new Promise<void>((resolve, reject) => {
    log("执行数据库表结构推送 (npx drizzle-kit push)...");
    
    exec('npx drizzle-kit push', (error, stdout, stderr) => {
      if (error) {
        log(`数据库表结构推送失败: ${error.message}`);
        log(`错误输出: ${stderr}`);
        reject(error);
        return;
      }
      
      log(`数据库表结构推送成功: ${stdout}`);
      resolve();
    });
  });
}

// 执行记忆迁移
async function migrateMemories() {
  return new Promise<void>((resolve, reject) => {
    log("执行记忆迁移脚本...");
    
    exec('tsx scripts/migrate_memories_to_db.ts', (error, stdout, stderr) => {
      if (error) {
        log(`记忆迁移失败: ${error.message}`);
        log(`错误输出: ${stderr}`);
        reject(error);
        return;
      }
      
      log(`记忆迁移输出: ${stdout}`);
      resolve();
    });
  });
}

// 执行完整迁移过程
async function runMigration() {
  try {
    log("===== 开始记忆系统迁移 =====");
    
    // 第一步：推送数据库结构
    await pushDatabaseSchema();
    
    // 第二步：迁移记忆数据
    await migrateMemories();
    
    log("===== 记忆系统迁移完成 =====");
  } catch (error) {
    log(`迁移过程出错: ${error}`);
  }
}

// 执行迁移
runMigration().then(() => {
  log("迁移脚本完成");
  process.exit(0);
}).catch(error => {
  log(`迁移脚本执行失败: ${error}`);
  process.exit(1);
});