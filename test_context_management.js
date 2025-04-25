/**
 * 上下文管理测试脚本
 * 测试增强的上下文窗口和智能截断功能
 */

import fetch from 'node-fetch';

// 美化日志输出的颜色函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',     // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m',    // 红色
    model: '\x1b[35m%s\x1b[0m',    // 紫色
    debug: '\x1b[90m%s\x1b[0m',    // 灰色
    highlight: '\x1b[93m%s\x1b[0m', // 高亮黄色
  };
  console.log(colors[type] || colors.info, message);
}

// 创建新聊天
async function createChat(model, userId = 15) {
  try {
    log(`创建新的${model}聊天，用户ID: ${userId}...`, 'info');

    const response = await fetch('http://localhost:5000/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        title: `上下文测试-${model}-${new Date().toISOString()}`,
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

// 发送消息
async function sendMessage(model, chatId, message, userId = 15, timeout = 60000) {
  try {
    log(`[${model}] 发送消息: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`, 'model');
    
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
        userId: userId,
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
    log(`[${model}] 响应文本: ${data.text.substring(0, 150)}...`, 'success');
    log(`[${model}] 响应长度: ${data.text.length} 字符`);
    
    return data;
  } catch (error) {
    log(`[${model}] 发送消息失败: ${error.message}`, 'error');
    return null;
  }
}

// 测试模型的上下文记忆保留能力
async function testContextRetention(model) {
  log(`\n===== 测试${model}的上下文记忆保留能力 =====\n`, 'highlight');
  
  // 创建新聊天
  const chatId = await createChat(model);
  if (!chatId) return null;
  
  // 等待聊天创建完成
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 第1轮：初始化对话
  log(`--- 第1轮：初始化对话 ---`, 'info');
  const initialMessage = "你好，我们来做个测试。请把这个唯一标识符记住：CONTEXT_TEST_123。在之后的对话中，当我问你标识符是什么时，请回复这个值。";
  const initialResponse = await sendMessage(model, chatId, initialMessage);
  
  // 确保第一轮对话成功
  if (!initialResponse) {
    log(`初始化对话失败，测试终止`, 'error');
    return null;
  }
  
  // 第2-4轮：填充上下文窗口（减少轮数以加快测试）
  log(`--- 第2-4轮：填充上下文窗口 ---`, 'info');
  for (let i = 1; i <= 3; i++) {
    const fillerMessage = `这是填充消息 #${i}，用来增加上下文长度。请简短回复确认你收到了这条消息。`;
    const response = await sendMessage(model, chatId, fillerMessage);
    if (!response) {
      log(`填充消息 #${i} 失败，但测试将继续`, 'warn');
    }
  }
  
  // 第5轮：测试上下文记忆
  log(`--- 第5轮：测试上下文记忆 ---`, 'info');
  const testMessage = "请告诉我最初我让你记住的唯一标识符是什么？";
  const result = await sendMessage(model, chatId, testMessage);
  
  // 验证结果
  if (result && result.text) {
    const containsIdentifier = result.text.includes("CONTEXT_TEST_123");
    if (containsIdentifier) {
      log(`上下文记忆测试通过！模型成功记住了标识符`, 'success');
    } else {
      log(`上下文记忆测试失败！模型未能记住标识符`, 'error');
    }
  } else {
    log(`无法获取测试结果`, 'error');
  }
  
  return { chatId, result };
}

// 主函数
async function main() {
  // 从命令行参数获取模型
  const model = process.argv[2] || 'gemini';
  
  log(`\n===== 上下文管理测试工具 =====\n`, 'highlight');
  log(`测试模型: ${model}`, 'info');
  
  await testContextRetention(model);
  
  log(`\n测试完成.\n`, 'success');
}

// 执行主函数
main().catch(error => {
  log(`程序执行错误: ${error.message}`, 'error');
  console.error(error);
});