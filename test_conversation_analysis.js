/**
 * 对话阶段分析服务测试脚本
 * 用于测试轻量级模型的对话阶段分析功能
 */

const { conversationAnalyticsService } = require('./server/services/conversation-analytics');
const { ConversationAnalyticsLightService } = require('./server/services/conversation-analytics-light');

// 创建测试消息
const testMessages = [
  // K阶段测试 - 知识获取
  {
    role: 'user',
    content: '请介绍一下人工智能的基础知识'
  },
  {
    role: 'assistant',
    content: '人工智能是计算机科学的一个分支，致力于创造能够模拟人类智能行为的系统。基础知识包括机器学习、神经网络、自然语言处理等。'
  },
  
  // W阶段测试 - 疑惑表达
  {
    role: 'user',
    content: '我不太理解为什么神经网络被称为"神经"网络，它真的和人脑有关系吗？这个概念让我有点困惑。'
  },
  {
    role: 'assistant',
    content: '您的困惑很合理。神经网络之所以叫这个名字，是因为它的结构受到了人类大脑神经元连接方式的启发，但实际上它是一个数学模型，并不真正模拟生物神经元的所有特性。'
  },
  
  // L阶段测试 - 学习深化
  {
    role: 'user',
    content: '我已经了解了基本概念，现在我想更深入地理解反向传播算法是如何工作的。你能给我举个具体例子吗？'
  },
  {
    role: 'assistant',
    content: '反向传播算法是神经网络学习的核心。让我通过一个简单的例子来解释...'
  },
  
  // Q阶段测试 - 质疑挑战
  {
    role: 'user',
    content: '我不认同AI会达到通用智能的观点。现有的模型只是在统计模式上做文章，缺乏真正的理解能力和意识。你怎么看？'
  },
  {
    role: 'assistant',
    content: '这是一个很好的批判性思考。关于AI是否能达到通用智能，确实存在不同观点...'
  }
];

// 测试不同阶段的会话
async function testConversationAnalysis() {
  console.log('===== 开始测试对话阶段分析服务 =====');
  
  try {
    // 测试标准服务
    console.log('\n[测试1] 使用标准对话分析服务');
    const standardResult = await conversationAnalyticsService.analyzeConversationPhase(
      9999, // 测试ID
      testMessages.slice(0, 2) // K阶段测试
    );
    console.log('标准服务分析结果:', standardResult);
    
    // 测试轻量级服务
    console.log('\n[测试2] 使用轻量级对话分析服务');
    const lightService = new ConversationAnalyticsLightService();
    
    // 测试K阶段
    console.log('\n测试知识获取阶段 (K):');
    const kResult = await lightService.analyzeConversationPhase(
      9999,
      testMessages.slice(0, 2)
    );
    console.log('K阶段分析结果:', kResult);
    
    // 测试W阶段
    console.log('\n测试疑惑表达阶段 (W):');
    const wResult = await lightService.analyzeConversationPhase(
      9999,
      testMessages.slice(2, 4)
    );
    console.log('W阶段分析结果:', wResult);
    
    // 测试L阶段
    console.log('\n测试学习深化阶段 (L):');
    const lResult = await lightService.analyzeConversationPhase(
      9999,
      testMessages.slice(4, 6)
    );
    console.log('L阶段分析结果:', lResult);
    
    // 测试Q阶段
    console.log('\n测试质疑挑战阶段 (Q):');
    const qResult = await lightService.analyzeConversationPhase(
      9999,
      testMessages.slice(6, 8)
    );
    console.log('Q阶段分析结果:', qResult);
    
    // 验证API密钥是否已设置
    console.log('\n[测试3] 验证API密钥配置');
    console.log('GEMINI_API_KEY设置状态:', !!process.env.GEMINI_API_KEY ? '已设置' : '未设置');
    
    console.log('\n===== 对话阶段分析服务测试完成 =====');
  } catch (error) {
    console.error('测试过程出错:', error);
  }
}

// 执行测试
testConversationAnalysis();