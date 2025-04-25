/**
 * 提示词管理器简化测试脚本
 * 
 * 这是一个简化版测试脚本，直接通过API调用测试提示词管理功能
 */

const fetch = require('node-fetch');

// 颜色输出
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warning: '\x1b[33m%s\x1b[0m',  // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type] || colors.info, `[${type.toUpperCase()}] ${message}`);
}

// 创建测试聊天会话
async function createTestChat() {
  log('创建测试聊天会话...');
  
  try {
    const response = await fetch('http://localhost:5000/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: '提示词管理测试会话',
        model: 'gemini'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const chat = await response.json();
    log(`已创建测试聊天会话，ID: ${chat.id}`, 'success');
    return chat.id;
  } catch (error) {
    log(`创建测试聊天会话失败: ${error}`, 'error');
    return null;
  }
}

// 设置对话阶段
async function setConversationPhase(chatId, phase) {
  log(`设置对话阶段为 ${phase}...`);
  
  try {
    const response = await fetch(`http://localhost:5000/api/conversation/${chatId}/phase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phase })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP错误: ${response.status} - ${errorText}`);
    }
    
    log(`成功设置对话阶段为 ${phase}`, 'success');
    return true;
  } catch (error) {
    log(`设置对话阶段失败: ${error}`, 'error');
    return false;
  }
}

// 发送消息并获取回复
async function sendMessage(chatId, message, model = 'gemini') {
  log(`发送消息到模型 ${model}: "${message}"`);
  
  try {
    const response = await fetch(`http://localhost:5000/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: message,
        model: model
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP错误: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    log(`收到回复，长度: ${result.content.length}字符`, 'success');
    return result;
  } catch (error) {
    log(`发送消息失败: ${error}`, 'error');
    return null;
  }
}

// 获取聊天历史
async function getChatMessages(chatId) {
  log(`获取聊天 ${chatId} 的历史消息...`);
  
  try {
    const response = await fetch(`http://localhost:5000/api/chats/${chatId}/messages`);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const messages = await response.json();
    log(`成功获取 ${messages.length} 条消息`, 'success');
    return messages;
  } catch (error) {
    log(`获取聊天历史失败: ${error}`, 'error');
    return [];
  }
}

// 测试完整流程
async function testWorkflow() {
  log('开始提示词管理器API测试...', 'info');
  
  // 1. 创建测试聊天会话
  const chatId = await createTestChat();
  if (!chatId) {
    log('无法创建测试聊天会话，终止测试', 'error');
    return;
  }
  
  // 2. 设置初始阶段为K
  await setConversationPhase(chatId, 'K');
  
  // 3. 发送第一条消息，使用gemini模型
  const response1 = await sendMessage(chatId, '什么是异步编程？', 'gemini');
  
  // 检查日志以确认是否使用了提示词管理服务
  log('请检查服务器日志，确认是否有"使用增强版模块化提示词处理消息，模型: gemini"的日志', 'info');
  
  // 4. 设置阶段为W，测试阶段变更检测
  await setConversationPhase(chatId, 'W');
  
  // 5. 发送第二条消息，仍使用gemini模型
  const response2 = await sendMessage(chatId, '异步编程与多线程编程的区别是什么？', 'gemini');
  
  // 检查日志以确认是否检测到阶段变更
  log('请检查服务器日志，确认是否有"检测到阶段变更: K -> W"的日志', 'info');
  
  // 6. 切换到deepseek模型，测试模型切换检测
  const response3 = await sendMessage(chatId, '异步编程在JavaScript中如何实现？', 'deepseek');
  
  // 检查日志以确认是否检测到模型切换
  log('请检查服务器日志，确认是否有"检测到模型切换，将在提示词中添加模型切换校验"的日志', 'info');
  
  // 7. 获取聊天历史，检查是否包含所有消息
  const messages = await getChatMessages(chatId);
  
  // 8. 验证测试结果
  if (messages.length === 6) { // 3条用户消息 + 3条AI回复 = 6条消息
    log('\n===== 测试结果 =====', 'info');
    log('API测试完成，请在服务器日志中验证提示词管理器的功能是否正常工作', 'success');
    log('期望在服务器日志中看到：', 'info');
    log('1. "使用增强版模块化提示词处理消息"', 'info');
    log('2. "检测到阶段变更: K -> W"', 'info');
    log('3. "检测到模型切换，将在提示词中添加模型切换校验"', 'info');
  } else {
    log('\n测试未完全成功，消息数量不符合预期', 'warning');
  }
}

// 执行测试
testWorkflow().catch(error => {
  log(`测试过程中发生未捕获的错误: ${error}`, 'error');
});