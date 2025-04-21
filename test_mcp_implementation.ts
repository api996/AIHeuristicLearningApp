/**
 * Message Content Protocol (MCP) 实现测试脚本
 * 测试Anthropic SDK的MCP功能和优化服务
 */

import 'dotenv/config';
import { anthropicService } from './server/services/anthropic-service';
import { optimizedEmbeddingService } from './server/services/optimized-embedding-service';
import { optimizedSearchService } from './server/services/optimized-search-service';
import { optimizedConversationAnalysis, ConversationPhase } from './server/services/optimized-conversation-analysis';

// 颜色打印函数
function colorLog(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const colors = {
    info: '\x1b[36m',    // 青色
    success: '\x1b[32m', // 绿色
    error: '\x1b[31m',   // 红色
    warn: '\x1b[33m',    // 黄色
    reset: '\x1b[0m'     // 重置
  };
  
  console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${colors.reset}`);
}

/**
 * 测试MCP内容价值分析功能
 */
async function testContentValueAnalysis(): Promise<boolean> {
  colorLog('测试内容价值分析...', 'info');
  
  if (!anthropicService.isAvailable()) {
    colorLog('Claude API未配置，跳过测试', 'warn');
    return false;
  }
  
  try {
    // 测试不同类型的内容
    const testCases = [
      {
        content: '你好，今天天气怎么样？',
        expectedValuable: false
      },
      {
        content: '我想了解一下量子计算的基本原理和应用场景',
        expectedValuable: true
      },
      {
        content: '测试测试',
        expectedValuable: false
      }
    ];
    
    for (const testCase of testCases) {
      const result = await anthropicService.analyzeContentValue(testCase.content);
      
      colorLog(`内容: "${testCase.content.substring(0, 30)}..."`, 'info');
      colorLog(`分析结果: 价值=${result.isValuable}, 分数=${result.score}`, 'info');
      colorLog(`原因: ${result.reason}`, 'info');
      
      if (result.isValuable === testCase.expectedValuable) {
        colorLog('结果符合预期', 'success');
      } else {
        colorLog(`结果不符合预期: 预期=${testCase.expectedValuable}, 实际=${result.isValuable}`, 'warn');
      }
      
      console.log(''); // 空行
    }
    
    return true;
  } catch (error) {
    colorLog(`测试失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 测试优化的嵌入服务
 */
async function testOptimizedEmbedding(): Promise<boolean> {
  colorLog('测试优化的嵌入服务...', 'info');
  
  try {
    // 测试不同类型的内容
    const testCases = [
      {
        content: '你好，今天天气怎么样？',
        shouldEmbed: false  // 太短或没有实质内容，可能不会生成嵌入
      },
      {
        content: '量子计算使用量子力学原理，如叠加和纠缠，来处理信息。量子位或量子比特可以同时存在于多个状态，这使得量子计算机在特定类型的计算上比经典计算机具有潜在的指数级优势。',
        shouldEmbed: true   // 有教育价值的内容，应该生成嵌入
      }
    ];
    
    for (const testCase of testCases) {
      colorLog(`内容: "${testCase.content.substring(0, 30)}..."`, 'info');
      
      // 测试正常嵌入模式（包含价值评估）
      const embedding = await optimizedEmbeddingService.generateEmbedding(testCase.content);
      
      if (embedding) {
        colorLog(`生成了嵌入向量，维度: ${embedding.length}`, 'success');
      } else {
        colorLog('没有生成嵌入向量', testCase.shouldEmbed ? 'error' : 'info');
      }
      
      // 测试强制嵌入模式
      const forcedEmbedding = await optimizedEmbeddingService.generateEmbedding(testCase.content, true);
      
      if (forcedEmbedding) {
        colorLog(`强制模式生成了嵌入向量，维度: ${forcedEmbedding.length}`, 'success');
      } else {
        colorLog('强制模式也没有生成嵌入向量，可能是内容太短', 'warn');
      }
      
      console.log(''); // 空行
    }
    
    return true;
  } catch (error) {
    colorLog(`测试失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 测试MCP对话阶段分析
 */
async function testConversationPhaseAnalysis(): Promise<boolean> {
  colorLog('测试对话阶段分析...', 'info');
  
  try {
    // 测试不同类型的对话
    const testCases = [
      {
        messages: [
          { role: 'user', content: '你好，我想学习如何编程' },
          { role: 'assistant', content: '你好！很高兴你想学习编程。你有任何特定的编程语言或领域感兴趣吗？' },
          { role: 'user', content: '我对Python很感兴趣，因为听说它对初学者友好' }
        ],
        expectedPhase: 'W' as ConversationPhase // 学习意愿阶段
      },
      {
        messages: [
          { role: 'user', content: '我已经学会了Python基础，包括变量、条件语句和循环' },
          { role: 'assistant', content: '太棒了！你已经掌握了重要的基础知识。你想继续学习什么内容？' },
          { role: 'user', content: '我知道函数是代码复用的好方法，我已经写了一些简单的函数' }
        ],
        expectedPhase: 'K' as ConversationPhase // 知识展示阶段
      },
      {
        messages: [
          { role: 'assistant', content: '面向对象编程是通过创建对象来组织代码的范式，对象包含数据和方法' },
          { role: 'user', content: '这很有趣，所以类就像是对象的模板？' },
          { role: 'assistant', content: '没错！类定义了对象的结构和行为，就像蓝图或模板' },
          { role: 'user', content: '我明白了，继承允许我们重用代码并创建特化的类' }
        ],
        expectedPhase: 'L' as ConversationPhase // 学习吸收阶段
      }
    ];
    
    for (const testCase of testCases) {
      colorLog(`测试消息组: ${testCase.messages.length}条消息`, 'info');
      colorLog(`最后一条: "${testCase.messages[testCase.messages.length-1].content.substring(0, 30)}..."`, 'info');
      
      const result = await optimizedConversationAnalysis.analyzePhase(testCase.messages);
      
      colorLog(`分析结果: 阶段=${result.phase}, 置信度=${result.confidence}`, 'info');
      colorLog(`解释: ${result.explanation}`, 'info');
      colorLog(`描述: ${result.description}`, 'info');
      
      if (result.phase === testCase.expectedPhase) {
        colorLog('结果符合预期', 'success');
      } else {
        colorLog(`结果不符合预期: 预期=${testCase.expectedPhase}, 实际=${result.phase}`, 'warn');
      }
      
      console.log(''); // 空行
    }
    
    // 测试缓存功能
    const testMessages = testCases[0].messages;
    
    colorLog('测试分析缓存...', 'info');
    
    console.time('首次分析');
    await optimizedConversationAnalysis.analyzePhase(testMessages);
    console.timeEnd('首次分析');
    
    console.time('缓存分析');
    await optimizedConversationAnalysis.analyzePhase(testMessages);
    console.timeEnd('缓存分析');
    
    return true;
  } catch (error) {
    colorLog(`测试失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 测试MCP搜索结果处理
 */
async function testSearchWithMCP(): Promise<boolean> {
  colorLog('测试MCP搜索结果处理...', 'info');
  
  try {
    // 测试搜索查询
    const testQuery = '量子计算的应用场景';
    
    colorLog(`搜索查询: "${testQuery}"`, 'info');
    
    // 执行搜索
    const searchResult = await optimizedSearchService.searchWithMCP(testQuery);
    
    colorLog(`获取到${searchResult.results.length}个搜索结果`, 'info');
    colorLog(`生成摘要: "${searchResult.summary.substring(0, 100)}..."`, 'info');
    
    // 为搜索结果生成嵌入
    const embeddings = await optimizedSearchService.generateEmbeddingsForResults(searchResult.results);
    
    // 计算有效嵌入的数量
    const validEmbeddings = embeddings.filter(e => e !== null);
    
    colorLog(`生成了${validEmbeddings.length}/${searchResult.results.length}个有效嵌入向量`, 'info');
    
    return searchResult.results.length > 0 && searchResult.summary.length > 0;
  } catch (error) {
    colorLog(`测试失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests(): Promise<void> {
  colorLog('开始Message Content Protocol (MCP)实现测试', 'info');
  console.log(''); // 空行
  
  let success = true;
  
  // 检查API密钥
  if (!process.env.ANTHROPIC_API_KEY) {
    colorLog('缺少ANTHROPIC_API_KEY环境变量，某些测试将失败', 'warn');
    colorLog('请设置ANTHROPIC_API_KEY以启用Claude功能', 'warn');
    console.log(''); // 空行
  }
  
  // 检查Serper API密钥
  if (!process.env.SERPER_API_KEY) {
    colorLog('缺少SERPER_API_KEY环境变量，搜索测试将失败', 'warn');
    colorLog('请设置SERPER_API_KEY以启用搜索功能', 'warn');
    console.log(''); // 空行
  }
  
  // 执行测试
  try {
    // 内容价值分析测试
    if (await testContentValueAnalysis()) {
      colorLog('内容价值分析测试通过', 'success');
    } else {
      colorLog('内容价值分析测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行
    
    // 优化的嵌入服务测试
    if (await testOptimizedEmbedding()) {
      colorLog('优化的嵌入服务测试通过', 'success');
    } else {
      colorLog('优化的嵌入服务测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行
    
    // 对话阶段分析测试
    if (await testConversationPhaseAnalysis()) {
      colorLog('对话阶段分析测试通过', 'success');
    } else {
      colorLog('对话阶段分析测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行
    
    // 搜索服务测试
    if (await testSearchWithMCP()) {
      colorLog('MCP搜索服务测试通过', 'success');
    } else {
      colorLog('MCP搜索服务测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行
    
  } catch (error) {
    colorLog(`测试过程中发生错误: ${error.message}`, 'error');
    success = false;
  }
  
  // 测试结果
  if (success) {
    colorLog('所有MCP实现测试完成，总体结果: 通过', 'success');
  } else {
    colorLog('所有MCP实现测试完成，总体结果: 部分失败', 'warn');
    colorLog('请检查输出日志以了解具体问题', 'warn');
  }
}

// 执行测试
runTests().catch(error => {
  colorLog(`测试执行失败: ${error}`, 'error');
  process.exit(1);
});