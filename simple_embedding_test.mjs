/**
 * 简单的Gemini嵌入测试脚本
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// API密钥
const API_KEY = process.env.GEMINI_API_KEY;

async function main() {
  try {
    // 初始化GoogleAI
    console.log('API_KEY length:', API_KEY ? API_KEY.length : 'missing');
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // 要嵌入的文本
    const text = '测试文本，用于生成嵌入向量';
    console.log('测试文本:', text);
    
    // 获取嵌入模型
    console.log('获取嵌入模型...');
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    console.log('嵌入模型初始化成功');
    
    // 生成嵌入
    console.log('生成嵌入...');
    const result = await embeddingModel.embedContent(text);
    console.log('嵌入生成成功');
    
    // 获取嵌入向量
    const embedding = result.embedding;
    console.log('向量维度:', embedding.values.length);
    console.log('向量前10个元素:', embedding.values.slice(0, 10));
  } catch (error) {
    console.error('错误:', error.message);
    if (error.stack) {
      console.error('调用堆栈:', error.stack);
    }
  }
}

main();
