/**
 * 上下文裁剪测试脚本
 * 这个脚本生成一个非常长的消息来测试上下文裁剪功能
 */

const fetch = require('node-fetch');

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

// 生成一个指定长度的测试文本
function generateLongText(approximateTokens = 1000) {
  // 假设平均每个token约为4个字符
  const approximateChars = approximateTokens * 4;
  
  // 创建基本段落
  const paragraph = `这是一个用于测试上下文裁剪功能的长文本。我们正在测试当输入非常长时，系统会如何智能地裁剪消息上下文。根据研究，大语言模型在处理长上下文时有不同的策略和能力。当文本超出模型的上下文窗口限制时，一种方法是保留最开始的系统提示和最近的对话，而裁剪中间部分的历史。这种方法可以确保模型理解用户的指令和最近的交互，同时不会被过多的历史信息影响。另一种方法是使用了滑动窗口机制，只保留最相关的上下文片段。不同模型对长文本处理的能力有所不同，我们需要根据实际情况进行调整和优化。`;
  
  // 重复段落以达到目标长度
  const repeats = Math.ceil(approximateChars / paragraph.length);
  let longText = '';
  
  for (let i = 0; i < repeats; i++) {
    longText += `\n\n段落 ${i+1}. ${paragraph}\n\n`;
    
    // 添加一些数字序列，使内容更丰富
    longText += `以下是一些数据点 ${i*100} 到 ${(i+1)*100}:\n`;
    for (let j = 1; j <= 10; j++) {
      longText += `- 数据点 ${i*100 + j}: 值 ${(Math.random() * 100).toFixed(2)}\n`;
    }
  }
  
  log(`生成了约 ${Math.floor(longText.length / 4)} tokens (${longText.length} 字符) 的测试文本`, 'debug');
  return longText;
}

// 测试函数 - 发送单个消息到指定模型
async function testModel(model, message) {
  try {
    log(`[${model}] 测试请求长度: 约 ${Math.floor(message.length / 4)} tokens (${message.length} 字符)`, 'model');
    
    const endpoint = 'http://localhost:5000/api/chat';
    const startTime = Date.now();
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        userId: 6, // 使用测试用户ID
        model,
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
    log(`[${model}] 响应文本 (前150字符): ${data.text.substring(0, 150)}...`, 'success');
    log(`[${model}] 响应长度: ${data.text.length} 字符`);
    log(`[${model}] 响应模型: ${data.model}`);
    
    return data;
  } catch (error) {
    log(`[${model}] 测试失败: ${error.message}`, 'error');
    return null;
  }
}

// 测试上下文裁剪功能
async function testContextTrimming(targetModel = null) {
  const models = targetModel ? [targetModel] : ['gemini', 'deepseek', 'grok', 'deep'];
  
  // 测试不同长度的消息
  const tokenSizes = [1000, 5000, 20000, 50000];
  
  for (const tokens of tokenSizes) {
    log(`\n=== 测试约 ${tokens} tokens 的消息 ===\n`, 'info');
    const longMessage = generateLongText(tokens);
    
    const question = `以上是我的研究笔记。基于这些内容，请帮我总结一下关于上下文处理的主要观点，并提出一些优化建议。`;
    const finalMessage = longMessage + '\n\n' + question;
    
    for (const model of models) {
      log(`\n测试模型 ${model} 处理 ${tokens} tokens 的消息`, 'model');
      await testModel(model, finalMessage);
      // 在模型之间等待一点时间
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  log(`\n所有上下文裁剪测试完成!`, 'success');
}

// 主函数
async function main() {
  log('\n=== 上下文裁剪测试工具 ===\n', 'info');
  log('此工具将生成不同长度的消息来测试上下文裁剪功能', 'info');
  
  // 获取命令行参数，第一个参数是模型名称（可选）
  const targetModel = process.argv[2];
  if (targetModel) {
    log(`将只测试指定的模型: ${targetModel}`, 'warn');
  }
  
  await testContextTrimming(targetModel);
}

// 执行主函数
main().catch(error => {
  log(`程序执行错误: ${error.message}`, 'error');
  console.error(error);
});