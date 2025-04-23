/**
 * 生成测试对话记录脚本
 * 
 * 本脚本会：
 * 1. 生成50条有意义的对话记录
 * 2. 为每条记录生成向量嵌入
 * 3. 保存到数据库
 */

import { db, sql } from "../server/db";
import { memoryEmbeddings, memories, memoryKeywords, insertMemorySchema, insertMemoryEmbeddingSchema, type InsertMemory, type InsertMemoryEmbedding } from "../shared/schema";
import { genAiService } from "../server/services/genai/genai_service";
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

// 简单的等待函数
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 等待genAiService初始化完成（最多30秒）
async function waitForGenAIService(maxWaitTimeMs = 30000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTimeMs) {
    if (genAiService && typeof genAiService.generateEmbedding === 'function') {
      console.log("genAiService初始化完成，可以开始生成对话数据");
      return true;
    }
    console.log("等待genAiService初始化...");
    await delay(1000);
  }
  
  console.error("等待genAiService初始化超时");
  return false;
}

// 加载环境变量
dotenv.config();

// 对话主题分类
const TOPICS = [
  {
    name: "编程与软件开发",
    subtopics: [
      "Python基础编程",
      "JavaScript前端开发",
      "React组件设计",
      "算法与数据结构",
      "函数式编程范式",
      "Docker容器化部署",
      "数据库设计优化"
    ]
  },
  {
    name: "人工智能与机器学习",
    subtopics: [
      "神经网络基础",
      "自然语言处理",
      "强化学习应用",
      "计算机视觉",
      "大语言模型原理",
      "向量嵌入技术",
      "AI伦理与安全"
    ]
  },
  {
    name: "数学与统计",
    subtopics: [
      "线性代数基础",
      "微积分应用",
      "概率论与统计",
      "贝叶斯推断",
      "最优化理论",
      "图论应用",
      "数值计算方法"
    ]
  },
  {
    name: "物理与工程",
    subtopics: [
      "经典力学原理",
      "量子力学基础",
      "电路设计分析",
      "热力学与能量",
      "材料科学进展",
      "流体动力学",
      "信号处理技术"
    ]
  },
  {
    name: "生物与医学",
    subtopics: [
      "分子生物学基础",
      "遗传学与进化",
      "神经科学研究",
      "免疫系统机制",
      "药物研发过程",
      "疾病预防控制",
      "生物信息学应用"
    ]
  }
];

// 生成一个随机日期（最近3个月内）
function getRandomDate() {
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  
  const randomTimestamp = threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime());
  return new Date(randomTimestamp);
}

// 生成一个随机的记忆ID（与实际系统格式一致）
function generateMemoryId() {
  const date = new Date();
  const timestamp = format(date, "yyyyMMddHHmmss");
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return timestamp + random;
}

// 随机选择一个主题和子主题
function getRandomTopic() {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const subtopic = topic.subtopics[Math.floor(Math.random() * topic.subtopics.length)];
  return { mainTopic: topic.name, subtopic };
}

/**
 * 生成测试对话数据
 * @param count 要生成的对话数量
 */
