/**
 * Gemini MCP (Message Content Protocol) 测试脚本
 * 测试结构化内容处理、内容价值分析和优化的嵌入服务
 */

import 'dotenv/config';
import { geminiMCPSearchService } from './server/services/gemini-mcp-search';
import { contentValueAnalyzer } from './server/services/content-value-analyzer';
import { optimizedEmbeddingsService } from './server/services/learning/optimized-embeddings';

/**
 * 颜色打印函数
 */
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
 * 测试Gemini MCP搜索
 */
async function testMCPSearch(): Promise<boolean> {
  colorLog('测试MCP搜索服务...', 'info');
  
  try {
    // 测试搜索查询
    const testQueries = [
      '量子计算的应用',
      '人工智能在教育中的作用',
      '如何有效进行自主学习'
    ];
    
    for (const query of testQueries) {
      colorLog(`执行搜索: "${query}"`, 'info');
      
      console.time('MCP搜索');
      const result = await geminiMCPSearchService.searchWithMCP(query);
      console.timeEnd('MCP搜索');
      
      if (result) {
        colorLog('搜索成功:', 'success');
        colorLog(`摘要: ${result.summary.substring(0, 100)}...`, 'info');
        colorLog(`相关性: ${result.relevance}/10`, 'info');
        colorLog(`关键点: ${result.keyPoints.length}个`, 'info');
        colorLog(`来源: ${result.sources.length}个`, 'info');
      } else {
        colorLog('搜索失败或无结果', 'error');
      }
      
      // 测试缓存
      if (result) {
        colorLog('测试搜索缓存...', 'info');
        
        console.time('缓存搜索');
        const cachedResult = await geminiMCPSearchService.searchWithMCP(query);
        console.timeEnd('缓存搜索');
        
        if (cachedResult) {
          colorLog('缓存命中成功', 'success');
        }
      }
      
      console.log(''); // 空行
    }
    
    return true;
  } catch (error) {
    colorLog(`MCP搜索测试错误: ${error}`, 'error');
    return false;
  }
}

/**
 * 测试内容价值分析
 */
async function testContentValueAnalysis(): Promise<boolean> {
  colorLog('测试内容价值分析服务...', 'info');
  
  try {
    // 测试不同类型的内容
    const testContents = [
      {
        content: '你好，请问今天天气怎么样？',
        expected: false
      },
      {
        content: '量子计算利用量子力学原理，如量子比特的叠加和纠缠状态，来进行计算。这种方法对于特定类问题，如大数分解、搜索和优化问题，可能比经典计算机更有效率。',
        expected: true
      },
      {
        content: 'OK',
        expected: false
      },
      {
        content: '希望能学习更多关于深度学习的知识，特别是卷积神经网络在图像识别中的应用。',
        expected: true
      }
    ];
    
    for (const test of testContents) {
      colorLog(`分析内容: "${test.content.substring(0, 50)}${test.content.length > 50 ? '...' : ''}"`, 'info');
      
      const analysis = await contentValueAnalyzer.analyzeContentValue(test.content);
      
      colorLog(`分析结果: 有价值=${analysis.isValuable}, 分数=${analysis.score.toFixed(2)}`, analysis.isValuable ? 'success' : 'info');
      colorLog(`原因: ${analysis.reason}`, 'info');
      
      // 验证结果
      if (analysis.isValuable === test.expected) {
        colorLog('结果符合预期', 'success');
      } else {
        colorLog(`结果不符合预期: 预期=${test.expected}, 实际=${analysis.isValuable}`, 'warn');
      }
      
      // 测试是否应生成嵌入
      const shouldEmbed = await contentValueAnalyzer.shouldGenerateEmbedding(test.content);
      colorLog(`是否生成嵌入: ${shouldEmbed}`, shouldEmbed ? 'success' : 'info');
      
      console.log(''); // 空行
    }
    
    // 测试缓存
    const testContent = '量子计算利用量子力学原理进行计算';
    colorLog('测试内容价值分析缓存...', 'info');
    
    console.time('首次分析');
    await contentValueAnalyzer.analyzeContentValue(testContent);
    console.timeEnd('首次分析');
    
    console.time('缓存分析');
    await contentValueAnalyzer.analyzeContentValue(testContent);
    console.timeEnd('缓存分析');
    
    return true;
  } catch (error) {
    colorLog(`内容价值分析测试错误: ${error}`, 'error');
    return false;
  }
}

