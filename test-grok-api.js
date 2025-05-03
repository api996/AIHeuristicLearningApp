/**
 * 测试Grok API连接脚本
 * 此脚本用于验证Grok API的连接和认证是否正确
 */
import 'dotenv/config';

async function testGrokAPI() {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    console.error('错误: 未配置GROK_API_KEY环境变量');
    process.exit(1);
  }
  
  try {
    console.log('开始测试Grok API连接...');
    console.log(`API密钥(部分显示): ${GROK_API_KEY.substring(0, 5)}...${GROK_API_KEY.substring(GROK_API_KEY.length - 5)}`);
    
    // 构建请求
    const requestBody = {
      model: "grok-3-fast-beta",
      messages: [
        {
          role: "system",
          content: "你是一位学生，对学习充满热情。"
        },
        {
          role: "user",
          content: "你好，你怎么看待人工智能技术？"
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    };
    
    console.log('发送API请求到xAI服务...');
    
    // 发送API请求
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
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }
    
    // 解析响应
    const data = await response.json();
    console.log('API响应成功，内容:');
    console.log(JSON.stringify(data, null, 2));
    
    // 提取回复文本
    const responseText = data.choices[0]?.message?.content;
    console.log('\n学生回复:');
    console.log(responseText);
    
    console.log('\n测试完成: API连接成功!');
  } catch (error) {
    console.error('API请求错误:', error);
  }
}

testGrokAPI();