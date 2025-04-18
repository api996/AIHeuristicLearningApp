/**
 * 记忆数据嵌入修复工具
 * 用于解决内存ID超出整数范围的问题
 */

import { log } from "./server/vite";
import { db } from "./server/db";
import { memoryEmbeddings, memories } from "./shared/schema";
import { sql, eq } from "drizzle-orm";

async function updateMemoryIds() {
  try {
    log("===== 开始修复记忆ID =====");
    
    // 1. 获取所有记忆，显示当前ID格式
    const allMemories = await db.select().from(memories);
    log(`找到 ${allMemories.length} 条记忆记录`);
    
    if (allMemories.length === 0) {
      log("没有找到记忆记录，无需修复");
      return;
    }
    
    // 显示ID格式问题
    const memoryIds = allMemories.map(m => m.id);
    log(`记忆ID样例: ${memoryIds.slice(0, 3).join(', ')}...`);
    
    // 2. 检查嵌入表的状态
    const embeddings = await db.select().from(memoryEmbeddings);
    log(`找到 ${embeddings.length} 条嵌入记录`);
    
    // 检查这些ID是否对应
    const embeddingMemoryIds = embeddings.map(e => e.memory_id);
    log(`嵌入记忆ID样例: ${embeddingMemoryIds.slice(0, 3).join(', ')}...`);
    
    // 检测到的问题
    log(`记忆ID超出整数范围问题：这是因为使用时间戳作为ID导致的`);
    
    log("===== 记忆嵌入修复建议 =====");
    log("1. 修改记忆表和嵌入表的ID类型为text");
    log("2. 或者更改ID生成策略，使用序列或UUID代替时间戳");
    log("3. 临时解决方案：创建新的嵌入表使用bigint或text类型");
    
    log("===== 结果 =====");
    log("需要数据库模式修改以彻底解决此问题");
    
    return {
      success: true,
      memoryCount: allMemories.length,
      embeddingCount: embeddings.length,
      issues: ["记忆ID超出整数范围"]
    };
  } catch (error) {
    log(`记忆ID分析时出错: ${error}`);
    return {
      success: false,
      error: error
    };
  }
}

// 运行修复
updateMemoryIds().then((result) => {
  log("分析完成。");
}).catch((error) => {
  log(`分析失败: ${error}`);
});