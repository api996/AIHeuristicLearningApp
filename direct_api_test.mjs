/**
 * 使用直接的API调用获取特定型号的Gemini Embedding
 */

import axios from 'axios';

const API_KEY = process.env.GEMINI_API_KEY;

async function generateEmbedding(text) {
  console.log(`生成文本嵌入: "${text}"`);
  
  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-embedding-exp-03-07:embedContent',
      {
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
      },
      {
        params: { key: API_KEY },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    const embedding = response.data.embedding;
    console.log(`成功生成向量嵌入，维度: ${embedding.values.length}`);
    return embedding.values;
  } catch (error) {
    console.error('调用API失败:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  const text = '测试文本，用于生成嵌入向量';
  const embedding = await generateEmbedding(text);
  console.log('向量前10个元素:', embedding.slice(0, 10));
}

main();
