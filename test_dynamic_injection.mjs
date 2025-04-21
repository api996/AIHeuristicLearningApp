/**
 * 对话阶段分析与动态提示词注入综合测试
 * 测试整个流程从：对话阶段分析 -> 保存阶段 -> 获取阶段 -> 提示词构建 -> 动态注入
 */

import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
dotenv.config();

// 测试会话数据
const testChats = [
  {
    id: 101,
    userId: 1,
    title: "知识获取测试",
    messages: [
      { role: "user", content: "什么是量子计算机？" },
      { role: "assistant", content: "量子计算机是利用量子力学原理进行计算的设备..." },
      { role: "user", content: "谢谢，那量子比特有什么特性？" }
    ]
  },
  {
    id: 102,
    userId: 1,
    title: "疑惑表达测试",
    messages: [
      { role: "user", content: "函数式编程是什么？" },
      { role: "assistant", content: "函数式编程是一种编程范式，它将计算视为数学函数的求值..." },
      { role: "user", content: "我不太明白纯函数的概念，为什么副作用不好？" }
    ]
  },
  {
    id: 103,
    userId: 1,
    title: "学习深化测试",
    messages: [
      { role: "user", content: "什么是神经网络？" },
      { role: "assistant", content: "神经网络是一种模拟人脑神经元连接的数学模型..." },
      { role: "user", content: "能给一个CNN在图像识别中的具体应用例子吗？我想理解卷积层如何提取特征。" }
    ]
  },
  {
    id: 104,
    userId: 1,
    title: "质疑挑战测试",
    messages: [
      { role: "user", content: "什么是气候变化？" },
      { role: "assistant", content: "气候变化是指地球气候系统的长期变化..." },
      { role: "user", content: "我看到一些报告质疑人类活动导致气候变化的观点，你对这些反对意见有什么看法？有没有证据可能不支持主流观点？" }
    ]
  }
];

// 提示词模板 - 用于测试阶段特定模板
const testPromptTemplate = {
  modelId: "gemini",
  baseTemplate: "你是一个AI学习助手。请根据用户问题提供信息。\n\n用户问题: {{user_input}}",
  kTemplate: "用户似乎处于知识获取阶段。提供清晰、详细的基础知识，确保概念解释准确完整。使用通俗易懂的语言，避免行话。",
  wTemplate: "用户似乎对概念感到困惑。耐心解释复杂概念，分解成更简单的部分。提供多种解释角度和具体例子帮助理解。回应用户的困惑点。",
  lTemplate: "用户正在深化学习。提供更深入的分析和实际应用例子。连接不同概念，指出隐含关系。鼓励批判性思考，提供进阶资源。",
  qTemplate: "用户正在质疑或挑战概念。公正地分析不同观点，展示证据和反证。承认知识的限制，鼓励健康的怀疑态度。保持开放性讨论。",
  styleTemplate: "使用友好、专业的语气。避免过于学术化的表达，保持亲切但不失权威性。段落简洁，重点突出。",
  policyTemplate: "尊重用户隐私，不记录或分享个人信息。避免政治敏感话题，不提供有害建议。"
};

// 格式化日志输出
function log(message, type = 'info') {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const prefix = `[${now}]`;
  
  let formattedMessage;
  switch (type) {
    case 'success':
      formattedMessage = `${prefix} ✓ ${message}`;
      console.log('\x1b[32m%s\x1b[0m', formattedMessage); // 绿色
      break;
    case 'error':
      formattedMessage = `${prefix} ✗ ${message}`;
      console.error('\x1b[31m%s\x1b[0m', formattedMessage); // 红色
      break;
    case 'warning':
      formattedMessage = `${prefix} ⚠ ${message}`;
      console.warn('\x1b[33m%s\x1b[0m', formattedMessage); // 黄色
      break;
    case 'step':
      formattedMessage = `${prefix} → ${message}`;
      console.log('\x1b[36m%s\x1b[0m', formattedMessage); // 青色
      break;
    default:
      formattedMessage = `${prefix} - ${message}`;
      console.log('\x1b[37m%s\x1b[0m', formattedMessage); // 白色
  }
}

