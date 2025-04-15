// 简单测试OpenAI的API

const apiKey = process.env.OPENAI_API_KEY;
console.log('API Key前几个字符: ' + (apiKey ? apiKey.substring(0, 5) + '...' : '未设置'));

async function testModeration() {
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: "这是一段测试文本" }),
    });
    
    const data = await response.json();
    console.log('API响应:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('API请求失败:', error);
  }
}

testModeration();