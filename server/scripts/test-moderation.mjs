/**
 * 测试OpenAI内容审查API
 */

import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

async function testModeration(text) {
  console.log(`正在测试文本: "${text}"`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: text }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API错误: ${response.status} ${errorText}`);
      return;
    }
    
    const data = await response.json();
    console.log('结果:', JSON.stringify(data, null, 2));
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      console.log('是否被标记:', result.flagged);
      console.log('类别:', JSON.stringify(result.categories, null, 2));
      console.log('分数:', JSON.stringify(result.category_scores, null, 2));
    }
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 测试文本
const testText = process.argv[2] || '这是一个测试文本，用于验证内容审查功能。';
testModeration(testText);