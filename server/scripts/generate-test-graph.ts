/**
 * 测试知识图谱生成脚本
 * 为当前用户生成一组测试记忆数据，用于测试知识图谱的可视化效果
 */

import { db } from '../db';
import { memories, memoryEmbeddings, memoryKeywords } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

interface TestMemory {
  content: string;
  summary: string;
  keywords: string[];
  relatedKeywords?: string[]; // 用于建立关联的额外关键词
  embedding?: number[]; // 简化的嵌入向量
}

// 测试主题和关键词
const TEST_TOPICS = [
  { 
    topic: '机器学习', 
    keywords: ['算法', '模型', '训练', '数据集', '神经网络', '深度学习', '预测'],
    relatedTopics: ['人工智能', '数据科学']
  },
  { 
    topic: '人工智能', 
    keywords: ['机器学习', '自然语言处理', '计算机视觉', 'AGI', '强化学习', '语言模型'],
    relatedTopics: ['机器学习', '编程']
  },
  { 
    topic: '编程', 
    keywords: ['代码', '函数', '变量', '类', '对象', '算法', '数据结构'],
    relatedTopics: ['人工智能', '数据科学']
  },
  { 
    topic: '数据科学', 
    keywords: ['统计', '分析', '数据集', '可视化', '数据挖掘', '预测模型'],
    relatedTopics: ['机器学习', '编程']
  },
  { 
    topic: '物理学', 
    keywords: ['力学', '相对论', '量子力学', '粒子', '能量', '场', '波'],
    relatedTopics: ['数学', '天文学']
  },
  { 
    topic: '数学', 
    keywords: ['代数', '几何', '微积分', '统计', '概率', '线性代数', '集合论'],
    relatedTopics: ['物理学', '编程']
  },
  { 
    topic: '天文学', 
    keywords: ['恒星', '行星', '宇宙', '银河系', '黑洞', '宇宙学', '天体物理学'],
    relatedTopics: ['物理学']
  }
];

// 生成简单的嵌入向量（模拟，实际应使用真实嵌入模型）
function generateSimpleEmbedding(keywords: string[], dimension: number = 20): number[] {
  const embedding = Array(dimension).fill(0);
  
  // 每个关键词影响向量的某些维度
  keywords.forEach((keyword, index) => {
    const hash = hashString(keyword);
    for (let i = 0; i < 5; i++) {
      const pos = (hash + i) % dimension;
      embedding[pos] = (hash % 10) / 10; // 0到1之间的值
    }
  });
  
  // 归一化
  const sum = Math.sqrt(embedding.reduce((acc, val) => acc + val * val, 0));
  return embedding.map(val => sum > 0 ? val / sum : val);
}

// 简单的字符串散列函数
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // 转换为32位整数
  }
  return Math.abs(hash);
}

// 生成测试记忆
function generateTestMemories(userId: number, count: number = 50): TestMemory[] {
  const memories: TestMemory[] = [];
  
  // 为每个主题生成记忆
  TEST_TOPICS.forEach(topic => {
    const memoriesToCreate = Math.floor(count / TEST_TOPICS.length);
    
    for (let i = 0; i < memoriesToCreate; i++) {
      // 抽取4-7个关键词
      const keywordCount = 4 + Math.floor(Math.random() * 4);
      const shuffledKeywords = [...topic.keywords].sort(() => Math.random() - 0.5);
      const selectedKeywords = shuffledKeywords.slice(0, keywordCount);
      
      // 添加1-2个来自相关主题的关键词
      if (topic.relatedTopics && topic.relatedTopics.length > 0) {
        const relatedTopic = TEST_TOPICS.find(t => topic.relatedTopics.includes(t.topic));
        if (relatedTopic) {
          const relatedKeywordCount = 1 + Math.floor(Math.random() * 2);
          const shuffledRelated = [...relatedTopic.keywords].sort(() => Math.random() - 0.5);
          selectedKeywords.push(...shuffledRelated.slice(0, relatedKeywordCount));
        }
      }
      
      // 创建记忆
      const content = `关于${topic.topic}的学习笔记 #${i+1}: ${selectedKeywords.join('、')}的相关内容与应用场景分析`;
      const summary = `${topic.topic}领域中${selectedKeywords.slice(0, 3).join('、')}等概念的要点总结`;
      
      memories.push({
        content,
        summary,
        keywords: selectedKeywords,
        embedding: generateSimpleEmbedding(selectedKeywords)
      });
    }
  });
  
  return memories.sort(() => Math.random() - 0.5); // 随机排序
}

// 将测试记忆保存到数据库
async function saveTestMemoriesToDatabase(userId: number, testMemories: TestMemory[]) {
  console.log(`开始为用户ID=${userId}生成${testMemories.length}条测试记忆数据...`);
  
  const currentTime = new Date();
  let successCount = 0;
  
  for (const memory of testMemories) {
    try {
      // 插入记忆
      const [insertedMemory] = await db
        .insert(memories)
        .values({
          userId,
          content: memory.content,
          summary: memory.summary,
          type: 'conversation',
          timestamp: new Date(currentTime.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // 过去7天内的随机时间
          chatId: null,
          conversationId: uuidv4()
        })
        .returning();
      
      // 插入记忆嵌入
      if (memory.embedding) {
        await db
          .insert(memoryEmbeddings)
          .values({
            memoryId: String(insertedMemory.id), // 转换为字符串
            vectorData: memory.embedding
          });
      }
      
      // 插入记忆关键词
      for (const keyword of memory.keywords) {
        await db
          .insert(memoryKeywords)
          .values({
            memoryId: String(insertedMemory.id), // 转换为字符串
            keyword
          });
      }
      
      successCount++;
    } catch (error) {
      console.error(`插入记忆失败:`, error);
    }
  }
  
  console.log(`成功插入${successCount}/${testMemories.length}条测试记忆数据`);
  return successCount;
}

// 主函数
export async function generateTestGraph(userId: number, memoryCount: number = 50) {
  try {
    console.log(`开始为用户ID=${userId}生成测试知识图谱数据...`);
    
    // 生成测试记忆
    const testMemories = generateTestMemories(userId, memoryCount);
    
    // 保存到数据库
    const insertedCount = await saveTestMemoriesToDatabase(userId, testMemories);
    
    console.log(`测试知识图谱数据生成完成！成功插入${insertedCount}条记忆`);
    return { 
      success: true, 
      message: `成功生成${insertedCount}条测试记忆数据，刷新页面查看知识图谱` 
    };
  } catch (error: any) {
    console.error('生成测试图谱数据失败:', error);
    return { 
      success: false, 
      message: `生成测试数据失败: ${error?.message || "未知错误"}` 
    };
  }
}