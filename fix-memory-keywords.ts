/**
 * 记忆关键词修复脚本
 * 为已存在的记忆添加缺失的关键词
 */

import { memoryService } from './server/services/learning/memory_service';
import { log } from './server/vite';

// 要修复的用户ID
const TARGET_USER_ID = 6;

async function fixMemoryKeywords() {
  try {
    log(`开始修复用户ID=${TARGET_USER_ID}的记忆关键词...`);
    
    // 使用记忆服务的修复方法修复记忆
    const repairCount = await memoryService.repairUserMemories(TARGET_USER_ID);
    
    log(`修复完成，共修复了${repairCount}条记忆数据`);
    
    return repairCount;
  } catch (error) {
    log(`记忆关键词修复失败: ${error}`);
    return 0;
  }
}

// 运行修复操作
fixMemoryKeywords().then((count) => {
  console.log(`记忆关键词修复完成，修复了${count}条记忆`);
  process.exit(0);
}).catch((error) => {
  console.error(`修复过程中出错: ${error}`);
  process.exit(1);
});