// 创建测试提示词模板
async function createTestPromptTemplate() {
  try {
    log('步骤1: 准备测试环境 - 创建提示词模板', 'step');
    
    // 调用API创建提示词模板
    log('创建测试提示词模板...');
    const response = await fetch('http://localhost:5000/api/admin/prompt-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPromptTemplate)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`创建提示词模板失败: ${response.status} - ${errorText}`, 'error');
      
      // 检查是否是因为模板已存在
      if (response.status === 409 || errorText.includes('already exists')) {
        log('提示词模板已存在，将尝试更新', 'warning');
        return true;
      }
      
      return false;
    }
    
    const result = await response.json();
    log(`提示词模板创建成功: ${JSON.stringify(result)}`, 'success');
    return true;
  } catch (error) {
    log(`创建提示词模板时出错: ${error}`, 'error');
    return false;
  }
}

// 推断对话阶段并分析
async function analyzeConversation(chat) {
  try {
    log(`步骤2: 分析对话 ID:${chat.id} "${chat.title}"`, 'step');
    
    // 调用API分析对话
    log('发送对话分析请求...');
    const response = await fetch('http://localhost:5000/api/analyze-conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: chat.id,
        messages: chat.messages
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`对话分析请求失败: ${response.status} - ${errorText}`, 'error');
      return null;
    }
    
    const result = await response.json();
    log(`对话分析结果: 阶段=${result.currentPhase}, 摘要="${result.summary}"`, 'success');
    return result;
  } catch (error) {
    log(`分析对话时出错: ${error}`, 'error');
    return null;
  }
}

// 测试动态提示词构建
async function testDynamicPrompt(chat, expectedPhase) {
  try {
    log(`步骤3: 测试动态提示词构建 (期望阶段: ${expectedPhase})`, 'step');
    
    // 调用API获取动态提示词
    log('请求动态提示词...');
    const response = await fetch('http://localhost:5000/api/generate-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: 'gemini',
        chatId: chat.id,
        userInput: chat.messages[chat.messages.length - 1].content
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`获取动态提示词失败: ${response.status} - ${errorText}`, 'error');
      return null;
    }
    
    const result = await response.json();
    log('成功获取动态提示词', 'success');
    
    // 验证提示词中是否包含预期阶段的模板内容
    const promptText = result.prompt;
    let containsPhaseTemplate = false;
    let phaseName = '';
    
    switch (expectedPhase) {
      case 'K':
        containsPhaseTemplate = promptText.includes('知识获取阶段');
        phaseName = '知识获取';
        break;
      case 'W':
        containsPhaseTemplate = promptText.includes('对概念感到困惑');
        phaseName = '疑惑表达';
        break;
      case 'L':
        containsPhaseTemplate = promptText.includes('深化学习');
        phaseName = '学习深化';
        break;
      case 'Q':
        containsPhaseTemplate = promptText.includes('质疑或挑战概念');
        phaseName = '质疑挑战';
        break;
    }
    
    if (containsPhaseTemplate) {
      log(`✓ 提示词成功包含${phaseName}阶段(${expectedPhase})的专门指导`, 'success');
    } else {
      log(`✗ 提示词中未找到${phaseName}阶段(${expectedPhase})的相关内容`, 'error');
    }
    
    // 验证提示词包含其他必要部分
    const hasBaseTemplate = promptText.includes('AI学习助手');
    const hasStyleTemplate = promptText.includes('友好、专业的语气');
    const hasPolicyTemplate = promptText.includes('尊重用户隐私');
    
    log(`基础模板: ${hasBaseTemplate ? '已包含 ✓' : '未包含 ✗'}`);
    log(`样式模板: ${hasStyleTemplate ? '已包含 ✓' : '未包含 ✗'}`);
    log(`政策模板: ${hasPolicyTemplate ? '已包含 ✓' : '未包含 ✗'}`);
    
    // 验证用户输入是否包含在提示词中
    const hasUserInput = promptText.includes(chat.messages[chat.messages.length - 1].content);
    log(`用户输入: ${hasUserInput ? '已包含 ✓' : '未包含 ✗'}`);
    
    return {
      success: containsPhaseTemplate && hasBaseTemplate,
      prompt: promptText
    };
  } catch (error) {
    log(`测试动态提示词时出错: ${error}`, 'error');
    return null;
  }
}

