/**
 * 模型上下文窗口和截断测试脚本
 * 用于测试各个模型的上下文窗口大小和智能截断功能
 */

const fetch = require('node-fetch');
const readline = require('readline');

// 美化日志输出的颜色函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m',    // 红色
    model: '\x1b[35m%s\x1b[0m',    // 紫色
  };
  console.log(colors[type] || colors.info, message);
}

// 创建交互式命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 可用的模型列表
const MODELS = ['gemini', 'deepseek', 'grok', 'deep'];

// 测试函数 - 发送单个消息到指定模型
async function testModel(model, message, chatId = null) {
  try {
    log(`正在测试模型: ${model}，消息: "${message}"`, 'model');
    
    const endpoint = 'http://localhost:5000/api/chat';
    const response = await fetch(endpoint, {
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
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`API错误 (${response.status}): ${errorText}`, 'error');
      return null;
    }
    
    const data = await response.json();
    
    // 打印响应信息
    log(`模型 ${model} 响应成功!`, 'success');
    log(`响应文本开始 (前100字符): ${data.text.substring(0, 100)}...`);
    log(`响应文本长度: ${data.text.length} 字符`);
    log(`响应使用的模型: ${data.model}`);
    
    // 如果创建了新对话，返回chatId
    if (data.chatId && !chatId) {
      log(`创建了新对话，ID: ${data.chatId}`, 'success');
      return data.chatId;
    }
    
    return chatId;
  } catch (error) {
    log(`测试失败: ${error.message}`, 'error');
    return null;
  }
}

// 测试长消息序列 - 模拟多轮对话以测试上下文截断
async function testLongConversation(model, rounds = 5) {
  let chatId = null;
  
  log(`开始测试模型 ${model} 的长对话，将进行 ${rounds} 轮交互...`, 'model');
  
  // 第一轮 - 创建新对话
  chatId = await testModel(model, '你好，我想测试一下长对话。请给我介绍一下学习心理学中的认知负荷理论。');
  if (!chatId) {
    log('无法创建对话，测试终止', 'error');
    return;
  }
  
  // 等待几秒让服务器处理
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 后续轮次 - 继续对话
  const followUpQuestions = [
    '认知负荷理论与工作记忆有什么关系？',
    '内在认知负荷、外在认知负荷和相关认知负荷有什么区别？',
    '如何在教学设计中应用认知负荷理论来提高学习效果？',
    '有哪些研究证明了认知负荷理论的有效性？',
    '认知负荷理论与其他学习理论如建构主义有什么联系和区别？',
    '在在线学习环境中，如何减少外在认知负荷？',
    '认知负荷理论的最新研究方向是什么？',
    '如何测量学习者的认知负荷？',
    '认知负荷理论在多媒体学习中的应用有哪些？',
    '认知负荷理论对不同年龄段学习者的适用性如何？'
  ];
  
  // 选择适当数量的问题
  const selectedQuestions = followUpQuestions.slice(0, rounds - 1);
  
  // 发送后续问题
  for (let i = 0; i < selectedQuestions.length; i++) {
    log(`进行第 ${i + 2} 轮对话...`, 'info');
    await testModel(model, selectedQuestions[i], chatId);
    
    // 在每轮之间等待一点时间，避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  log(`${model} 模型长对话测试完成！`, 'success');
}

// 测试所有模型
async function testAllModels() {
  for (const model of MODELS) {
    log(`=== 开始测试 ${model} 模型 ===`, 'model');
    await testModel(model, '你好，这是一个简单的测试消息。请简要回复，确认您收到了我的消息。');
    log(`=== ${model} 模型简单测试完成 ===\n`, 'success');
    
    // 在各个测试之间等待一点时间
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// 主函数
async function main() {
  log('=== 模型上下文窗口和智能截断测试工具 ===', 'info');
  log('此工具将测试各个模型的API响应和上下文处理能力', 'info');
  
  // 询问用户要进行哪种测试
  rl.question('\n请选择测试类型:\n1. 测试所有模型基本响应\n2. 测试特定模型的长对话能力\n选择 (1/2): ', async (answer) => {
    if (answer === '1') {
      await testAllModels();
    } else if (answer === '2') {
      rl.question('\n请选择要测试的模型 (gemini/deepseek/grok/deep): ', async (model) => {
        if (!MODELS.includes(model)) {
          log(`无效的模型选择: ${model}。请选择 gemini, deepseek, grok 或 deep`, 'error');
          rl.close();
          return;
        }
        
        rl.question('\n请输入测试的对话轮数 (建议3-5轮): ', async (rounds) => {
          const numRounds = parseInt(rounds, 10) || 3;
          await testLongConversation(model, numRounds);
          rl.close();
        });
      });
    } else {
      log('无效的选择，退出测试', 'error');
      rl.close();
    }
  });
}

// 执行主函数
main().catch(error => {
  log(`程序执行错误: ${error.message}`, 'error');
  console.error(error);
  rl.close();
});