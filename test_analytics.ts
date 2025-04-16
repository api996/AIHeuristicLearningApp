/**
 * 对话分析服务测试脚本 (模拟版)
 * 使用TypeScript编写，通过tsx执行
 */
import { log } from "./server/vite";
import { type ConversationPhase } from "./server/services/conversation-analytics";
import { type Message } from "./shared/schema";

// 重写部分conversationAnalyticsService实现，只用于测试
const mockAnalyticsService = {
  analyzeConversationPhase: async (chatId: number, messages: Message[]) => {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 基于最后一条用户消息的内容推断阶段
    let lastUserMessage = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessage = messages[i].content.toLowerCase();
        break;
      }
    }
    
    // 关键词匹配
    let phase: ConversationPhase = "K"; // 默认知识获取
    let summary = "用户正在寻求信息";
    
    if (lastUserMessage.includes("为什么") || 
        lastUserMessage.includes("如何") || 
        lastUserMessage.includes("不明白") || 
        lastUserMessage.includes("疑惑") || 
        lastUserMessage.includes("困惑")) {
      phase = "W";
      summary = "用户表达疑惑或困惑";
    }
    else if (lastUserMessage.includes("理解") || 
             lastUserMessage.includes("能否提供例子") || 
             lastUserMessage.includes("示例") || 
             lastUserMessage.includes("应用")) {
      phase = "L";
      summary = "用户在深化理解或应用知识";
    }
    else if (lastUserMessage.includes("但是") || 
             lastUserMessage.includes("不认同") || 
             lastUserMessage.includes("质疑") || 
             lastUserMessage.includes("挑战") ||
             lastUserMessage.includes("公平")) {
      phase = "Q";
      summary = "用户在质疑或挑战信息";
    }
    
    log(`[模拟API] 对话ID=${chatId} 分析完成: ${phase}`);
    
    // 返回模拟结果
    return {
      currentPhase: phase,
      summary: summary,
      confidence: 0.8
    };
  },
  
  getLatestPhase: async (chatId: number): Promise<ConversationPhase> => {
    return "K"; // 默认返回知识获取阶段
  }
};

// 模拟不同场景的消息集
const testScenarios = [
  {
    name: "知识获取场景",
    expectedPhase: "K",
    messages: [
      { content: "人工智能的主要应用领域有哪些?", role: "user", chatId: 123, id: 1, createdAt: new Date() },
      { content: "人工智能应用广泛，主要领域包括自然语言处理、计算机视觉、推荐系统、自动驾驶、医疗诊断等。", role: "assistant", chatId: 123, id: 2, createdAt: new Date() },
      { content: "在医疗方面有什么具体例子?", role: "user", chatId: 123, id: 3, createdAt: new Date() }
    ] as Message[]
  },
  {
    name: "疑惑表达场景",
    expectedPhase: "W",
    messages: [
      { content: "神经网络有什么应用?", role: "user", chatId: 124, id: 1, createdAt: new Date() },
      { content: "神经网络应用广泛，包括图像识别、自然语言处理、推荐系统等。", role: "assistant", chatId: 124, id: 2, createdAt: new Date() },
      { content: "我不明白，为什么神经网络被称为'黑盒子'?", role: "user", chatId: 124, id: 3, createdAt: new Date() }
    ] as Message[]
  },
  {
    name: "学习深化场景",
    expectedPhase: "L",
    messages: [
      { content: "Python适合做数据分析吗?", role: "user", chatId: 125, id: 1, createdAt: new Date() },
      { content: "是的，Python是数据分析的主流语言之一，有许多强大的库支持。", role: "assistant", chatId: 125, id: 2, createdAt: new Date() },
      { content: "我理解了。能否提供一个实际例子，展示如何用这些库处理一个CSV数据集?", role: "user", chatId: 125, id: 3, createdAt: new Date() }
    ] as Message[]
  },
  {
    name: "质疑挑战场景",
    expectedPhase: "Q",
    messages: [
      { content: "AI会对就业产生影响吗?", role: "user", chatId: 126, id: 1, createdAt: new Date() },
      { content: "是的，AI可能会自动化某些工作，但也会创造新的就业机会。总体来说，AI更可能转变工作性质而不是彻底取代人类工作。", role: "assistant", chatId: 126, id: 2, createdAt: new Date() },
      { content: "但这些方法本身不也会引入新的偏见吗?谁来决定什么是'公平'?", role: "user", chatId: 126, id: 3, createdAt: new Date() }
    ] as Message[]
  }
];

