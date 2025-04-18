/**
 * 记忆系统流程测试脚本 (TypeScript版本)
 * 测试从对话摘要->向量化->聚类分析->关键词提取的完整流程
 * 测试完成后应删除此脚本
 */

import { storage } from './server/storage';
import { log } from './server/vite';
import { db } from './server/db';
import { memories, memoryKeywords, memoryEmbeddings, type Memory, type MemoryKeyword } from './shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// 用于测试的用户ID
const TEST_USER_ID = 6;

/**
 * 打印带颜色的日志
 */
function printLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m' // 重置
  };

  console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${colors.reset}`);
}

/**
 * 验证用户记忆数据
 */
async function verifyUserMemories(): Promise<boolean> {
  try {
    printLog(`开始验证用户ID=${TEST_USER_ID}的记忆数据...`);
    
    // 1. 检查用户存在
    const user = await storage.getUser(TEST_USER_ID);
    if (!user) {
      printLog(`用户ID=${TEST_USER_ID}不存在`, 'error');
      return false;
    }
    
    printLog(`用户确认: ${user.username}`, 'success');
    
    // 2. 检查用户记忆
    const memories = await storage.getMemoriesByUserId(TEST_USER_ID);
    printLog(`用户有${memories.length}条记忆记录`, 'info');
    
    if (memories.length === 0) {
      printLog('没有找到记忆记录，流程验证失败', 'error');
      return false;
    }
    
    // 3. 检查记忆的完整性
    let completeMemories = 0;
    let withEmbeddings = 0;
    let withKeywords = 0;
    
    for (const memory of memories) {
      // 检查是否有摘要
      const hasSummary = !!memory.summary;
      
      // 检查是否有嵌入向量
      const embedding = await storage.getEmbeddingByMemoryId(memory.id);
      const hasEmbedding = !!embedding;
      
      // 检查是否有关键词
      const keywords = await storage.getKeywordsByMemoryId(memory.id);
      const hasKeywords = keywords.length > 0;
      
      if (hasEmbedding) withEmbeddings++;
      if (hasKeywords) withKeywords++;
      
      if (hasSummary && hasEmbedding) {
        completeMemories++;
      }
      
      printLog(`记忆ID ${memory.id}: 摘要=${hasSummary}, 向量=${hasEmbedding}, 关键词=${hasKeywords ? keywords.length : 0}`, 
        hasSummary && hasEmbedding ? 'success' : 'warning');
    }
    
    printLog(`完整记忆: ${completeMemories}/${memories.length}`, 
      completeMemories === memories.length ? 'success' : 'warning');
    printLog(`有嵌入向量: ${withEmbeddings}/${memories.length}`, 
      withEmbeddings === memories.length ? 'success' : 'warning');
    printLog(`有关键词: ${withKeywords}/${memories.length}`, 
      withKeywords > 0 ? 'success' : 'warning');
    
    return completeMemories > 0;
  } catch (error) {
    printLog(`验证记忆数据时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 模拟聚类分析过程
 */
