/**
 * MCP 搜索服务测试脚本
 * 
 * 本脚本模拟前端调用MCP搜索服务，检查服务是否正常运行
 */

import fetch from 'node-fetch';

// 彩色日志输出
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m', // 重置
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 测试MCP搜索服务
async function testMCPSearch() {
  log('测试MCP搜索服务...');
  
  try {
    const response = await fetch('https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.repl.co/api/mcp/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: "今天的黄金走势",
        userId: 6
      }),
      // 确保传递凭证（cookies）
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      log('MCP搜索服务响应成功!', 'success');
      log(`搜索结果: ${JSON.stringify(data, null, 2)}`, 'success');
      return true;
    } else {
      const errorData = await response.text();
      throw new Error(`API响应错误: ${response.status} - ${errorData}`);
    }
  } catch (error) {
    log(`MCP搜索服务测试失败: ${error.message}`, 'error');
    return false;
  }
}

// 主函数
async function main() {
  await testMCPSearch();
}

main().catch(error => {
  log(`程序执行出错: ${error.message}`, 'error');
});