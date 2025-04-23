/**
 * 生成测试对话记录脚本
 * 
 * 本脚本会：
 * 1. 生成50条有意义的对话记录
 * 2. 为每条记录生成向量嵌入
 * 3. 保存到数据库
 */

import { db } from "../server/db";
import { memoryEmbeddings, memories } from "../shared/schema";
import { genAiService } from "../server/services/genai/genai_service";
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

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
      // 选择随机主题
      const { mainTopic, subtopic } = getRandomTopic();
      
      // 生成对话提示
      const prompt = `创建一段有关${subtopic}的问答对话，包含用户提问和AI助手回答，要求：
1. 对话内容深入且有教育意义，展现该领域的核心概念
2. 内容专业、准确，包含一些专业术语
3. 对话格式为"用户: [问题]\\nAI: [回答]"
4. 回答应该详细且易懂，长度约200-300字
5. 不要有过多的客套语和重复内容`;
      
      // 使用GenAI服务生成对话内容
      const content = await genAiService.generateTopicForMemories([prompt]);
      
      if (!content) {
        console.log(`警告: 为主题 ${subtopic} 生成内容失败，跳过`);
        continue;
      }
      
      // 生成记忆ID
      const memoryId = generateMemoryId();
      const createdAt = getRandomDate();
      const summary = `关于${subtopic}的对话`;
      
      // 获取关键词
      const keywords = await genAiService.extractKeywords(content) || [subtopic];
      
      // 生成向量嵌入
      const vector = await genAiService.generateEmbedding(content);
      
      if (!vector) {
        console.log(`警告: 为内容生成向量嵌入失败，跳过`);
        continue;
      }
      
      // 保存记忆
      await db.insert(memories).values({
        id: memoryId,
        userId,
        content,
        summary,
        type: "chat",
        keywords: keywords.join(","),
        createdAt,
        timestamp: createdAt
      });
      
      // 保存向量嵌入
      await db.insert(memoryEmbeddings).values({
        memoryId,
        vectorData: vector
      });
      
      console.log(`[${i+1}/${count}] 已生成记忆: ${subtopic} (ID: ${memoryId})`);
    }
    
    console.log(`成功生成${count}条测试对话数据`);
  } catch (error) {
    console.error("生成测试对话数据时出错:", error);
  } finally {
    // 关闭数据库连接
    await db.end?.();
  }
}

// 执行生成操作
generateTestConversations().catch(console.error);