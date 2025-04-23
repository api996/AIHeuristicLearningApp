/**
 * 生成真实对话数据的脚本
 * 这个脚本会为用户创建有语义价值的真实对话记忆记录
 */

import { db } from './server/db.js';
import { memories, memoryEmbeddings } from './shared/schema.js';
import { log } from './server/vite.js';
import { GoogleGenerativeAI } from '@google/generativeai';
import * as dotenv from 'dotenv';
import readline from 'readline';
import { eq, inArray } from 'drizzle-orm';

// 加载环境变量
dotenv.config();

// 初始化Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 待生成的对话主题列表 - 确保多样性
const conversationTopics = [
  // 编程和技术主题
  "JavaScript异步编程原理与实践",
  "React状态管理策略与性能优化",
  "机器学习基础概念解析",
  "数据库索引设计与查询优化",
  "云原生架构设计模式",
  "Python在数据分析中的应用",
  "网络安全最佳实践与常见威胁",
  "区块链技术原理与应用场景",
  "微服务架构设计挑战与解决方案",
  "前端工程化与构建优化",
  
  // 语言学习主题
  "英语口语提升技巧与实践方法",
  "中文写作常见错误与改进策略",
  "外语学习中的记忆方法",
  "多语言切换对大脑的影响",
  "地道表达与文化习语学习",
  
  // 科学探索主题
  "量子计算基本原理",
  "气候变化的科学证据与影响",
  "人工智能伦理与社会影响",
  "太空探索最新进展",
  "生物多样性与生态系统平衡",
  
  // 艺术创作主题
  "摄影构图原则与实践技巧",
  "音乐创作的基本要素",
  "当代艺术思潮与表现形式",
  "创意写作技巧与灵感来源",
  "设计思维在日常生活中的应用",
  
  // 哲学与思考主题
  "批判性思维培养与应用",
  "哲学概念在现代社会的体现",
  "逻辑思维与论证方法",
  "道德伦理决策框架",
  "认知偏见的识别与克服"
];

/**
 * 生成时间戳ID
 * @returns {string} 时间戳ID
 */
