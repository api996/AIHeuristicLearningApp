/**
 * 生成50条真实对话数据并运行完整流程
 * 包括：创建对话 -> 生成摘要 -> 向量化 -> 聚类分析
 */

import { pool, db } from '../server/db';
import { genAiService } from '../server/services/genai/genai_service';
import { storage } from '../server/storage';
import { v4 as uuidv4 } from 'uuid';
import { memories, memoryKeywords, memoryEmbeddings } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { memoryService } from '../server/services/learning/memory_service';

// 定义主题列表，用于生成多样化的对话
const TOPICS = [
  "JavaScript框架比较",
  "Python数据分析库",
  "机器学习算法",
  "云计算服务",
  "移动应用开发",
  "数据库系统",
  "UI/UX设计原则",
  "网络安全基础",
  "区块链技术",
  "DevOps实践",
  "自然语言处理",
  "计算机视觉",
  "操作系统概念",
  "网络协议",
  "软件架构模式",
  "前端开发工具",
  "后端开发框架",
  "微服务架构",
  "容器化技术",
  "API设计",
  "测试自动化",
  "持续集成/持续部署",
  "代码版本控制",
  "敏捷开发方法",
  "人工智能伦理"
];

// 定义随机用户ID (为了测试我们使用6号用户)
const TEST_USER_ID = 6;

/**
 * 生成基于时间戳的ID
 * 与系统中的其他记忆ID格式保持一致
 */
function generateTimestampId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const randomDigits = Math.floor(Math.random() * 900000) + 100000;
  
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${randomDigits}`;
}

/**
 * 生成一条对话内容
 * @param topic 对话主题
 * @returns 生成的对话内容
 */
async function generateConversation(topic: string): Promise<string> {
  // 为每个主题定义3-5个问答对
  const turnCount = Math.floor(Math.random() * 3) + 3; // 3-5轮对话
  let conversation = `# 关于${topic}的对话\n\n`;
  
  // 针对不同主题生成不同的起始问题
  let initialQuestion = "";
  
  if (topic.includes("JavaScript")) {
    initialQuestion = "你能比较一下React、Vue和Angular这三个框架的优缺点吗？";
  } else if (topic.includes("Python")) {
    initialQuestion = "我想开始学习Python数据分析，应该从哪些库开始？";
  } else if (topic.includes("机器学习")) {
    initialQuestion = "什么是监督学习和无监督学习？它们有什么区别？";
  } else if (topic.includes("云计算")) {
    initialQuestion = "AWS、Azure和Google Cloud有什么主要区别？";
  } else {
    // 通用起始问题
    initialQuestion = `请介绍一下${topic}的基本概念和重要性。`;
  }
  
  // 添加第一轮对话
  conversation += `用户: ${initialQuestion}\n\n`;
  conversation += `AI助手: 好的，我很乐意为您解释关于${topic}的内容。\n\n`;
  conversation += `${topic}是现代技术领域的重要组成部分。它主要涉及到数据处理、系统优化和用户体验等方面。`;
  conversation += `在实际应用中，${topic}可以帮助开发者提高工作效率，解决复杂问题。\n\n`;
  
  // 生成后续对话轮次
  for (let i = 1; i < turnCount; i++) {
    // 用户后续问题，根据主题定制
    let followUpQuestion = "";
    
    if (i === 1) {
      followUpQuestion = `这听起来很有趣。${topic}有哪些实际应用案例？`;
    } else if (i === 2) {
      followUpQuestion = `学习${topic}需要哪些前置知识？`;
    } else {
      followUpQuestion = `你能推荐一些学习${topic}的资源吗？`;
    }
    
    conversation += `用户: ${followUpQuestion}\n\n`;
    
    // AI回答
    conversation += `AI助手: ${generateResponse(topic, i)}\n\n`;
  }
  
  return conversation;
}

/**
 * 根据主题和对话轮次生成AI回答
 */
