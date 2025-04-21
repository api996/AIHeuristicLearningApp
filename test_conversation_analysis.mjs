/**
 * 对话阶段分析服务测试脚本 (ES模块版本)
 * 用于测试轻量级模型的对话阶段分析功能
 */

import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

// 加载环境变量
dotenv.config();

// 测试消息
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

/**
 * 格式化对话内容
 */
function formatConversation(messages) {
  return messages.map((msg, index) => {
    const role = msg.role === "user" ? "用户" : "AI助手";
    return `[${index + 1}] ${role}: ${msg.content}`;
  }).join("\n\n");
}

/**
 * 直接调用Gemini API进行对话分析
 */
async function callGeminiForAnalysis(conversationText, isLightVersion = true) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("没有找到GEMINI_API_KEY环境变量");
    return null;
  }
  
  // 根据是否为轻量版选择不同的模型
  const model = isLightVersion 
    ? "gemini-2.0-flash" 
    : "gemini-2.5-pro-exp-03-25";
  
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
  const prompt = `
分析以下对话，确定当前对话所处的阶段并提供简短摘要。

对话阶段分类:
- K (知识获取): 用户主要在寻求基本信息和知识。用户可能提出直接问题，表现出对新知识的渴望。
- W (疑惑表达): 用户表达困惑、不确定性或对概念的难以理解。用户可能提出"为什么"、"如何"类型的问题，或表达对某个概念的困惑。
- L (学习深化): 用户正在更深入地理解概念，尝试应用知识，或探索知识间的联系。用户可能请求详细解释、示例，或尝试将新知识与先前的理解联系起来。
- Q (质疑挑战): 用户在批判性思考，质疑信息，或挑战给出的解释。用户可能提供替代观点，或指出他们认为的不一致之处。

对话内容:
${conversationText}

要求:
1. 仅基于这段对话确定当前阶段。
2. 用一个字母表示阶段: K, W, L, 或 Q
3. 提供对当前交互的简短摘要(50字以内)
4. 评估你的阶段判断的置信度(0.0-1.0)

返回JSON格式如下:
{
  "currentPhase": "字母",
  "summary": "简短摘要",
  "confidence": 数值
}
`;

  // 设置请求参数
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: isLightVersion ? 256 : 1024,
      responseMimeType: "application/json"
    }
  };
  
  // 设置超时
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超时
  
  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeout); // 清除超时
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Gemini API错误: ${response.status} - ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      console.log('API返回的响应为空');
      return null;
    }
    
    console.log('API原始响应:', responseText);
    
    // 尝试解析JSON
    try {
      const result = JSON.parse(responseText);
      return result;
    } catch (error) {
      console.log('无法解析JSON响应:', error);
      
      // 尝试匹配JSON对象
      const jsonMatch = responseText.match(/\{[\s\S]*?\}/g);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (error) {
          console.log('尝试解析匹配的JSON对象失败:', error);
        }
      }
      
      return null;
    }
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      console.log('请求超时');
    } else {
      console.log('请求失败:', error);
    }
    return null;
  }
}

/**
 * 测试对话分析功能
 */
async function testConversationAnalysis() {
  console.log('===== 开始测试对话阶段分析服务 =====');
  
  // 验证API密钥是否已设置
  console.log('\n[测试0] 验证API密钥配置');
  console.log('GEMINI_API_KEY设置状态:', process.env.GEMINI_API_KEY ? '已设置' : '未设置');
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('测试终止: 未找到GEMINI_API_KEY环境变量');
    return;
  }
  
  // 测试各个对话阶段
  try {
    // 测试K阶段
    console.log('\n[测试1] 知识获取阶段 (K):');
    const kText = formatConversation(testMessages.slice(0, 2));
    const kResult = await callGeminiForAnalysis(kText, true);
    console.log('K阶段分析结果:', kResult);
    
    // 测试W阶段
    console.log('\n[测试2] 疑惑表达阶段 (W):');
    const wText = formatConversation(testMessages.slice(2, 4));
    const wResult = await callGeminiForAnalysis(wText, true);
    console.log('W阶段分析结果:', wResult);
    
    // 测试L阶段
    console.log('\n[测试3] 学习深化阶段 (L):');
    const lText = formatConversation(testMessages.slice(4, 6));
    const lResult = await callGeminiForAnalysis(lText, true);
    console.log('L阶段分析结果:', lResult);
    
    // 测试Q阶段
    console.log('\n[测试4] 质疑挑战阶段 (Q):');
    const qText = formatConversation(testMessages.slice(6, 8));
    const qResult = await callGeminiForAnalysis(qText, true);
    console.log('Q阶段分析结果:', qResult);
    
    console.log('\n===== 对话阶段分析服务测试完成 =====');
  } catch (error) {
    console.error('测试过程出错:', error);
  }
}

// 执行测试
testConversationAnalysis();