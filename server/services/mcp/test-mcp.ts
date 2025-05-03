/**
 * MCP 测试脚本
 * 用于测试 MCP 服务的基本功能
 */

import { initializeMCP, searchWithMCP, closeMCP } from './index';

/**
 * 颜色日志函数
 */
function colorLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type], `[MCP测试] ${message}`);
}

/**
 * 测试 MCP 搜索功能
 */
async function testMCPSearch() {
  try {
    // 初始化 MCP 服务
    colorLog('正在初始化 MCP 服务...');
    const initResult = await initializeMCP();
    
    if (!initResult) {
      colorLog('MCP 服务初始化失败', 'error');
      return false;
    }
    
    colorLog('MCP 服务初始化成功', 'success');
    
    // 执行测试搜索查询
    const query = 'Anthropic MCP 协议';
    colorLog(`执行搜索查询: "${query}"`);
    
    // 测试使用 MCP 结构化结果
    const mcpResults = await searchWithMCP(query, true, 3);
    colorLog(`MCP 结构化搜索结果: ${mcpResults.success ? '成功' : '失败'}`, 
             mcpResults.success ? 'success' : 'error');
    
    if (mcpResults.success && mcpResults.content.length > 0) {
      colorLog(`结果内容示例: ${JSON.stringify(mcpResults.content[0]).slice(0, 150)}...`);
    } else if (mcpResults.error) {
      colorLog(`错误: ${mcpResults.error}`, 'error');
    }
    
    // 测试使用基础搜索结果
    const basicResults = await searchWithMCP(query, false, 3);
    colorLog(`基础搜索结果: ${basicResults.success ? '成功' : '失败'}`, 
             basicResults.success ? 'success' : 'error');
    
    if (basicResults.success && basicResults.content.length > 0) {
      colorLog(`结果内容示例: ${JSON.stringify(basicResults.content[0]).slice(0, 150)}...`);
    } else if (basicResults.error) {
      colorLog(`错误: ${basicResults.error}`, 'error');
    }
    
    // 关闭 MCP 服务
    colorLog('正在关闭 MCP 服务...');
    await closeMCP();
    colorLog('MCP 服务已关闭', 'success');
    
    return mcpResults.success || basicResults.success;
  } catch (error) {
    colorLog(`测试过程中出现错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}

// 在 ES 模块环境中直接运行时调用
// Node.js ESM 模块不支持 require.main，因此使用 import.meta.url 检查
const isMainModule = import.meta.url.endsWith('test-mcp.js') || 
                     import.meta.url.endsWith('test-mcp.ts');
if (isMainModule) {
  colorLog('开始 MCP 测试...');
  testMCPSearch()
    .then(success => {
      if (success) {
        colorLog('MCP 测试完成，结果: 成功', 'success');
        process.exit(0);
      } else {
        colorLog('MCP 测试完成，结果: 失败', 'error');
        process.exit(1);
      }
    })
    .catch(error => {
      colorLog(`MCP 测试出错: ${error}`, 'error');
      process.exit(1);
    });
}

// 导出测试函数
export { testMCPSearch };