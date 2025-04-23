/**
 * 生成多主题分布的测试数据
 * 用于测试聚类算法的有效性
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { pool, db } from '../server/db';
import { memories } from '../shared/schema';
import { eq } from 'drizzle-orm';

dotenv.config();

// 配置
const USER_ID = 15; // 测试用户ID
const MEMORY_COUNT = 100; // 生成的记忆数量
const TOPICS = [
  { 
    name: "机器学习基础", 
    keywords: ["监督学习", "无监督学习", "分类", "回归", "聚类算法", "决策树", "神经网络", "训练集", "测试集", "过拟合"]
  },
  { 
    name: "Web开发技术", 
    keywords: ["HTML", "CSS", "JavaScript", "React", "Vue", "Node.js", "RESTful API", "数据库", "GraphQL", "响应式设计"]
  },
  { 
    name: "数据结构与算法", 
    keywords: ["数组", "链表", "树", "图", "哈希表", "排序算法", "搜索算法", "动态规划", "贪心算法", "复杂度分析"]
  },
  { 
    name: "移动应用开发", 
    keywords: ["iOS", "Android", "React Native", "Flutter", "Swift", "Kotlin", "移动UI", "推送通知", "移动性能", "应用发布"]
  },
  { 
    name: "云计算与DevOps", 
    keywords: ["AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "CI/CD", "微服务", "无服务器架构", "自动化测试", "监控工具"]
  },
  { 
    name: "自然语言处理", 
    keywords: ["NLP", "词向量", "情感分析", "命名实体识别", "文本分类", "语言模型", "BERT", "GPT", "文本生成", "机器翻译"]
  },
  { 
    name: "计算机视觉", 
    keywords: ["图像处理", "目标检测", "图像分类", "卷积神经网络", "CNN", "人脸识别", "图像分割", "深度学习", "OpenCV", "YOLO"]
  }
];

// Gemini API 设置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('需要设置 GEMINI_API_KEY 环境变量');
  process.exit(1);
}

/**
 * 生成随机的时间戳格式ID
 * @returns {string} 时间戳ID
 */
function generateTimestampId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const randomDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  return `${year}${month}${day}${hours}${minutes}${randomDigits}`;
}

/**
 * 根据主题生成一个随机对话内容
 * @param topic 主题对象
 * @returns 对话内容
 */
function generateConversationForTopic(topic: any): string {
  // 从主题关键词中随机选择3-5个
  const keywordCount = 3 + Math.floor(Math.random() * 3);
  const shuffledKeywords = [...topic.keywords].sort(() => 0.5 - Math.random());
  const selectedKeywords = shuffledKeywords.slice(0, keywordCount);
  
  // 构建对话提示
  const userQuestion = `我想学习${topic.name}，特别是关于${selectedKeywords.join('、')}的内容，你能帮我解释一下吗？`;
  
  // 构建完整对话
  return `用户: ${userQuestion}

AI: 我很乐意帮你解释${topic.name}相关的知识，特别是你提到的${selectedKeywords.join('、')}。

${selectedKeywords.map(keyword => `关于${keyword}，这是一个${topic.name}中的重要概念...(简要说明)`).join('\n\n')}

这些概念在${topic.name}领域中相互关联，通常${selectedKeywords[0]}和${selectedKeywords[1]}结合使用可以解决复杂问题。

用户: 这些概念之间有什么联系？能给我一个实际应用的例子吗？

AI: 当然可以。在${topic.name}领域，这些概念紧密相连：

${selectedKeywords.slice(0, 2).map(keyword => `${keyword}通常用于...`).join('\n')}

一个实际的应用例子是：在构建一个${topic.name}相关的项目时，你可以先使用${selectedKeywords[0]}进行初始化，然后应用${selectedKeywords[1]}来优化性能...

用户: 谢谢解释，我对${selectedKeywords[0]}特别感兴趣，有没有推荐的学习资源？

AI: 很高兴你对${selectedKeywords[0]}感兴趣！以下是一些优质学习资源：

1. 《${topic.name}实战指南》- 该书有专门讲解${selectedKeywords[0]}的章节
2. Stanford大学的${topic.name}课程
3. GitHub上的开源项目: ${topic.name.replace(/\s+/g, '-').toLowerCase()}-examples
4. 交互式学习平台如Coursera和Udemy上的${topic.name}专题课程

希望这些资源对你学习${selectedKeywords[0]}有所帮助！`;
}

/**
 * 使用Gemini API生成对话摘要
 * @param conversation 完整对话内容
 * @returns 对话摘要
 */
