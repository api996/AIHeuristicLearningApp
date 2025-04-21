/**
 * 测试对话分析服务
 * 用于测试修复后的对话分析API
 */

import fetch from 'node-fetch';

// 测试数据 - 三种不同类型的对话
const testCases = [
  {
    name: "知识获取阶段 (K)",
    chatId: 101,
    messages: [
      { 
        role: "user", 
        content: "什么是量子力学中的波函数？" 
      },
      { 
        role: "assistant", 
        content: "波函数是描述量子系统状态的数学函数，通常用希腊字母 ψ 表示。它包含了关于粒子所有可能位置、动量等物理量的概率信息。波函数的平方给出了在特定位置找到粒子的概率密度。" 
      },
      { 
        role: "user", 
        content: "量子计算中的量子比特是什么？" 
      }
    ]
  },
  {
    name: "疑惑表达阶段 (W)",
    chatId: 102,
    messages: [
      { 
        role: "user", 
        content: "我不理解为什么测量会导致波函数坍缩？" 
      },
      { 
        role: "assistant", 
        content: "这是量子力学的核心之一：测量行为本身会影响量子系统。在测量前，量子系统处于多种可能状态的叠加，测量迫使系统「选择」一个确定状态，这就是所谓的波函数坍缩。" 
      },
      { 
        role: "user", 
        content: "这太奇怪了，为什么我们观察某物会改变它的性质？这与经典物理学完全不同。" 
      }
    ]
  },
  {
    name: "学习深化阶段 (L)",
    chatId: 103,
    messages: [
      { 
        role: "user", 
        content: "我想深入理解量子纠缠。如果两个粒子纠缠，那么它们之间的通信是如何工作的？" 
      },
      { 
        role: "assistant", 
        content: "量子纠缠中，两个粒子不是通过经典意义上的「通信」来保持关联的。它们形成了一个不可分割的量子系统，无论相距多远，测量一个粒子会立即影响另一个粒子的状态，这种现象被称为「超距作用」。" 
      },
      { 
        role: "user", 
        content: "我们能利用量子纠缠来传递信息吗？比如用于加密通信？" 
      }
    ]
  },
  {
    name: "质疑挑战阶段 (Q)",
    chatId: 104,
    messages: [
      { 
        role: "user", 
        content: "我读到有些物理学家质疑量子力学的哥本哈根诠释。难道量子力学还有其他解释吗？" 
      },
      { 
        role: "assistant", 
        content: "确实有多种诠释，包括多世界诠释、德布罗意-玻姆诠释、关系量子力学等。这些理论在数学上等价，但在哲学上提供了不同的理解框架。" 
      },
      { 
        role: "user", 
        content: "如果这些理论在数学上等价，怎么判断哪个是正确的？科学应该给我们确定的答案，而不是多种可能性。" 
      }
    ]
  }
];

// 格式化输出
function colorLog(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    error: '\x1b[31m%s\x1b[0m',    // 红色
    warning: '\x1b[33m%s\x1b[0m',  // 黄色
  };
  console.log(colors[type], message);
}

// 测试对话分析API
async function testConversationAnalysis() {
  colorLog('开始测试对话分析服务...', 'info');
  colorLog('使用修正后的模型: gemini-1.5-pro-latest', 'info');
  
  for (const testCase of testCases) {
    try {
      colorLog(`\n测试案例: ${testCase.name}`, 'info');
      colorLog(`发送消息数: ${testCase.messages.length}`, 'info');
      
      const response = await fetch('http://localhost:5000/api/conversation-test/analyze-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: testCase.chatId,
          messages: testCase.messages
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        colorLog(`API请求失败 (${response.status}): ${errorText}`, 'error');
        continue;
      }
      
      const result = await response.json();
      colorLog(`分析结果: 阶段=${result.currentPhase}, 摘要="${result.summary}", 置信度=${result.confidence}`, 'success');
      
      // 验证结果
      if (testCase.name.includes('(K)') && result.currentPhase === 'K') {
        colorLog('✓ 正确识别为知识获取阶段', 'success');
      } else if (testCase.name.includes('(W)') && result.currentPhase === 'W') {
        colorLog('✓ 正确识别为疑惑表达阶段', 'success');
      } else if (testCase.name.includes('(L)') && result.currentPhase === 'L') {
        colorLog('✓ 正确识别为学习深化阶段', 'success');
      } else if (testCase.name.includes('(Q)') && result.currentPhase === 'Q') {
        colorLog('✓ 正确识别为质疑挑战阶段', 'success');
      } else {
        colorLog(`⚠ 阶段识别可能不准确: 期望 ${testCase.name.slice(-2, -1)}, 实际 ${result.currentPhase}`, 'warning');
      }
      
    } catch (error) {
      colorLog(`测试出错: ${error.message}`, 'error');
    }
  }
  
  colorLog('\n对话分析API测试完成', 'info');
}

// 运行测试
testConversationAnalysis();