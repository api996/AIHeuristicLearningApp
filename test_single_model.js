/**
 * 测试单个模型的响应
 * 用法: node test_single_model.js [模型名称] [消息]
 */

import fetch from 'node-fetch';

// 美化日志输出的颜色函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m',    // 红色
    model: '\x1b[35m%s\x1b[0m',    // 紫色
    debug: '\x1b[90m%s\x1b[0m',    // 灰色
  };
  console.log(colors[type] || colors.info, message);
}

// 创建新聊天
async function createChat(model) {
  try {
    log(`创建新的${model}聊天...`, 'info');

    const response = await fetch('http://localhost:5000/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 6, // 使用测试用户ID
        title: `测试聊天-${model}-${new Date().toISOString()}`,
        model: model
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`创建聊天失败 (${response.status}): ${errorText}`, 'error');
      return null;
    }

    const data = await response.json();
    log(`成功创建聊天，ID: ${data.id}`, 'success');
    return data.id;
  } catch (error) {
    log(`创建聊天失败: ${error.message}`, 'error');
    return null;
  }
}

// 测试函数 - 发送单个消息到指定模型
async function testModel(model, message, timeout = 15000) {
  try {
    // 创建新聊天
    const chatId = await createChat(model);
    if (!chatId) {
      log(`无法创建${model}聊天，测试终止`, 'error');
      return null;
    }
    
    // 等待一秒，确保聊天创建完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    log(`[${model}] 发送测试请求: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`, 'model');
    
    const endpoint = 'http://localhost:5000/api/chat';
    const startTime = Date.now();
    
    // 创建超时promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`请求超时 (${timeout}ms)`)), timeout);
    });
    
    // 创建实际fetch promise
    const fetchPromise = fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        userId: 6, // 使用测试用户ID
        model,
        chatId,
        useWebSearch: false
      }),
    });
    
    // 使用Promise.race来实现超时
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`[${model}] API错误 (${response.status}): ${errorText}`, 'error');
      return null;
    }
    
    const data = await response.json();
    
    // 打印响应信息
    log(`[${model}] 响应时间: ${responseTime}ms`, 'debug');
    log(`[${model}] 响应文本: ${data.text}`, 'success');
    log(`[${model}] 响应长度: ${data.text.length} 字符`);
    log(`[${model}] 响应模型: ${data.model}`);
    log(`-----------------------------------------`);
    
    return data;
  } catch (error) {
    log(`[${model}] 测试失败: ${error.message}`, 'error');
    return null;
  }
}

// 主函数
async function main() {
  // 从命令行参数获取模型和消息
  const model = process.argv[2] || 'gemini';
  const message = process.argv[3] || '你好，这是一个简单的测试。请确认你是哪个模型，并简要回复。';
  
  log(`\n=== 测试模型: ${model} ===\n`, 'info');
  
  await testModel(model, message);
  
  log(`\n测试完成.\n`, 'success');
}

// 执行主函数
main().catch(error => {
  log(`程序执行错误: ${error.message}`, 'error');
  console.error(error);
});