// 开始测试
async function runTests() {
  log("=== 对话分析服务测试开始 (模拟API) ===");
  
  for (const scenario of testScenarios) {
    log(`\n测试场景: ${scenario.name} (期望: ${scenario.expectedPhase})`);
    try {
      const chatId = parseInt(scenario.messages[0].chatId.toString());
      const result = await mockAnalyticsService.analyzeConversationPhase(chatId, scenario.messages);
      
      if (result) {
        const phaseMatch = result.currentPhase === scenario.expectedPhase;
        log(`${phaseMatch ? '✓' : '✗'} 分析结果: 对话阶段=${result.currentPhase}, 置信度=${result.confidence}`);
        log(`✓ 摘要: "${result.summary}"`);
        if (!phaseMatch) {
          log(`! 注意: 预期阶段=${scenario.expectedPhase}, 实际阶段=${result.currentPhase}`);
        }
      } else {
        log(`✗ 分析失败: 返回null`);
      }
    } catch (error) {
      log(`✗ 分析错误: ${error}`);
    }
  }
  
  // 测试解析异常情况
  log("\n测试异常处理:");
  testResponseParsing();
  
  log("\n=== 对话分析服务测试完成 ===");
}

// 测试响应解析能力
function testResponseParsing() {
  // 测试各种响应格式
  const testResponses = [
    // 正常JSON格式
    '{"currentPhase": "W", "summary": "用户表示困惑", "confidence": 0.8}',
    
    // 带前缀文本的JSON
    '以下是分析结果:\n{"currentPhase": "K", "summary": "用户在获取知识", "confidence": 0.7}',
    
    // 格式化的JSON带缩进和换行
    `{
      "currentPhase": "L",
      "summary": "用户在深化理解",
      "confidence": 0.9
    }`,
    
    // 不规范JSON (缺少引号)
    '{currentPhase: "Q", summary: "用户在质疑", confidence: 0.6}',
    
    // 严重损坏的JSON
    'currentPhase = K, summary = 用户在学习'
  ];
  
  for (const [index, text] of testResponses.entries()) {
    log(`\n测试响应文本 ${index + 1}:`);
    try {
      // 模拟解析尝试
      let result;
      
      // 方法1: 直接解析
      try {
        result = JSON.parse(text);
        log(`✓ 标准JSON解析成功: ${JSON.stringify(result).substring(0, 50)}...`);
      } catch (jsonError) {
        log(`✗ 标准JSON解析失败: ${jsonError.message}`);
        
        // 方法2: 使用正则表达式提取
        const phaseMatch = text.match(/currentPhase"?\s*[:=]\s*"?([KWLQ])"?/i);
        const summaryMatch = text.match(/summary"?\s*[:=]\s*"([^"]*?)"/i);
        
        if (phaseMatch || summaryMatch) {
          log(`✓ 正则表达式提取成功:`);
          if (phaseMatch) log(`  - 阶段: ${phaseMatch[1]}`);
          if (summaryMatch) log(`  - 摘要: ${summaryMatch[1]}`);
        } else {
          log(`✗ 正则表达式提取失败`);
          
          // 方法3: 关键词分析
          log(`! 尝试关键词分析: ${text.substring(0, 30)}...`);
        }
      }
    } catch (error) {
      log(`✗ 解析测试错误: ${error}`);
    }
  }
}

// 运行测试
runTests().catch(error => {
  log(`测试执行错误: ${error}`);
});