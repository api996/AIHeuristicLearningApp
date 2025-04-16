/**
 * 记忆集群分析工具
 * 用于分析用户记忆数据中的主题集群
 */

import { db } from '../server/db.js';
import { memories, memoryKeywords, memoryEmbeddings } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

/**
 * 对记忆集合进行简单聚类分析
 * @param {Array} memories 记忆数组
 * @param {Array} keywords 关键词数组（每个记忆对应的关键词集合）
 * @returns {Array} 聚类结果
 */
function analyzeMemoryClusters(memories, keywordSets) {
  // 记录每个关键词在哪些记忆中出现
  const keywordOccurrences = {};
  
  // 统计每个关键词的出现次数
  keywordSets.forEach((keywords, index) => {
    keywords.forEach(kw => {
      if (!keywordOccurrences[kw]) {
        keywordOccurrences[kw] = { count: 0, memoryIds: [] };
      }
      keywordOccurrences[kw].count += 1;
      keywordOccurrences[kw].memoryIds.push(memories[index].id);
    });
  });
  
  // 筛选出现次数较多的关键词作为主题
  const topics = Object.entries(keywordOccurrences)
    .filter(([_, data]) => data.count >= 1) // 至少出现在一条记忆中
    .sort((a, b) => b[1].count - a[1].count) // 按出现次数降序排序
    .slice(0, 5) // 取前5个主题
    .map(([keyword, data]) => {
      // 计算该主题占总记忆的百分比
      const percentage = (data.count / memories.length) * 100;
      
      // 选择一条代表性记忆（包含该关键词的第一条记忆）
      const representativeMemoryId = data.memoryIds[0];
      const representativeMemory = memories.find(m => m.id === representativeMemoryId);
      
      return {
        id: keyword,
        topic: keyword,
        count: data.count,
        percentage: Math.round(percentage),
        memoryIds: data.memoryIds,
        representativeMemory: representativeMemory
      };
    });
  
  return topics;
}

/**
 * 获取用户的所有记忆数据
 * @param {number} userId 用户ID
 */
async function getUserMemoriesWithDetails(userId) {
  // 获取用户的记忆
  const userMemories = await db.select()
    .from(memories)
    .where(eq(memories.user_id, userId));
  
  // 获取每个记忆的关键词
  const memoryDetails = [];
  for (const memory of userMemories) {
    const keywords = await db.select()
      .from(memoryKeywords)
      .where(eq(memoryKeywords.memory_id, memory.id));
    
    memoryDetails.push({
      memory,
      keywords: keywords.map(k => k.keyword)
    });
  }
  
  return memoryDetails;
}

/**
 * 分析用户的记忆集群
 * @param {number} userId 用户ID
 */
async function analyzeUserMemoryClusters(userId) {
  console.log(`分析用户 ${userId} 的记忆集群...`);
  
  // 获取用户记忆及其关键词
  const memoryDetails = await getUserMemoriesWithDetails(userId);
  
  if (memoryDetails.length === 0) {
    console.log(`用户 ${userId} 没有记忆数据`);
    return { clusters: [] };
  }
  
  console.log(`用户 ${userId} 有 ${memoryDetails.length} 条记忆`);
  
  // 提取记忆和关键词集合
  const memoriesOnly = memoryDetails.map(d => d.memory);
  const keywordSets = memoryDetails.map(d => d.keywords);
  
  // 分析集群
  const clusters = analyzeMemoryClusters(memoriesOnly, keywordSets);
  
  console.log(`分析完成，找到 ${clusters.length} 个主题集群`);
  
  return {
    userId,
    memoryCount: memoriesOnly.length,
    clusters
  };
}

// 分析用户7的记忆集群
const userId = 7;
analyzeUserMemoryClusters(userId)
  .then(result => {
    console.log('分析结果:');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('分析过程出错:', error);
    process.exit(1);
  });