async function testClusterAnalysis(): Promise<boolean> {
  try {
    printLog('开始测试聚类分析流程...');
    
    // 获取所有记忆
    const memories = await storage.getMemoriesByUserId(TEST_USER_ID);
    
    if (memories.length === 0) {
      printLog('没有可用记忆，无法测试聚类分析', 'error');
      return false;
    }
    
    // 获取每个记忆的嵌入向量
    let vectors: {id: number, vector: number[]}[] = [];
    for (const memory of memories) {
      const embedding = await storage.getEmbeddingByMemoryId(memory.id);
      if (embedding && Array.isArray(embedding.vectorData)) {
        vectors.push({
          id: memory.id,
          vector: embedding.vectorData
        });
      }
    }
    
    printLog(`获取到${vectors.length}个有效向量数据`, 'info');
    
    if (vectors.length === 0) {
      printLog('没有可用向量数据，无法测试聚类分析', 'error');
      return false;
    }
    
    // 简单计算向量余弦相似度 (仅作示例，实际中应使用专门的聚类算法)
    function cosineSimilarity(vecA: number[], vecB: number[]): number {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      
      const minLength = Math.min(vecA.length, vecB.length);
      
      for (let i = 0; i < minLength; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
      }
      
      if (normA === 0 || normB === 0) return 0;
      
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    
    // 计算所有向量间的相似度
    let similarities: {memoryA: number, memoryB: number, similarity: number}[] = [];
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        const similarity = cosineSimilarity(vectors[i].vector, vectors[j].vector);
        similarities.push({
          memoryA: vectors[i].id,
          memoryB: vectors[j].id,
          similarity
        });
      }
    }
    
    // 按相似度排序
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // 打印最相似的对
    if (similarities.length > 0) {
      const topSimilar = similarities[0];
      printLog(`最相似的记忆对: ${topSimilar.memoryA} 和 ${topSimilar.memoryB}, 相似度: ${topSimilar.similarity.toFixed(4)}`, 'success');
      
      // 获取这两条记忆的内容
      const memoryA = await storage.getMemoryById(topSimilar.memoryA);
      const memoryB = await storage.getMemoryById(topSimilar.memoryB);
      
      if (memoryA && memoryB) {
        printLog(`记忆 ${topSimilar.memoryA}: ${memoryA.content.substring(0, 50)}...`, 'info');
        printLog(`记忆 ${topSimilar.memoryB}: ${memoryB.content.substring(0, 50)}...`, 'info');
      }
    } else {
      printLog('没有足够的记忆对进行相似度分析', 'warning');
    }
    
    return similarities.length > 0;
  } catch (error) {
    printLog(`测试聚类分析流程时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 测试学习路径生成
 */
async function testLearningPath(): Promise<boolean> {
  try {
    printLog('开始测试学习路径生成流程...');
    
    // 获取记忆关键词
    const allKeywords = new Map<string, number>();
    const memories = await storage.getMemoriesByUserId(TEST_USER_ID);
    
    for (const memory of memories) {
      const keywords = await storage.getMemoryKeywords(memory.id);
      
      for (const keyword of keywords) {
        if (allKeywords.has(keyword.keyword)) {
          allKeywords.set(keyword.keyword, allKeywords.get(keyword.keyword)! + 1);
        } else {
          allKeywords.set(keyword.keyword, 1);
        }
      }
    }
    
    // 将关键词转为数组并排序
    const sortedKeywords = [...allKeywords.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, count]) => ({ keyword, count }));
    
    printLog(`提取到${sortedKeywords.length}个有效关键词`, 'info');
    
    if (sortedKeywords.length > 0) {
      // 打印前5个关键词
      const topKeywords = sortedKeywords.slice(0, Math.min(5, sortedKeywords.length));
      printLog('主要关键词:', 'success');
      topKeywords.forEach(k => printLog(`  - ${k.keyword} (出现${k.count}次)`, 'info'));
    } else {
      printLog('没有发现关键词，无法生成学习路径', 'warning');
    }
    
    // 根据关键词生成主题
    if (sortedKeywords.length >= 3) {
      const topics = [
        `关于${sortedKeywords[0].keyword}的学习`,
        `探索${sortedKeywords[1].keyword}主题`,
        `理解${sortedKeywords[2].keyword}概念`
      ];
      
      printLog('根据关键词生成的学习主题:', 'success');
      topics.forEach(topic => printLog(`  - ${topic}`, 'info'));
    }
    
    return sortedKeywords.length > 0;
  } catch (error) {
    printLog(`测试学习路径生成流程时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 主测试函数
 */
async function runMemoryFlowTest(): Promise<boolean> {
  printLog('===== 记忆系统完整流程测试 =====', 'info');
  
  // 验证记忆数据
  const memoryResult = await verifyUserMemories();
  printLog(`记忆数据验证: ${memoryResult ? '通过' : '失败'}`, memoryResult ? 'success' : 'error');
  
  // 测试聚类分析
  const clusterResult = await testClusterAnalysis();
  printLog(`聚类分析测试: ${clusterResult ? '通过' : '失败'}`, clusterResult ? 'success' : 'error');
  
  // 测试学习路径
  const pathResult = await testLearningPath();
  printLog(`学习路径测试: ${pathResult ? '通过' : '失败'}`, pathResult ? 'success' : 'error');
  
  const finalResult = memoryResult && (clusterResult || pathResult);
  printLog(`===== 测试结果: ${finalResult ? '通过' : '失败'} =====`, finalResult ? 'success' : 'error');
  
  return finalResult;
}

// 执行测试
runMemoryFlowTest()
  .then((result) => {
    printLog('记忆系统测试完成，本测试脚本可以安全删除', 'success');
    process.exit(result ? 0 : 1);
  })
  .catch((error) => {
    printLog(`测试过程中发生错误: ${error}`, 'error');
    process.exit(1);
  });