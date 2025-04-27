/**
 * 测试直接调用xAI API
 * 用于验证API密钥和请求格式是否正确
 */
import 'dotenv/config';
import fetch from 'node-fetch';

// 直接测试grok-3-fast-beta模型
export async function testGrokModel() {
  try {
    const GROK_API_KEY = process.env.GROK_API_KEY;
    if (!GROK_API_KEY) {
      console.error('错误: GROK_API_KEY环境变量未设置');
      return "API密钥未配置";
    }

    console.log('开始直接测试Grok模型...');
    
    // 构建标准的ChatGPT格式请求
    const requestBody = {
      model: "grok-3-fast-beta",
      messages: [
        {
          role: "system",
          content: "你是一个有用的AI助手，专注于学习辅导。"
        },
        {
          role: "user",
          content: "你能告诉我学习人工智能的最佳方法是什么？"
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    };

    console.log('请求模型:', requestBody.model);
    console.log('发送API请求到 https://api.x.ai/v1/chat/completions');
    
    // 标准的Headers，仅包含必要内容
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY}`
    };
    
    console.log('请求头部:', JSON.stringify(headers).replace(GROK_API_KEY, 'HIDDEN'));
    
    // 发送请求
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    // 检查响应
    console.log('API响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API错误:', errorText);
      return `API错误: ${response.status} - ${errorText}`;
    }
    
    // 解析响应
    const data = await response.json();
    console.log('API响应:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
    
    // 提取内容
    const content = data.choices[0]?.message?.content || "无响应";
    console.log('模型回复:', content);
    
    return content;
  } catch (error) {
    console.error('测试过程中出现错误:', error);
    return `测试错误: ${error.message || error}`;
  }
}

// 独立运行时执行测试
if (require.main === module) {
  testGrokModel().then(result => {
    console.log('\n测试结果:', result);
  });
}