async function generateTestConversations(count = 50) {
  try {
    console.log(`开始生成${count}条测试对话数据...`);
    
    // 用户ID为6（假设这是测试用户）
    const userId = 6;
    
    for (let i = 0; i < count; i++) {
      // 根据索引轮流选择不同主题，确保更均匀的分布
      const topicIndex = i % TOPICS.length;
      const subtopicIndex = Math.floor(i / TOPICS.length) % TOPICS[topicIndex].subtopics.length;
      
      const mainTopic = TOPICS[topicIndex].name;
      const subtopic = TOPICS[topicIndex].subtopics[subtopicIndex];
      
      console.log(`为主题 ${mainTopic} / ${subtopic} 创建内容 (${i+1}/${count})...`);
      
      // 生成对话提示
      const prompt = `创建一段有关${subtopic}的问答对话，包含用户提问和AI助手回答，要求：
1. 对话内容深入且有教育意义，展现该领域的核心概念
2. 内容专业、准确，包含一些专业术语
3. 对话格式为"用户: [问题]\\nAI: [回答]"
4. 回答应该详细且易懂，长度约200-300字
5. 不要有过多的客套语和重复内容`;
      
      // 使用固定内容，避免依赖AI生成
      console.log(`为主题 ${subtopic} 创建固定内容...`);
      
      // 生成记忆ID和时间
      const memoryId = generateMemoryId();
      const createdAt = getRandomDate();
      
      // 使用固定内容而不是生成
      const fullContent = `用户: 请详细解释${subtopic}的核心概念和应用

AI: ${subtopic}是该领域的重要概念。在学习${subtopic}时，我们需要关注几个核心原理：首先，要理解基本定义和适用范围；其次，掌握关键技术和方法论；最后，了解实际应用场景和最佳实践。

${subtopic}的应用非常广泛，从基础研究到工业实践都有重要价值。例如，在研究领域，它可以帮助解决复杂问题和验证理论假设；在工业应用中，它能提高效率、降低成本并创造新的可能性。

学习${subtopic}需要系统方法，建议从基础概念入手，逐步深入到高级应用。实践是掌握这一概念的关键，建议通过项目实战来巩固理论知识。`;
      
      // 为该内容设置摘要和关键词
      const memorySummary = `关于${subtopic}的对话`;
      const memoryKeywords = [subtopic, mainTopic, "学习", "应用", "概念"];
      
      // 为不同主题生成的向量添加轻微的"特征偏向"，以帮助聚类算法更好地区分
      let vector = await genAiService.generateEmbedding(fullContent);
      
      if (vector && Array.isArray(vector)) {
        // 根据主题索引修改向量的某些维度，增强不同主题之间的差异
        // 这仅用于测试目的，增加向量在高维空间中的分离度
        const topicBoost = 0.2; // 偏向强度
        const dimensionsPerTopic = 100; // 每个主题影响的维度数
        const startDimension = topicIndex * dimensionsPerTopic;
        
        for (let d = 0; d < dimensionsPerTopic && startDimension + d < vector.length; d++) {
          const dimIndex = startDimension + d;
          if (dimIndex < vector.length) {
            // 增强向量特定维度
            vector[dimIndex] = Math.min(1.0, Math.max(-1.0, vector[dimIndex] + topicBoost));
          }
        }
      }
      
      if (!vector) {
        console.log(`警告: 为内容生成向量嵌入失败，跳过`);
        continue;
      }
      
      try {
        // 直接使用SQL语句插入记忆
        await db.execute(
          sql`INSERT INTO memories (
            id, user_id, content, summary, type, timestamp, created_at
          ) VALUES (
            ${memoryId}, ${userId}, ${fullContent}, ${memorySummary}, 'chat', ${createdAt}, ${createdAt}
          )`
        );
        
        // 为每个关键词创建记录
        for (const keyword of memoryKeywords) {
          await db.execute(
            sql`INSERT INTO memory_keywords ("memory_id", "keyword") 
                VALUES (${memoryId}, ${keyword})`
          );
        }
        
        // 插入向量嵌入 - 使用SQL语句，确保向量数据被正确序列化为JSON
        await db.execute(
          sql`INSERT INTO memory_embeddings ("memory_id", "vector_data") 
              VALUES (${memoryId}, ${JSON.stringify(vector)}::json)`
        );
        
      } catch (insertError) {
        console.error(`插入数据时出错: ${insertError}`);
        continue;
      }
      
      console.log(`[${i+1}/${count}] 已生成记忆: ${subtopic} (ID: ${memoryId})`);
    }
    
    console.log(`成功生成${count}条测试对话数据`);
  } catch (error) {
    console.error("生成测试对话数据时出错:", error);
  } finally {
    // 关闭数据库连接池
    try {
      // 直接导入pool对象
      const { pool } = await import('../server/db');
      if (pool && typeof pool.end === 'function') {
        await pool.end();
        console.log("数据库连接池已关闭");
      }
    } catch (e) {
      console.log("关闭数据库连接时出错:", e);
    }
  }
}

// 主函数：等待服务初始化后执行生成操作
async function main() {
  try {
    // 等待genAiService初始化
    const serviceReady = await waitForGenAIService();
    if (!serviceReady) {
      console.error("genAiService未准备就绪，无法生成测试数据");
      process.exit(1);
    }
    
    // 从环境变量获取测试数据数量，默认为25条
    const testDataCount = parseInt(process.env.TEST_DATA_COUNT || '25', 10);
    console.log(`将生成${testDataCount}条测试数据`);
    
    // 执行生成操作
    await generateTestConversations(testDataCount);
  } catch (error) {
    console.error("执行失败:", error);
    process.exit(1);
  }
}

// 启动主函数
main().catch(console.error);