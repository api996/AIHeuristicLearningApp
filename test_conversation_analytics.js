/**
 * 对话分析服务测试脚本
 * 用于调试对话分析可能存在的问题
 */

const { log } = require('./server/vite');
const { conversationAnalyticsService } = require('./server/services/conversation-analytics');

// 模拟消息数据
const mockMessages = [
  { 
    content: "我想学习机器学习，请告诉我从哪里开始?", 
    role: "user", 
    chatId: 123, 
    id: 1, 
    createdAt: new Date(), 
    model: null, 
    feedback: null, 
    isEdited: null 
  },
  { 
    content: "机器学习是一个很好的选择。你可以从Python编程基础开始，因为大多数机器学习库都是基于Python的。然后学习基本的数学概念如线性代数、统计学和微积分。接着可以尝试使用scikit-learn库进行实践，最后深入学习深度学习框架如TensorFlow或PyTorch。", 
    role: "assistant", 
    chatId: 123, 
    id: 2, 
    createdAt: new Date(), 
    model: "deep", 
    feedback: null, 
    isEdited: null 
  },
  { 
    content: "为什么我需要学习这么多数学?我只想快速实现一些模型。", 
    role: "user", 
    chatId: 123, 
    id: 3, 
    createdAt: new Date(), 
    model: null, 
    feedback: null, 
    isEdited: null 
  }
];

// 运行测试函数
async function runTest() {
  try {
    log('开始测试对话分析服务...');
    
    // 测试场景1: 对话阶段分析
    log('测试1: 对话阶段分析');
    const result = await conversationAnalyticsService.analyzeConversationPhase(123, mockMessages);
    
    if (result) {
      log(`分析结果: 阶段=${result.currentPhase}, 摘要="${result.summary}"`);
    } else {
      log('分析结果为null，可能存在错误');
    }
    
    // 测试场景2: 获取最新阶段
    log('测试2: 获取最新阶段');
    const phase = await conversationAnalyticsService.getLatestPhase(123);
    log(`获取到的最新阶段: ${phase}`);
    
  } catch (error) {
    log(`测试过程中发生错误: ${error}`);
    if (error.stack) {
      log(`错误堆栈: ${error.stack}`);
    }
  }
}

// 运行测试
runTest().then(() => {
  log('测试完成');
}).catch(err => {
  log(`测试主函数错误: ${err}`);
});