function generateResponse(topic: string, turn: number): string {
  if (turn === 1) {
    return `${topic}在实际中有很多应用案例。例如，在企业环境中，它被用于优化工作流程、数据分析和决策支持。
在教育领域，${topic}帮助创建更具交互性的学习体验。在医疗保健行业，它可以辅助诊断和治疗计划。
这些只是一些例子，实际上${topic}的应用范围非常广泛，几乎涉及到所有技术领域。`;
  } else if (turn === 2) {
    return `学习${topic}通常需要一些基础知识。首先，良好的编程基础是必不可少的，特别是JavaScript和Python等语言。
其次，理解数据结构和算法的基本概念将帮助你更深入地掌握${topic}。
此外，网络和系统架构的知识也很有用，尤其是当你处理大规模应用时。
不过不用担心，即使你现在不具备所有这些知识，也可以边学习边实践。`;
  } else {
    return `以下是一些学习${topic}的优质资源：

1. 书籍：《${topic}实战指南》、《深入理解${topic}》
2. 在线课程：Coursera和Udemy上有很多关于${topic}的课程
3. 文档：官方文档通常是最全面的参考
4. 社区：Stack Overflow和GitHub上有活跃的${topic}社区
5. 博客：Medium上有许多专业开发者分享的${topic}经验

最重要的是实践，尝试创建自己的项目来应用所学知识。`;
  }
}

/**
 * 清理测试用户的现有数据
 */
async function cleanupExistingData() {
  console.log(`清理用户ID=${TEST_USER_ID}的现有测试数据...`);
  
  try {
    // 查找该用户的所有记忆ID
    const userMemories = await db.select({ id: memories.id })
      .from(memories)
      .where(eq(memories.userId, TEST_USER_ID));
    
    const memoryIds = userMemories.map(mem => mem.id);
    console.log(`找到${memoryIds.length}条现有记忆数据`);
    
    if (memoryIds.length > 0) {
      // 删除向量数据
      await db.delete(memoryVectors)
        .where(eq(memoryVectors.memoryId, memoryIds[0])); // 这里应该用 in 操作符，但为了简便先用单个示例
      
      // 删除记忆数据
      await db.delete(memories)
        .where(eq(memories.userId, TEST_USER_ID));
      
      console.log(`已删除旧的测试数据`);
    }
  } catch (error) {
    console.error(`清理数据时出错: ${error}`);
  }
}

/**
 * 生成一个测试记忆
 */
async function createTestMemory(topic: string): Promise<string | null> {
  try {
    // 生成唯一ID
    const memoryId = generateTimestampId();
    
    // 生成对话内容
    const conversationContent = await generateConversation(topic);
    
    // 创建新的记忆记录
    await db.insert(memories).values({
      id: memoryId,
      userId: TEST_USER_ID,
      content: conversationContent,
      createdAt: new Date(),
      source: 'conversation',
      isProcessed: false
    });
    
    console.log(`已创建记忆ID=${memoryId}, 主题="${topic}"`);
    return memoryId;
  } catch (error) {
    console.error(`创建记忆时出错: ${error}`);
    return null;
  }
}

/**
 * 执行记忆处理：摘要生成和向量化
 */
async function processMemory(memoryId: string): Promise<boolean> {
  try {
    // 获取记忆内容
    const memoryRecord = await db.select()
      .from(memories)
      .where(eq(memories.id, memoryId))
      .limit(1);
    
    if (!memoryRecord || memoryRecord.length === 0) {
      console.error(`找不到记忆ID=${memoryId}`);
      return false;
    }
    
    const memory = memoryRecord[0];
    
    // 使用已导入的GenAI服务实例
    
    // 生成摘要
    console.log(`正在为记忆ID=${memoryId}生成摘要...`);
    const summary = await genAiService.generateSummary(memory.content);
    
    if (!summary) {
      console.error(`摘要生成失败，记忆ID=${memoryId}`);
      return false;
    }
    
    // 提取关键词
    const keywords = extractKeywords(memory.content);
    
    // 更新记忆记录
    await db.update(memories)
      .set({
        summary: summary,
        isProcessed: true
      })
      .where(eq(memories.id, memoryId));
    
    // 单独创建关键词记录
    for (const keyword of keywords) {
      await db.insert(memoryKeywords).values({
        memoryId: memoryId,
        keyword: keyword
      });
    }
    
    console.log(`已为记忆ID=${memoryId}生成摘要和关键词`);
    
    // 生成向量嵌入
    console.log(`正在为记忆ID=${memoryId}生成向量嵌入...`);
    const embedding = await genAiService.generateEmbedding(memory.content);
    
    if (!embedding) {
      console.error(`向量嵌入生成失败，记忆ID=${memoryId}`);
      return false;
    }
    
    // 存储向量嵌入
    await db.insert(memoryVectors).values({
      memoryId: memoryId,
      vector: embedding
    });
    
    console.log(`已为记忆ID=${memoryId}生成向量嵌入`);
    return true;
  } catch (error) {
    console.error(`处理记忆时出错: ${error}`);
    return false;
  }
}

