/**
 * 直接测试所有模型的响应
 * 无需交互式输入，直接运行此脚本测试所有模型
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

// 可用的模型列表
const MODELS = ['gemini', 'deepseek', 'grok', 'deep'];

// 测试函数 - 发送单个消息到指定模型
async function testModel(model, message) {
  try {
    log(`[${model}] 测试请求: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`, 'model');
    
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
    log(`-----------------------------------------`);
    
    return data;
  } catch (error) {
    log(`[${model}] 测试失败: ${error.message}`, 'error');
    return null;
  }
}

// 测试所有模型同一消息
async function testAllModelsWithSameMessage(message) {
  log(`开始测试所有模型，使用相同的消息: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`, 'info');
  
  for (const model of MODELS) {
    await testModel(model, message);
    // 在测试之间等待一点时间
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log(`所有模型测试完成!`, 'success');
}

// 主函数
async function main() {
  log('\n=== 模型测试工具 - 直接测试所有模型 ===\n', 'info');
  
  // 测试短消息
  await testAllModelsWithSameMessage("你好，这是一个简单的测试。请确认你是哪个模型，并简要回复。");
  
  log('\n=== 测试长消息上下文处理 ===\n', 'info');
  
  // 测试较长的专业问题，查看各个模型的响应质量和上下文处理
  const longMessage = `
我正在研究认知心理学与人工智能学习之间的交叉关系。具体来说，我想了解大型语言模型如何模拟人类的认知过程，特别是在以下几个方面：

1. 工作记忆的限制：人类的工作记忆容量有限（通常是7±2个信息块），而大型语言模型可以处理成千上万的token。这种差异如何影响模型对人类认知过程的模拟？

2. 注意力机制：Transformer架构中的注意力机制与人类的选择性注意力有何相似和不同之处？

3. 先验知识的整合：人类在学习新概念时会利用已有知识网络，大型语言模型如何在预训练和微调过程中实现类似的知识整合？

4. 学习曲线：研究表明人类学习遵循特定的曲线（如艾宾浩斯遗忘曲线），大型语言模型在不同数据分布下的学习效率是否表现出类似模式？

请结合最新的研究进展和你的专业知识，详细回答这些问题。
`.trim();

  // 测试长消息
  await testAllModelsWithSameMessage(longMessage);
}

// 执行主函数
main().catch(error => {
  log(`程序执行错误: ${error.message}`, 'error');
  console.error(error);
});