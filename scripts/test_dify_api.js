
/**
 * Dify API测试脚本
 * 用于测试Dify API的连接性和正确性
 */

const fetch = require('node-fetch');
require('dotenv').config();

// 获取命令行参数
const args = process.argv.slice(2);
const testMode = args[0] || 'basic'; // 默认为基础测试

// 从环境变量获取API密钥
const difyApiKey = process.env.DIFY_API_KEY;

if (!difyApiKey) {
  console.error('错误: 未找到DIFY_API_KEY环境变量。请在.env文件中设置有效的API密钥。');
  process.exit(1);
}

// 测试Dify API连接
async function testDifyApiConnection() {
  console.log('开始测试Dify API连接...');
  
  const endpoint = 'https://api.dify.ai/v1/chat-messages';
  
  const headers = {
    'Authorization': `Bearer ${difyApiKey}`,
    'Content-Type': 'application/json'
  };
  
  const requestBody = {
    query: '测试查询，请返回一个简短的确认消息',
    response_mode: 'blocking',
    conversation_id: null,
    user: 'user',
    inputs: {}
  };
  
  try {
    console.log(`发送请求到: ${endpoint}`);
    console.log(`请求头: ${JSON.stringify(headers, (key, value) => key === 'Authorization' ? `Bearer ${difyApiKey.substring(0, 4)}...` : value)}`);
    console.log(`请求体: ${JSON.stringify(requestBody)}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    console.log(`响应状态: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API错误: ${response.status} - ${errorText}`);
      return false;
    }
    
    const data = await response.json();
    console.log('API响应成功:');
    console.log(JSON.stringify(data, null, 2));
    
    return true;
  } catch (error) {
    console.error(`测试失败: ${error.message}`);
    return false;
  }
}

// 测试Dify API格式
async function testDifyApiFormat() {
  console.log('开始测试Dify API格式...');
  
  const endpoint = 'https://api.dify.ai/v1/chat-messages';
  
  const headers = {
    'Authorization': `Bearer ${difyApiKey}`,
    'Content-Type': 'application/json'
  };
  
  // Dify API支持的格式
  const formatTests = [
    {
      name: '基本问答',
      body: {
        query: '什么是人工智能?',
        response_mode: 'blocking',
        conversation_id: null,
        user: 'user',
        inputs: {}
      }
    },
    {
      name: '复杂提示词',
      body: {
        query: '请以专业的方式解释量子计算的基本原理，使用简单的类比帮助理解',
        response_mode: 'blocking',
        conversation_id: null,
        user: 'user',
        inputs: {}
      }
    }
  ];
  
  let success = true;
  
  for (const test of formatTests) {
    console.log(`\n执行测试: ${test.name}`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(test.body)
      });
      
      console.log(`响应状态: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API错误: ${response.status} - ${errorText}`);
        success = false;
        continue;
      }
      
      const data = await response.json();
      console.log(`响应摘要: ${data.answer ? data.answer.substring(0, 100) + '...' : '无响应'}`);
      
      if (!data.answer) {
        console.error('警告: 响应中缺少answer字段');
        success = false;
      }
    } catch (error) {
      console.error(`测试失败: ${error.message}`);
      success = false;
    }
  }
  
  return success;
}

// 主函数
async function main() {
  console.log('=== Dify API测试工具 ===');
  console.log(`测试模式: ${testMode}`);
  console.log(`API密钥: ${difyApiKey.substring(0, 4)}...${difyApiKey.substring(difyApiKey.length - 4)}`);
  
  let success = false;
  
  if (testMode === 'basic' || testMode === 'all') {
    success = await testDifyApiConnection();
    console.log(`\n基础连接测试: ${success ? '成功 ✅' : '失败 ❌'}`);
  }
  
  if ((testMode === 'format' || testMode === 'all') && (testMode === 'basic' ? success : true)) {
    const formatSuccess = await testDifyApiFormat();
    console.log(`\nAPI格式测试: ${formatSuccess ? '成功 ✅' : '失败 ❌'}`);
    success = success && formatSuccess;
  }
  
  console.log('\n=== 测试完成 ===');
  console.log(`总体结果: ${success ? '成功 ✅' : '失败 ❌'}`);
  
  if (!success) {
    console.log('\n故障排除建议:');
    console.log('1. 确认DIFY_API_KEY在.env文件中正确设置');
    console.log('2. 检查API密钥是否有效、未过期且具有正确的权限');
    console.log('3. 确认您的网络连接可以访问api.dify.ai');
    console.log('4. 检查Dify服务状态 (可能存在服务中断)');
    console.log('5. 检查您的账户额度是否已用尽');
  }
  
  process.exit(success ? 0 : 1);
}

// 运行测试
main().catch(error => {
  console.error('测试过程中发生错误:', error);
  process.exit(1);
});