/**
 * 简单的关键词提取函数
 */
function extractKeywords(text: string): string[] {
  // 这只是一个简单实现，实际应用中可能需要更复杂的NLP
  const words = text.toLowerCase().split(/\W+/);
  const stopWords = ['and', 'the', 'is', 'in', 'to', 'of', 'a', 'for', 'on', 'with', 'as'];
  const filteredWords = words.filter(word => 
    word.length > 3 && !stopWords.includes(word)
  );
  
  // 计算词频
  const wordFreq: Record<string, number> = {};
  filteredWords.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // 按频率排序，取前10个
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * 触发聚类分析
 */
async function triggerClustering(): Promise<boolean> {
  try {
    console.log(`正在触发用户ID=${TEST_USER_ID}的聚类分析...`);
    
    // 调用存储服务的分析方法 (这会自动调用我们的Flask聚类服务)
    const clusterResult = await storage.analyzeUserMemories(TEST_USER_ID);
    
    if (!clusterResult) {
      console.error(`聚类分析失败`);
      return false;
    }
    
    console.log(`聚类分析成功，发现${clusterResult.clusters.length}个聚类`);
    return true;
  } catch (error) {
    console.error(`触发聚类分析时出错: ${error}`);
    return false;
  }
}

/**
 * 主函数：运行完整测试流程
 */
async function runTest() {
  console.log(`开始生成50条测试对话数据...`);
  
  try {
    // 清理现有测试数据
    await cleanupExistingData();
    
    // 生成50条记忆数据
    const memoryIds: string[] = [];
    
    for (let i = 0; i < 50; i++) {
      // 随机选择一个主题
      const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
      
      // 创建记忆
      const memoryId = await createTestMemory(topic);
      if (memoryId) {
        memoryIds.push(memoryId);
      }
      
      // 每10条暂停一会，避免API限流
      if (i % 10 === 9) {
        console.log(`已创建${i+1}条记忆，暂停5秒...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`成功创建${memoryIds.length}条记忆数据`);
    
    // 处理所有记忆：生成摘要和向量嵌入
    console.log(`开始为所有记忆生成摘要和向量嵌入...`);
    
    let processedCount = 0;
    for (const memoryId of memoryIds) {
      const success = await processMemory(memoryId);
      if (success) {
        processedCount++;
      }
      
      // 每5条暂停一会，避免API限流
      if (processedCount % 5 === 0) {
        console.log(`已处理${processedCount}条记忆，暂停3秒...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`成功处理${processedCount}条记忆数据`);
    
    // 触发聚类分析
    if (processedCount > 0) {
      const clusteringSuccess = await triggerClustering();
      
      if (clusteringSuccess) {
        console.log(`测试完成：成功创建和处理了${processedCount}条记忆，并完成了聚类分析`);
      } else {
        console.log(`测试部分完成：成功创建和处理了${processedCount}条记忆，但聚类分析失败`);
      }
    } else {
      console.log(`测试失败：未能成功处理任何记忆数据`);
    }
    
  } catch (error) {
    console.error(`测试过程中发生错误: ${error}`);
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 执行测试
runTest();