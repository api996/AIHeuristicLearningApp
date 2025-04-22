/**
 * 搜索质量评估测试脚本
 * 测试优化后的搜索结果质量评估功能
 */

import { webSearchService } from './server/services/web-search.ts';

// 控制台彩色输出
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  console.log(colors[type], message);
}

/**
 * 测试搜索结果来源质量评估
 */
async function testSourceQualityEvaluation() {
  log('====== 测试搜索结果来源质量评估 ======', 'info');
  
  // 定义测试查询
  const query = '什么是机器学习，它有什么应用';
  
  log(`执行搜索: "${query}"`, 'info');
  const result = await webSearchService.searchWithMCP(query);
  
  if (!result) {
    log('搜索失败或无结果', 'error');
    return false;
  }
  
  // 显示结果摘要
  log('搜索成功，结果摘要:', 'success');
  log(`用户意图: ${result.userIntent}`, 'info');
  log(`摘要: ${result.summary}`, 'info');
  log(`整体相关性: ${result.relevance}/10`, 'info');
  
  // 检查来源和质量评分
  log('\n来源质量分析:', 'info');
  if (!result.sources || result.sources.length === 0) {
    log('未找到可用来源', 'warn');
    return false;
  }
  
  // 分析每个来源
  result.sources.forEach((source, index) => {
    log(`\n来源 ${index + 1}: ${source.title}`, 'info');
    log(`  URL: ${source.url}`, 'info');
    log(`  与意图相关性: ${source.relevanceToIntent || '未评分'}/10`, 'info');
    log(`  来源质量评分: ${source.sourceQuality || '未评分'}/10`, 'info');
    
    // 提取部分内容作为示例
    const contentPreview = source.content.length > 100 
      ? source.content.substring(0, 100) + '...' 
      : source.content;
    log(`  内容预览: ${contentPreview}`, 'info');
  });
  
  // 输出格式化的搜索上下文
  log('\n格式化的搜索上下文:', 'info');
  const formattedContext = webSearchService.formatMCPSearchContext(result);
  console.log(formattedContext);
  
  return true;
}

/**
 * 主测试函数
 */
async function runTests() {
  try {
    log('开始测试优化后的搜索质量评估功能...', 'info');
    
    const result = await testSourceQualityEvaluation();
    
    if (result) {
      log('\n✅ 测试成功！搜索结果质量评估功能正常工作', 'success');
    } else {
      log('\n❌ 测试失败！未能成功评估搜索结果质量', 'error');
    }
  } catch (error) {
    log(`\n❌ 测试过程中出错: ${error.message}`, 'error');
    console.error(error);
  }
}

// 执行测试
runTests().then(() => {
  log('测试完成', 'info');
});