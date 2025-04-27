/**
 * 修复版本的Grok API测试
 * 使用纯JavaScript，不需要ts-node
 */
import 'dotenv/config';
import fetch from 'node-fetch';

async function testGrokAPI() {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    console.error('错误: 未配置GROK_API_KEY环境变量');
    process.exit(1);
  }
  
  try {
    console.log('开始测试Grok API连接(修复版本)...');
    console.log(`API密钥长度: ${GROK_API_KEY.length}字符`);
    console.log(`API密钥前5个字符: ${GROK_API_KEY.substring(0, 5)}...`);
    
    // 构建简化的请求，仅包含必要内容
    const requestBody = {
      model: "grok-3-fast-beta",
      messages: [
        {
          role: "user",
          content: "你好，请问你是谁？"
        }
      ]
    };
    
    console.log('发送API请求到xAI服务...');
    
    // 发送API请求 - 使用最简单的headers
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    // 检查状态码
    console.log(`API响应状态码: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API错误详情:`, errorText);
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    // 解析响应
    const data = await response.json();
    console.log('API响应成功，内容:');
    console.log(JSON.stringify(data, null, 2));
    
    // 提取回复文本
    const responseText = data.choices[0]?.message?.content;
    console.log('\nGrok回复:');
    console.log(responseText);
    
    console.log('\n测试完成: API连接成功!');
  } catch (error) {
    console.error('API请求错误:', error);
    process.exit(1);
  }
}

testGrokAPI();