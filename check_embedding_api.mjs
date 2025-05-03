/**
 * 检查Flask嵌入API服务状态
 */

import axios from 'axios';

// 在端口 9002 测试服务器是否运行

async function checkFlaskAPI() {
  console.log('测试Flask嵌入API服务...');
  
  try {
    // 先测试健康检查端点
    const healthResponse = await axios.get('http://localhost:9002/health');
    console.log('健康检查响应:', healthResponse.data);
    
    // 再测试生成嵌入
    const embedResponse = await axios.post('http://localhost:9002/api/embed', {
      text: '测试文本，用于验证Flask嵌入API服务是否正常工作'
    });
    
    console.log('嵌入生成成功!');
    console.log('向量维度:', embedResponse.data.dimensions);
    console.log('向量前5个元素:', embedResponse.data.embedding.slice(0, 5));
    
    return true;
  } catch (error) {
    console.error('访问FLask API失败:', error.message);
    
    if (error.response) {
      console.error('服务器响应:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('无法连接到服务器，端口可能未开放或服务未运行');
    }
    
    return false;
  }
}

async function main() {
  const apiWorking = await checkFlaskAPI();
  
  if (apiWorking) {
    console.log('测试结果: Flask嵌入API服务正常工作');
  } else {
    console.log('测试结果: Flask嵌入API服务不可用');
    console.log('建议: 检查服务是否已启动，并确保端口 9002 没有被其他应用占用');
  }
}

main();
