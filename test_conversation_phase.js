/**
 * 对话阶段分析（KWLQ）测试脚本
 */
import fetch from 'node-fetch';

// 测试消息集合
const testCases = [
  {
    name: "知识获取阶段(K)",
    messages: [
      { role: "user", content: "量子计算是什么？我想了解一下这个概念" },
      { role: "assistant", content: "量子计算是一种利用量子力学原理进行计算的方式。与传统计算机使用的位（0或1）不同，量子计算机使用量子位或量子比特，它可以同时处于多个状态。这种叠加状态使量子计算机能够同时处理多种可能性，从而在某些特定问题上比传统计算机更高效。" },
      { role: "user", content: "它能解决什么样的问题？可以举例说明吗？" }
    ]
  },
  {
    name: "疑惑表达阶段(W)",
    messages: [
      { role: "user", content: "为什么量子计算这么难理解？我总是搞不清楚叠加态是什么" },
      { role: "assistant", content: "量子力学确实很反直觉，这是因为它描述的现象在我们日常经验中并不常见。叠加态简单来说，是指量子系统可以同时存在于多个状态。就像薛定谔的猫同时处于活着和死去的状态，直到我们观测它。这与经典世界中的物体只能处于一个明确状态不同。" },
      { role: "user", content: "我还是不太明白，为什么观测会导致状态崩溃？" }
    ]
  },
  {
    name: "学习深化阶段(L)",
    messages: [
      { role: "user", content: "我已经理解了基本的量子比特概念，现在想知道如何用它来实现量子算法" },
      { role: "assistant", content: "很好，量子算法是利用量子比特的特性设计的计算过程。一个经典例子是Grover搜索算法，它能在无序数据库中以平方根级的速度找到目标项。实现量子算法首先需要理解量子门操作，如Hadamard门(H)、CNOT门等，它们是量子计算的基本构建块。" },
      { role: "user", content: "我想了解如何在IBM Quantum Experience上实现一个简单的量子电路" }
    ]
  },
  {
    name: "质疑挑战阶段(Q)",
    messages: [
      { role: "user", content: "但是现实中的量子计算机真的能实现理论上的性能提升吗？我看到很多批评说它们受限于错误率和退相干问题" },
      { role: "assistant", content: "这是个很好的质疑。确实，当前的量子计算机面临噪声和退相干挑战，这限制了它们的实用性。虽然有量子纠错码和容错设计来解决这些问题，但实现足够大规模的纠错仍需时间。目前的量子计算机被称为NISQ设备（嘈杂的中等规模量子计算机），仍有很大改进空间。" },
      { role: "user", content: "那些宣称量子优势的论文是否真的证明了量子计算的优势？还是只是特定问题的人为构造？" }
    ]
  }
];

/**
 * 测试对话阶段分析功能
 */
async function testConversationPhaseAnalysis() {
  console.log("开始测试对话阶段分析 (KWLQ)...\n");
  
  for (const testCase of testCases) {
    try {
      console.log(`测试场景: ${testCase.name}`);
      
      const response = await fetch('http://localhost:5000/api/conversation-test/analyze-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: 1,
          messages: testCase.messages
        })
      });
      
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }
      
      // 获取响应内容
      const responseText = await response.text();
      console.log(`响应内容: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
      
      // 尝试解析JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`JSON解析失败: ${e.message}, 响应开头: ${responseText.substring(0, 50)}`);
      }
      
      console.log(`分析结果: 阶段=${result.currentPhase}, 摘要="${result.summary}"\n`);
    } catch (error) {
      console.error(`测试失败: ${error.message}\n`);
    }
  }
}

// 运行测试
testConversationPhaseAnalysis().catch(console.error);