async function generateSummary(conversation: string): Promise<string> {
  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
      {
        contents: [{
          parts: [{
            text: `请为以下对话生成一个简洁的摘要，突出关键点和主题。摘要应该是一段话，不要超过100个字。对话内容:\n\n${conversation}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 200,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        }
      }
    );
    
    // 提取生成的摘要
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts[0]) {
      return response.data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('无法从API响应中提取摘要');
  } catch (error: any) {
    console.error('生成摘要时出错:', error.message);
    // 如果API调用失败，生成一个简单的备用摘要
    return `关于${conversation.substring(10, 30)}...的对话`;
  }
}

/**
 * 为每个主题生成相应的嵌入向量
 * 我们使用一个简化的方法来模拟语义相似性
 * @param topic 主题对象
 * @returns 3072维向量
 */
function generateVectorForTopic(topic: any): number[] {
  // 生成一个基础随机向量
  const baseVector = Array(3072).fill(0).map(() => (Math.random() * 2 - 1));
  
  // 主题索引
  const topicIndex = TOPICS.findIndex(t => t.name === topic.name);
  
  // 对于同一主题，我们希望向量有一定的相似性
  // 因此对基础向量进行一些特定于主题的转换
  const transformedVector = baseVector.map((val, idx) => {
    // 每个主题在特定维度上有特征性的值
    if (idx % TOPICS.length === topicIndex) {
      return val * 0.8 + 0.2; // 向正方向偏移
    }
    // 其他主题的特征维度向负方向偏移
    else if (idx % TOPICS.length === (topicIndex + 1) % TOPICS.length || 
             idx % TOPICS.length === (topicIndex + 2) % TOPICS.length) {
      return val * 0.8 - 0.2; // 向负方向偏移
    }
    return val;
  });
  
  // 归一化向量以保持一致的长度
  const length = Math.sqrt(transformedVector.reduce((sum, val) => sum + val * val, 0));
  return transformedVector.map(val => val / length);
}

/**
 * 生成测试用户的记忆数据
 */
async function generateTestData() {
  try {
    console.log(`开始为用户ID=${USER_ID}生成${MEMORY_COUNT}条多样化主题的测试记忆...`);
    
    // 检查用户是否存在
    await ensureUserExists(USER_ID);
    
    // 清除现有测试数据
    await clearExistingMemories();
    
    // 为每个主题分配记忆数量
    const topicDistribution: Record<string, number> = {};
    let remaining = MEMORY_COUNT;
    
    // 确保每个主题至少有一些记忆
    TOPICS.forEach((topic, index) => {
      // 随机分配，但确保每个主题至少有5条记忆
      const minCount = 5;
      const maxExtraCount = Math.floor((MEMORY_COUNT - TOPICS.length * minCount) / TOPICS.length);
      const extraCount = Math.floor(Math.random() * maxExtraCount);
      topicDistribution[topic.name] = minCount + extraCount;
      remaining -= (minCount + extraCount);
    });
    
    // 分配剩余的记忆
    while (remaining > 0) {
      const randomTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)].name;
      topicDistribution[randomTopic]++;
      remaining--;
    }
    
    console.log('记忆主题分布:');
    Object.entries(topicDistribution).forEach(([topic, count]) => {
      console.log(`- ${topic}: ${count}条记忆 (${Math.round(count/MEMORY_COUNT*100)}%)`);
    });
    
    // 创建记忆
    const createdMemories: string[] = [];
    const startTime = Date.now();
    
    for (const [topicName, count] of Object.entries(topicDistribution)) {
      const topic = TOPICS.find(t => t.name === topicName);
      
      console.log(`生成主题 "${topicName}" 的${count}条记忆...`);
      
      for (let i = 0; i < count; i++) {
        const id = generateTimestampId();
        const createdAt = new Date(startTime - Math.random() * 30 * 24 * 60 * 60 * 1000); // 随机过去30天内的时间
        
        // 为主题生成对话内容
        const content = generateConversationForTopic(topic);
        
        // 使用Gemini生成摘要
        const summary = await generateSummary(content);
        
        // 提取关键词
        const randomKeywordCount = 3 + Math.floor(Math.random() * 4); // 3-6个关键词
        const keywords = topic!.keywords
          .sort(() => 0.5 - Math.random())
          .slice(0, randomKeywordCount);
          
        // 生成向量
        const vector = generateVectorForTopic(topic);
        
        // 创建记忆记录
        await db.insert(memories).values({
          id,
          userId: USER_ID,
          content,
          summary,
          createdAt
        });
        
        // 插入记忆关键词
        for (const keyword of keywords) {
          await db.insert(memoryKeywords).values({
            memoryId: id,
            keyword
          });
        }
        
        // 插入向量嵌入
        await db.insert(memoryEmbeddings).values({
          memoryId: id,
          vectorData: JSON.stringify(vector)
        });
        
        createdMemories.push(id);
        
        // 进度报告
        if (createdMemories.length % 10 === 0) {
          console.log(`已创建 ${createdMemories.length}/${MEMORY_COUNT} 条记忆...`);
        }
      }
    }
    
    console.log(`成功为用户ID=${USER_ID}创建了${createdMemories.length}条多主题测试记忆`);
    console.log('记忆ID列表 (前10个):', createdMemories.slice(0, 10));
    
    return {
      count: createdMemories.length,
      ids: createdMemories
    };
  } catch (error: any) {
    console.error('生成测试数据时出错:', error);
    throw error;
  }
}

/**
 * 确保测试用户存在
 * @param userId 用户ID
 */
async function ensureUserExists(userId: number) {
  // 在实际应用中，这里应该检查用户是否存在并创建
  // 由于这是测试脚本，这里简化处理
  console.log(`确保用户ID=${userId}存在...`);
}

/**
 * 清除用户现有的记忆数据
 */
async function clearExistingMemories() {
  console.log(`清除用户ID=${USER_ID}的现有记忆数据...`);
  await db.delete(memories).where(eq(memories.userId, USER_ID));
  console.log('现有记忆数据已清除');
}

// 脚本入口点
(async () => {
  try {
    console.log('开始生成多主题测试数据...');
    const result = await generateTestData();
    console.log(`数据生成完成，共创建${result.count}条记忆记录`);
    process.exit(0);
  } catch (error) {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }
})();