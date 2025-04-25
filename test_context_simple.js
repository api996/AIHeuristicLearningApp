/**
 * 简化版上下文测试脚本
 * 用于快速测试模型是否能在上下文中记住信息
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
        title: `简单上下文测试-${model}-${new Date().toISOString().substring(0, 19)}`,
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
    
    // 创建实际fetch promise
    const response = await fetch(endpoint, {
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
    log(`[${model}] 响应摘要: ${data.text.substring(0, 150)}...`, 'success');
    
    return data;
  } catch (error) {
    log(`[${model}] 发送消息失败: ${error.message}`, 'error');
    return null;
  }
}

// 执行简单的上下文测试
async function runSimpleTest(model) {
  log(`\n===== 测试${model}的简单上下文能力 =====\n`, 'highlight');
  
  // 第1步：创建聊天
  const chatId = await createChat(model);
  if (!chatId) {
    log('创建聊天失败，测试终止', 'error');
    return;
  }
  
  // 第2步：发送包含唯一标识符的消息
  const message1 = "你好！我是用户ABC-XYZ-789。请记住我的ID。";
  log('发送初始消息...', 'info');
  const response1 = await sendMessage(model, chatId, message1);
  if (!response1) {
    log('初始消息发送失败，测试终止', 'error');
    return;
  }
  
  // 第3步：发送询问标识符的消息
  const message2 = "你能告诉我，我之前告诉你的ID是什么吗？";
  log('发送询问消息...', 'info');
  const response2 = await sendMessage(model, chatId, message2);
  
  // 第4步：分析结果
  if (response2 && response2.text) {
    log('分析AI回复中是否包含标识符...', 'info');
    const containsId = response2.text.includes('ABC-XYZ-789');
    
    if (containsId) {
      log('测试通过! AI成功记住了标识符。', 'success');
    } else {
      log('测试失败! AI未能记住标识符。', 'error');
      log(`实际回复: ${response2.text.substring(0, 200)}...`, 'debug');
    }
  } else {
    log('无法获取AI回复，测试失败', 'error');
  }
}

// 主函数
async function main() {
  const model = process.argv[2] || 'gemini';
  log(`开始测试模型: ${model}`, 'highlight');
  
  await runSimpleTest(model);
  
  log('测试完成!', 'success');
}

// 执行主函数
main().catch(error => {
  log(`程序执行错误: ${error.message}`, 'error');
  console.error(error);
});