/**
 * Dify API测试脚本
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

// 测试Dify API连接
async function testDifyAPI() {
  log('测试Dify API连接...');
  
  try {
    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
      throw new Error('未找到DIFY_API_KEY环境变量');
    }

    const response = await fetch('https://api.dify.ai/v1/parameters', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      log('Dify API连接成功!', 'success');
      log(`应用参数: ${JSON.stringify(data, null, 2)}`, 'success');
      return true;
    } else {
      const errorData = await response.text();
      throw new Error(`API响应错误: ${response.status} - ${errorData}`);
    }
  } catch (error) {
    log(`Dify API连接失败: ${error.message}`, 'error');
    return false;
  }
}

// 主函数
async function main() {
  await testDifyAPI();
}

main().catch(error => {
  log(`程序执行出错: ${error.message}`, 'error');
});