function generateTimestampId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${random}`;
}

/**
 * 为指定主题生成真实对话内容
 * @param {string} topic 对话主题
 * @returns {Promise<{content: string, summary: string}>} 对话内容和摘要
 */
async function generateConversationContent(topic) {
  try {
    // 创建提示词
    const prompt = `请围绕主题"${topic}"创建一段用户与AI之间的深度学习对话。对话应该包含:
    1. 用户提出的相关问题和AI的详尽回答
    2. 对话中应体现出用户在学习过程中的思考和进步
    3. 技术细节应准确且有深度
    4. 对话总长度在500-800字之间
    
    同时生成一个不超过50字的简短摘要，概括对话的主要内容和学习价值。
    
    返回格式:
    对话内容: [完整对话文本]
    对话摘要: [简短摘要]`;

    // 调用Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // 解析返回结果
    const contentMatch = text.match(/对话内容:([\s\S]+?)(?=对话摘要:|$)/i);
    const summaryMatch = text.match(/对话摘要:([\s\S]+?)$/i);
    
    const content = contentMatch ? contentMatch[1].trim() : "";
    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    
    return { content, summary };
  } catch (error) {
    log(`生成对话内容出错: ${error}`, 'error');
    // 提供一个简单的备用内容
    return { 
      content: `关于"${topic}"的对话`, 
      summary: `关于${topic}的简短讨论` 
    };
  }
}

/**
 * 为对话内容生成向量嵌入
 * @param {string} content 对话内容
 * @returns {Promise<number[]>} 向量嵌入
 */
async function generateEmbedding(content) {
  try {
    // 使用Gemini API生成嵌入向量
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await embeddingModel.embedContent(content);
    const embedding = result.embedding.values;
    
    return embedding;
  } catch (error) {
    log(`生成向量嵌入出错: ${error}`, 'error');
    // 返回空向量
    return [];
  }
}

/**
 * 为用户创建真实对话记忆记录
 * @param {number} userId 用户ID
 * @param {number} count 要创建的记忆数量
 * @returns {Promise<void>}
 */
async function createRealisticMemories(userId, count = 50) {
  log(`开始为用户 ${userId} 创建 ${count} 条真实对话记忆...`);
  
  // 确定要使用的主题数量
  const topicsToUse = Math.min(count, conversationTopics.length);
  
  // 随机选择主题
  const selectedTopics = [];
  const usedIndices = new Set();
  
  while (selectedTopics.length < topicsToUse) {
    const randomIndex = Math.floor(Math.random() * conversationTopics.length);
    if (!usedIndices.has(randomIndex)) {
      usedIndices.add(randomIndex);
      selectedTopics.push(conversationTopics[randomIndex]);
    }
  }
  
  // 为每个主题创建记忆
  const createdMemories = [];
  for (let i = 0; i < topicsToUse; i++) {
    const topic = selectedTopics[i];
    log(`生成主题 "${topic}" 的对话内容...`);
    
    try {
      // 生成对话内容和摘要
      const { content, summary } = await generateConversationContent(topic);
      
      // 生成记忆ID
      const memoryId = generateTimestampId();
      
      // 创建记忆记录
      const [memory] = await db.insert(memories).values({
        id: memoryId,
        userId,
        content,
        summary,
        type: "dialogue",
        createdAt: new Date()
      }).returning();
      
      log(`✓ 成功创建记忆 ID ${memoryId}`);
      createdMemories.push(memory);
      
      // 为记忆生成向量嵌入
      const embedding = await generateEmbedding(content);
      
      if (embedding.length > 0) {
        // 保存向量嵌入
        await db.insert(memoryEmbeddings).values({
          memoryId,
          vectorData: embedding
        });
        
        log(`✓ 成功为记忆 ID ${memoryId} 生成向量嵌入，维度: ${embedding.length}`);
      } else {
        log(`× 无法为记忆 ID ${memoryId} 生成向量嵌入`, 'warn');
      }
      
      // 添加延迟，避免API限制
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      log(`创建记忆出错: ${error}`, 'error');
    }
  }
  
  log(`✓✓✓ 已为用户 ${userId} 成功创建 ${createdMemories.length} 条真实对话记忆记录`);
  return createdMemories;
}

/**
 * 清理用户的测试数据
 * @param {number} userId 用户ID
 * @returns {Promise<void>}
 */
async function cleanupTestData(userId) {
  log(`开始清理用户 ${userId} 的测试数据...`);
  
  try {
    // 获取用户的所有记忆ID
    const memoryResult = await db.select({ id: memories.id })
      .from(memories)
      .where(eq(memories.userId, userId));
    
    const memoryIds = memoryResult.map(m => m.id);
    log(`找到 ${memoryIds.length} 条记忆数据`);
    
    // 首先删除向量嵌入
    if (memoryIds.length > 0) {
      await db.delete(memoryEmbeddings)
        .where(inArray(memoryEmbeddings.memoryId, memoryIds));
      
      log(`已删除相关记忆向量嵌入`);
      
      // 然后删除记忆记录
      await db.delete(memories)
        .where(eq(memories.userId, userId));
      
      log(`已删除所有记忆记录`);
    }
    
    log(`✓ 成功清理用户 ${userId} 的所有测试数据`);
  } catch (error) {
    log(`清理测试数据出错: ${error}`, 'error');
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 定义要操作的用户ID和记忆数量
    const userId = 6;  // 主要用户ID
    const memoryCount = 40;  // 要创建的记忆数量
    
    // 检查命令行参数
    const args = process.argv.slice(2);
    const autoMode = args.includes('--auto');
    const skipCleanup = args.includes('--skip-cleanup');
    
    if (autoMode) {
      log('自动模式: 执行全部操作');
      
      if (!skipCleanup) {
        // 自动清理现有数据
        await cleanupTestData(userId);
      } else {
        log('跳过清理现有数据');
      }
      
      // 创建新的真实对话记忆
      await createRealisticMemories(userId, memoryCount);
      
      log('脚本执行完成，请刷新知识图谱查看结果');
      process.exit(0);
    } else {
      // 交互模式
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question(`是否清理用户 ${userId} 的现有数据？(y/n)`, async (answer) => {
        if (answer.toLowerCase() === 'y') {
          // 清理现有数据
          await cleanupTestData(userId);
        }
        
        rl.question(`是否为用户 ${userId} 创建 ${memoryCount} 条新的真实对话记忆？(y/n)`, async (answer2) => {
          rl.close();
          
          if (answer2.toLowerCase() === 'y') {
            // 创建新的真实对话记忆
            await createRealisticMemories(userId, memoryCount);
          }
          
          log('脚本执行完成，请刷新知识图谱查看结果');
          process.exit(0);
        });
      });
    }
  } catch (error) {
    log(`执行脚本出错: ${error}`, 'error');
    process.exit(1);
  }
}

// 执行主函数
main();