/**
 * 测试优化的嵌入服务
 */
async function testOptimizedEmbeddings(): Promise<boolean> {
  colorLog('测试优化的嵌入服务...', 'info');
  
  try {
    // 测试不同类型的内容
    const testContents = [
      '你好, 测试',
      '量子计算是一种利用量子力学原理进行计算的计算机技术。它使用量子比特或量子位进行信息处理，这些量子比特可以同时处于多个状态，从而实现并行计算。量子计算机有望在某些特定问题上比传统计算机表现出指数级的速度优势。',
      '提醒我明天去买牛奶',
      '深度学习是机器学习的一个分支，它使用多层神经网络来模拟人脑的学习过程。深度学习已在图像识别、自然语言处理和游戏等领域取得了重大突破。'
    ];
    
    for (const content of testContents) {
      colorLog(`生成嵌入: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`, 'info');
      
      // 测试预筛选情况下的嵌入生成
      console.time('预筛选嵌入');
      const embedding = await optimizedEmbeddingsService.generateEmbedding(content);
      console.timeEnd('预筛选嵌入');
      
      if (embedding) {
        colorLog(`嵌入生成成功: ${embedding.length}维向量`, 'success');
      } else {
        colorLog('嵌入未生成，可能是内容未通过价值评估', 'info');
      }
      
      // 测试强制嵌入生成
      console.time('强制嵌入');
      const forcedEmbedding = await optimizedEmbeddingsService.generateEmbedding(content, true);
      console.timeEnd('强制嵌入');
      
      if (forcedEmbedding) {
        colorLog(`强制嵌入生成成功: ${forcedEmbedding.length}维向量`, 'success');
      } else {
        colorLog('强制嵌入生成失败', 'error');
      }
      
      console.log(''); // 空行
    }
    
    // 测试嵌入缓存
    const testContent = '机器学习是人工智能的一个子领域';
    colorLog('测试嵌入向量缓存...', 'info');
    
    // 先强制生成嵌入
    await optimizedEmbeddingsService.generateEmbedding(testContent, true);
    
    console.time('缓存嵌入');
    const cachedEmbedding = await optimizedEmbeddingsService.generateEmbedding(testContent);
    console.timeEnd('缓存嵌入');
    
    if (cachedEmbedding) {
      colorLog('缓存嵌入获取成功', 'success');
    }
    
    return true;
  } catch (error) {
    colorLog(`优化的嵌入服务测试错误: ${error}`, 'error');
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests(): Promise<void> {
  colorLog('开始Gemini MCP实现测试', 'info');
  console.log(''); // 空行
  
  let success = true;
  
  // 检查API密钥
  if (!process.env.GEMINI_API_KEY) {
    colorLog('缺少GEMINI_API_KEY环境变量，测试将失败', 'error');
    return;
  }
  
  try {
    // 测试MCP搜索
    if (await testMCPSearch()) {
      colorLog('MCP搜索测试通过', 'success');
    } else {
      colorLog('MCP搜索测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行
    
    // 测试内容价值分析
    if (await testContentValueAnalysis()) {
      colorLog('内容价值分析测试通过', 'success');
    } else {
      colorLog('内容价值分析测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行
    
    // 测试优化的嵌入服务
    if (await testOptimizedEmbeddings()) {
      colorLog('优化的嵌入服务测试通过', 'success');
    } else {
      colorLog('优化的嵌入服务测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行
  } catch (error) {
    colorLog(`测试过程中发生错误: ${error}`, 'error');
    success = false;
  }
  
  // 测试结论
  if (success) {
    colorLog('所有Gemini MCP实现测试完成，总体结果: 通过', 'success');
  } else {
    colorLog('所有Gemini MCP实现测试完成，总体结果: 部分失败', 'warn');
  }
}

// 执行测试
runTests().catch(err => {
  colorLog(`测试运行错误: ${err}`, 'error');
});