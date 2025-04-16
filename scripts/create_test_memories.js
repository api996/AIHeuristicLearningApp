/**
 * 创建测试记忆脚本
 * 用于为特定用户创建测试记忆数据
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { storage } from '../server/storage.js';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 为特定用户创建测试记忆
async function createTestMemoriesForUser(userId) {
  console.log(`为用户 ${userId} 创建测试记忆...`);

  // 示例记忆数据  
  const testMemories = [
    {
      content: '我今天学习了React的基础概念，包括组件、状态和属性。React是Facebook开发的前端框架，广泛用于构建单页应用程序。',
      type: 'study',
      summary: 'React基础学习：组件、状态和属性'
    },
    {
      content: '今天研究了向量数据库的工作原理，向量数据库专为存储和检索高维向量而设计，支持语义相似性搜索。常见的向量数据库包括Pinecone、Milvus和FAISS。',
      type: 'research',
      summary: '向量数据库工作原理研究'
    },
    {
      content: '调研了几种大型语言模型的区别，包括GPT-4、Claude和Gemini。GPT-4在文本生成方面表现最好，Claude在长文本理解上有优势，而Gemini则在多模态任务上表现出色。',
      type: 'research',
      summary: '大型语言模型技术对比'
    },
    {
      content: '学习了如何使用TensorFlow框架构建基本的神经网络。TensorFlow提供了丰富的API，可以方便地定义、训练和部署机器学习模型。',
      type: 'study',
      summary: 'TensorFlow框架入门学习'
    },
    {
      content: '探索了数据可视化工具D3.js的使用方法，它允许将数据绑定到DOM，然后对DOM应用数据驱动的变换。D3.js非常灵活，几乎可以创建任何类型的可视化。',
      type: 'exploration',
      summary: 'D3.js数据可视化工具探索'
    }
  ];

  // 记录创建的记忆
  const createdMemories = [];

  // 为每条测试数据创建记忆
  for (const memoryData of testMemories) {
    try {
      // 创建记忆
      const memory = await storage.createMemory(
        userId,
        memoryData.content,
        memoryData.type,
        memoryData.summary
      );
      
      console.log(`已创建记忆 ID: ${memory.id}`);
      createdMemories.push(memory);
      
      // 等待一小段时间，避免过快创建
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('创建记忆失败:', err);
    }
  }

  console.log(`共为用户 ${userId} 创建了 ${createdMemories.length} 条记忆`);
  return createdMemories;
}

// 使用命令行参数获取用户ID
const userId = process.argv[2] ? parseInt(process.argv[2], 10) : 7;

// 执行记忆创建
createTestMemoriesForUser(userId)
  .then(() => {
    console.log('创建测试记忆完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('创建测试记忆出错:', err);
    process.exit(1);
  });