// 运行综合测试
async function runIntegrationTest() {
  log('===== 开始对话阶段分析与动态提示词注入综合测试 =====', 'step');
  
  // 准备测试环境
  const environmentReady = await createTestPromptTemplate();
  if (!environmentReady) {
    log('无法准备测试环境，测试中止', 'error');
    return;
  }
  
  // 对每个测试会话运行测试
  const results = [];
  
  for (const chat of testChats) {
    log(`\n----- 测试会话: ${chat.title} (ID: ${chat.id}) -----`);
    
    // 预期的对话阶段
    let expectedPhase;
    if (chat.title.includes('知识获取')) expectedPhase = 'K';
    else if (chat.title.includes('疑惑表达')) expectedPhase = 'W';
    else if (chat.title.includes('学习深化')) expectedPhase = 'L';
    else if (chat.title.includes('质疑挑战')) expectedPhase = 'Q';
    
    // 分析对话
    const analysisResult = await analyzeConversation(chat);
    if (!analysisResult) {
      log(`会话 "${chat.title}" 分析失败，跳过后续测试`, 'error');
      results.push({
        title: chat.title,
        phase: expectedPhase,
        analysisSuccess: false,
        promptSuccess: false,
        phaseMatch: false
      });
      continue;
    }
    
    // 测试动态提示词生成
    const promptResult = await testDynamicPrompt(chat, analysisResult.currentPhase);
    if (!promptResult) {
      log(`会话 "${chat.title}" 提示词生成失败`, 'error');
      results.push({
        title: chat.title,
        phase: expectedPhase,
        detectedPhase: analysisResult.currentPhase,
        analysisSuccess: true,
        promptSuccess: false,
        phaseMatch: analysisResult.currentPhase === expectedPhase
      });
      continue;
    }
    
    // 保存结果
    results.push({
      title: chat.title,
      phase: expectedPhase,
      detectedPhase: analysisResult.currentPhase,
      analysisSuccess: true,
      promptSuccess: promptResult.success,
      phaseMatch: analysisResult.currentPhase === expectedPhase
    });
    
    // 如果需要，保存提示词到文件以供分析
    const dir = './test_results';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filename = `${dir}/prompt_${chat.id}_${analysisResult.currentPhase}.txt`;
    fs.writeFileSync(filename, promptResult.prompt);
    log(`提示词已保存到文件: ${filename}`, 'info');
  }
  
  // 打印汇总结果
  log('\n===== 测试结果汇总 =====', 'step');
  let successCount = 0;
  
  for (const result of results) {
    const status = result.analysisSuccess && result.promptSuccess && result.phaseMatch;
    if (status) successCount++;
    
    log(`${status ? '✓' : '✗'} ${result.title}:`, status ? 'success' : 'error');
    log(`  预期阶段: ${result.phase}, 检测阶段: ${result.detectedPhase || '未检测'}`);
    log(`  阶段分析: ${result.analysisSuccess ? '成功' : '失败'}`);
    log(`  提示词生成: ${result.promptSuccess ? '成功' : '失败'}`);
    log(`  阶段匹配: ${result.phaseMatch ? '匹配' : '不匹配'}`);
  }
  
  const successRate = (successCount / results.length) * 100;
  log(`\n总体成功率: ${successCount}/${results.length} (${successRate.toFixed(2)}%)`, 
      successRate >= 75 ? 'success' : successRate >= 50 ? 'warning' : 'error');
  
  log('\n===== 测试完成 =====', 'step');
}

// 执行测试
runIntegrationTest();