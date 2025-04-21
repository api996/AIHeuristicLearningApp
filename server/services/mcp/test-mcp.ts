/**
 * MCP 测试脚本
 * 用于测试 MCP 搜索功能
 */

import 'dotenv/config';
import { mcpService } from './index';

/**
 * 打印带颜色的日志
 */
function colorLog(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    error: '\x1b[31m%s\x1b[0m',    // 红色
    warn: '\x1b[33m%s\x1b[0m'      // 黄色
  };
  
  console.log(colors[type], message);
}

/**
 * 测试 MCP 搜索
 */
async function testMcpSearch(): Promise<void> {
  colorLog('=== 测试 MCP 搜索功能 ===', 'info');
  
  try {
    // 测试查询
    const testQueries = [
      '模型上下文协议的特点',
      '量子计算的应用领域'
    ];
    
    for (const query of testQueries) {
      colorLog(`\n执行查询: "${query}"`, 'info');
      
      // 使用 MCP 搜索
      colorLog('\n--- MCP 搜索结果 ---', 'info');
      console.time('MCP 搜索耗时');
      const mcpResults = await mcpService.search(query, true, 3);
      console.timeEnd('MCP 搜索耗时');
      
      if (mcpResults.success) {
        mcpResults.content.forEach((item: any, index: number) => {
          colorLog(`\n内容块 ${index + 1}:`, 'success');
          console.log(item.text);
        });
      } else {
        colorLog(`MCP 搜索失败: ${mcpResults.error}`, 'error');
      }
      
      // 使用普通搜索
      colorLog('\n--- 普通搜索结果 ---', 'info');
      console.time('普通搜索耗时');
      const regularResults = await mcpService.search(query, false, 3);
      console.timeEnd('普通搜索耗时');
      
      if (regularResults.success) {
        regularResults.content.forEach((item: any, index: number) => {
          colorLog(`\n结果 ${index + 1}:`, 'success');
          console.log(item.text);
        });
      } else {
        colorLog(`普通搜索失败: ${regularResults.error}`, 'error');
      }
      
      console.log('\n' + '-'.repeat(50) + '\n');
    }
  } catch (error) {
    colorLog(`测试出错: ${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    // 关闭 MCP 服务
    await mcpService.close();
  }
}

// 运行测试
(async () => {
  await testMcpSearch();
})();