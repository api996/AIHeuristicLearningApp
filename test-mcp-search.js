/**
 * MCP 搜索功能测试脚本
 * 
 * 本脚本模拟前端点击"网络搜索"按钮的请求流程，
 * 测试MCP搜索服务是否能正确捕获请求、处理请求，并返回结构化结果
 */

import fetch from 'node-fetch';
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// 打印带颜色的日志
function colorLog(message, type = 'info') {
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
    debug: colors.magenta
  };
  console.log(`${colorMap[type] || colors.blue}[MCP测试] ${message}${colors.reset}`);
}

/**
 * 测试MCP搜索功能
 * 模拟前端点击网络搜索按钮的行为
 */
async function testMCPSearch() {
  colorLog('开始测试MCP搜索功能...');
  
  // 定义测试查询
  const testQuery = 'MCP protocol Anthropic 2025';
  
  // 1. 首先测试直接调用API
  try {
    colorLog(`测试调用搜索API，查询: "${testQuery}"`, 'info');
    
    // 使用服务器实际的端点
    const apiResponse = await fetch('http://localhost:5000/api/web-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: testQuery,
        useMCP: true,
        numResults: 3
      })
    });
    
    if (!apiResponse.ok) {
      throw new Error(`HTTP错误 ${apiResponse.status}: ${apiResponse.statusText}`);
    }
    
    const searchResult = await apiResponse.json();
    
    // 检查响应结构
    if (searchResult.success) {
      colorLog('API调用成功!', 'success');
      
      // 显示第一部分结果
      if (searchResult.content && searchResult.content.length > 0) {
        // 输出前200个字符的内容预览
        const previewContent = searchResult.content[0]?.text 
          ? searchResult.content[0].text.slice(0, 200) + '...'
          : JSON.stringify(searchResult.content[0]).slice(0, 200) + '...';
        
        colorLog(`内容预览: ${previewContent}`, 'success');
      }
    } else {
      colorLog(`API调用返回错误: ${searchResult.error || '未知错误'}`, 'error');
    }
  } catch (error) {
    colorLog(`测试API调用时出错: ${error.message}`, 'error');
  }
  
  // 2. 直接测试MCP搜索服务而不是通过聊天API
  try {
    colorLog(`\n测试MCP搜索服务，查询: "${testQuery}"`, 'info');
    
    // 直接调用MCP搜索单独的API
    const searchResponse = await fetch('http://localhost:5000/api/mcp-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: testQuery,
        useMCP: true
      })
    });
    
    if (!searchResponse.ok) {
      throw new Error(`HTTP错误 ${searchResponse.status}: ${searchResponse.statusText}`);
    }
    
    const mcpResult = await searchResponse.json();
    
    // 检查响应结构
    if (mcpResult.success) {
      colorLog('MCP搜索API调用成功!', 'success');
      
      // 显示搜索结果
      if (mcpResult.content) {
        // 输出前200个字符的内容预览
        const previewContent = typeof mcpResult.content === 'string' 
          ? mcpResult.content.slice(0, 200) + '...'
          : JSON.stringify(mcpResult.content).slice(0, 200) + '...';
        
        colorLog(`MCP搜索结果预览: ${previewContent}`, 'success');
      } else {
        colorLog('MCP搜索结果格式异常', 'warn');
      }
    } else {
      colorLog(`MCP搜索API调用返回错误: ${mcpResult.error || '未知错误'}`, 'error');
    }
  } catch (error) {
    colorLog(`测试MCP搜索API时出错: ${error.message}`, 'error');
  }
  
  colorLog('MCP搜索测试完成!', 'info');
}

// 直接执行测试
testMCPSearch().catch(error => {
  colorLog(`测试执行失败: ${error.message}`, 'error');
  process.exit(1);
});