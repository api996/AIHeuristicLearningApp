/**
 * 测试Grok API连接脚本（修复版）
 * 以修改后的格式测试Grok API的连接
 */
import 'dotenv/config';

async function testGrokAPI() {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    console.error('错误: 未配置GROK_API_KEY环境变量');
    process.exit(1);
  }
  
  try {
    console.log('开始测试Grok API连接（修复版）...');
    console.log(`API密钥长度: ${GROK_API_KEY.length} 字符`);
    console.log(`API密钥前缀: ${GROK_API_KEY.substring(0, 5)}...`);
    
    // 尝试去除可能的前缀
    let cleanKey = GROK_API_KEY;
    if (cleanKey.includes('Bearer ')) {
      cleanKey = cleanKey.replace('Bearer ', '');
      console.log('已移除Bearer前缀');
    }
    
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
    console.log('使用的endpoint: https://api.x.ai/v1/chat/completions');
    
    // 发送API请求
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    // 检查状态码
    console.log(`API响应状态码: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API错误详情: ${errorText}`);
      throw new Error(`API请求失败: ${response.status}`);
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
    process.exit(1);
  }
}

testGrokAPI();