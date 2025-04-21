/**
 * 测试增强版网络搜索服务脚本
 * 测试MCP优化后的搜索功能
 */

import 'dotenv/config';
import { webSearchService } from './server/services/web-search';

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
 * 测试标准搜索功能
 */
async function testStandardSearch(): Promise<boolean> {
  colorLog('测试标准搜索功能...', 'info');
  
  try {
    const testQueries = [
      '量子计算的基本原理',
      '人工智能在教育中的应用'
    ];
    
    for (const query of testQueries) {
      colorLog(`执行标准搜索: "${query}"`, 'info');
      
      console.time('标准搜索');
      const results = await webSearchService.search(query);
      console.timeEnd('标准搜索');
      
      if (results && results.length > 0) {
        colorLog(`搜索成功，获取到 ${results.length} 条结果`, 'success');
        
        // 显示前2条结果
        for (let i = 0; i < Math.min(2, results.length); i++) {
          const result = results[i];
          colorLog(`- ${result.title}`, 'info');
          colorLog(`  ${result.snippet.substring(0, 100)}...`, 'info');
        }
        
        // 测试格式化
        const formatted = webSearchService.formatSearchContext(results);
        colorLog(`格式化为提示词上下文，长度: ${formatted.length} 字符`, 'info');
      } else {
        colorLog('搜索未返回结果', 'warn');
      }
      
      console.log(''); // 空行分隔
    }
    
    return true;
  } catch (error) {
    colorLog(`标准搜索测试错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}

/**
 * 测试MCP增强搜索功能
 */
async function testMCPSearch(): Promise<boolean> {
  colorLog('测试MCP增强搜索功能...', 'info');
  
  try {
    const testQueries = [
      '机器学习算法比较',
      '气候变化的影响和解决方案'
    ];
    
    for (const query of testQueries) {
      colorLog(`执行MCP搜索: "${query}"`, 'info');
      
      console.time('MCP搜索');
      const result = await webSearchService.searchWithMCP(query);
      console.timeEnd('MCP搜索');
      
      if (result) {
        colorLog('MCP搜索成功', 'success');
        colorLog(`摘要: ${result.summary}`, 'info');
        colorLog(`相关性评分: ${result.relevance}/10`, 'info');
        
        // 显示关键点
        colorLog('关键信息点:', 'info');
        result.keyPoints.forEach((point, index) => {
          colorLog(`  ${index + 1}. ${point}`, 'info');
        });
        
        // 显示来源数量
        colorLog(`信息来源: ${result.sources.length} 个`, 'info');
        
        // 测试MCP格式化
        const formatted = webSearchService.formatMCPSearchContext(result);
        colorLog(`MCP格式化为提示词上下文，长度: ${formatted.length} 字符`, 'info');
        
        // 测试缓存
        colorLog('测试MCP缓存...', 'info');
        console.time('MCP缓存');
        await webSearchService.searchWithMCP(query);
        console.timeEnd('MCP缓存');
      } else {
        colorLog('MCP搜索未返回结果', 'warn');
      }
      
      console.log(''); // 空行分隔
    }
    
    return true;
  } catch (error) {
    colorLog(`MCP搜索测试错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}

/**
 * 测试内容价值评估功能
 */
async function testContentValueAssessment(): Promise<boolean> {
  colorLog('测试内容价值评估功能...', 'info');
  
  try {
    // 使用内部方法测试内容价值评估
    // 需要调用实例的私有方法，这里只测试公开方法
    const testContents = [
      '你好，请问今天天气怎么样？',
      '量子计算利用量子力学原理，如量子比特的叠加和纠缠状态，进行计算。',
      '嗯，好的。',
      '深度学习是机器学习的一种方法，通过多层神经网络学习数据表示。'
    ];
    
    for (const content of testContents) {
      colorLog(`评估内容: "${content}"`, 'info');
      
      console.time('内容评估');
      const shouldVectorize = await webSearchService.shouldVectorize(content);
      console.timeEnd('内容评估');
      
      if (shouldVectorize) {
        colorLog('内容被评估为有价值，应该向量化', 'success');
      } else {
        colorLog('内容被评估为无价值，不应向量化', 'info');
      }
      
      console.log(''); // 空行分隔
    }
    
    return true;
  } catch (error) {
    colorLog(`内容价值评估测试错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests(): Promise<void> {
  colorLog('开始测试增强版网络搜索服务 (MCP实现)', 'info');
  console.log(''); // 空行分隔
  
  let success = true;
  
  try {
    // 测试标准搜索
    if (await testStandardSearch()) {
      colorLog('标准搜索测试通过', 'success');
    } else {
      colorLog('标准搜索测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行分隔
    
    // 测试MCP搜索
    if (await testMCPSearch()) {
      colorLog('MCP搜索测试通过', 'success');
    } else {
      colorLog('MCP搜索测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行分隔
    
    // 测试内容价值评估
    if (await testContentValueAssessment()) {
      colorLog('内容价值评估测试通过', 'success');
    } else {
      colorLog('内容价值评估测试未完全通过', 'warn');
      success = false;
    }
    console.log(''); // 空行分隔
  } catch (error) {
    colorLog(`测试过程中发生错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
    success = false;
  }
  
  // 测试结论
  if (success) {
    colorLog('所有测试完成，总体结果: 通过', 'success');
  } else {
    colorLog('所有测试完成，总体结果: 部分失败', 'warn');
  }
}

// 检查API密钥并执行测试
if (!process.env.SERPER_API_KEY) {
  colorLog('错误: 未设置 SERPER_API_KEY 环境变量，无法执行搜索测试', 'error');
} else if (!process.env.GEMINI_API_KEY) {
  colorLog('错误: 未设置 GEMINI_API_KEY 环境变量，MCP功能将不可用', 'error');
} else {
  // 执行测试
  runTests().catch(err => {
    colorLog(`测试运行错误: ${err}`, 'error');
  });
}