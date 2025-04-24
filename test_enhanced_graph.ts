/**
 * 增强图谱关系测试脚本
 * 测试关系分析的增强功能：元数据传递和双向关系
 */

import { buildUserKnowledgeGraph, testTopicGraphBuilder } from './server/services/learning/topic_graph_builder';

/**
 * 打印彩色日志
 */
function colorLog(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m' // 重置颜色
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 验证图谱生成和关系分析的增强功能
 */
async function testEnhancedGraph() {
  colorLog('开始测试增强图谱关系功能...', 'info');

  try {
    // 1. 首先测试 testTopicGraphBuilder 函数，验证基本功能
    colorLog('1. 测试基本图谱构建功能...', 'info');
    const testGraph = await testTopicGraphBuilder();
    
    colorLog(`基本图谱构建成功，生成了 ${testGraph.nodes.length} 个节点和 ${testGraph.links.length} 个连接`, 'success');
    
    // 检查结果中是否包含 bidirectional 属性
    const hasBidirectional = testGraph.links.some(link => 'bidirectional' in link);
    colorLog(`链接中${hasBidirectional ? '包含' : '不包含'} bidirectional 属性`, hasBidirectional ? 'success' : 'warn');
    
    // 2. 测试用户图谱构建功能，强制刷新以确保不使用缓存
    colorLog('2. 测试用户图谱构建功能（强制刷新）...', 'info');
    const userId = 2; // 测试用户ID
    const userGraph = await buildUserKnowledgeGraph(userId, true);
    
    colorLog(`用户图谱构建成功，生成了 ${userGraph.nodes.length} 个节点和 ${userGraph.links.length} 个连接`, 'success');
    
    // 检查双向关系
    const bidirectionalLinks = userGraph.links.filter(link => link.bidirectional === true);
    colorLog(`共有 ${bidirectionalLinks.length} 个双向关系连接`, 'info');
    
    if (bidirectionalLinks.length > 0) {
      // 显示一些双向关系示例
      const examples = bidirectionalLinks.slice(0, 2);
      examples.forEach((link, index) => {
        colorLog(`双向关系示例 ${index + 1}: ${link.source} <-> ${link.target} (${link.type})`, 'info');
      });
    }
    
    // 3. 测试缓存功能，第二次调用应该使用缓存
    colorLog('3. 测试图谱缓存功能...', 'info');
    const cachedGraph = await buildUserKnowledgeGraph(userId, false);
    colorLog(`缓存图谱获取成功，包含 ${cachedGraph.nodes.length} 个节点和 ${cachedGraph.links.length} 个连接`, 'success');
    
    colorLog('增强图谱关系测试完成', 'success');
    return true;
  } catch (error) {
    colorLog(`测试失败: ${error}`, 'error');
    return false;
  }
}

// 运行测试
(async () => {
  try {
    await testEnhancedGraph();
  } catch (err) {
    console.error('测试执行错误:', err);
  }
})();