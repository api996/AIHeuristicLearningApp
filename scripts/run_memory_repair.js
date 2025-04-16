/**
 * 记忆修复工具
 * 用于修复数据库中缺少摘要、关键词或向量嵌入的记忆
 */

import { db } from '../server/db.js';
import { memories, memoryKeywords, memoryEmbeddings } from '../shared/schema.js';
import { eq, isNull, or } from 'drizzle-orm';

/**
 * 简单的摘要生成函数
 * @param {string} content 记忆内容
 * @returns {string} 生成的摘要
 */
function generateSummary(content) {
  if (!content) return "无内容";
  
  // 简单地取内容的前30个字符作为摘要
  const summary = content.substring(0, Math.min(30, content.length));
  return summary + (content.length > 30 ? "..." : "");
}

/**
 * 简单的关键词提取函数
 * @param {string} content 记忆内容
 * @returns {string[]} 关键词数组
 */
function extractKeywords(content) {
  if (!content) return ["无内容"];
  
  // 分词并过滤常见词和标点符号
  const words = content.split(/[\s,.!?;:，。！？；：]/);
  const filteredWords = words.filter(word => 
    word.length >= 2 && !["的", "了", "是", "在", "和", "有", "我", "你", "他", "她", "它", "们"].includes(word)
  );
  
  // 取最多5个关键词
  return [...new Set(filteredWords)].slice(0, 5);
}

/**
 * 生成简单的向量嵌入
 * @param {string} content 记忆内容
 * @returns {number[]} 向量数组
 */
function generateSimpleEmbedding() {
  // 生成10维随机向量
  return Array.from({ length: 10 }, () => Math.random());
}

/**
 * 修复单条记忆
 * @param {Object} memory 记忆对象
 */
async function repairMemory(memory) {
  console.log(`正在修复记忆ID ${memory.id}`);
  
  let needsUpdate = false;
  let updates = {};
  
  // 检查并修复摘要
  if (!memory.summary) {
    updates.summary = generateSummary(memory.content);
    needsUpdate = true;
    console.log(`  添加摘要: ${updates.summary}`);
  }
  
  // 修改记忆基本信息
  if (needsUpdate) {
    await db.update(memories)
      .set(updates)
      .where(eq(memories.id, memory.id));
    console.log(`  已更新记忆基本信息`);
  }
  
  // 检查并修复关键词
  const keywords = await db.select()
    .from(memoryKeywords)
    .where(eq(memoryKeywords.memory_id, memory.id));
  
  if (keywords.length === 0) {
    const extractedKeywords = extractKeywords(memory.content);
    for (const keyword of extractedKeywords) {
      await db.insert(memoryKeywords)
        .values({
          memory_id: memory.id,
          keyword
        });
    }
    console.log(`  添加了 ${extractedKeywords.length} 个关键词`);
  }
  
  // 检查并修复向量嵌入
  const embedding = await db.select()
    .from(memoryEmbeddings)
    .where(eq(memoryEmbeddings.memory_id, memory.id));
  
  if (embedding.length === 0) {
    const simpleEmbedding = generateSimpleEmbedding();
    await db.insert(memoryEmbeddings)
      .values({
        memory_id: memory.id,
        vector_data: JSON.stringify(simpleEmbedding)
      });
    console.log(`  添加了向量嵌入`);
  }
}

/**
 * 修复所有记忆
 */
async function repairAllMemories() {
  // 获取所有记忆
  const allMemories = await db.select()
    .from(memories);
  
  console.log(`找到 ${allMemories.length} 条记忆记录`);
  
  let repairedCount = 0;
  for (const memory of allMemories) {
    try {
      await repairMemory(memory);
      repairedCount++;
    } catch (error) {
      console.error(`修复记忆 ${memory.id} 时出错:`, error);
    }
  }
  
  console.log(`成功修复 ${repairedCount} 条记忆（共 ${allMemories.length} 条）`);
}

// 执行记忆修复
repairAllMemories()
  .then(() => {
    console.log('记忆修复完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('记忆修复过程出错:', error);
    process.exit(1);
  });