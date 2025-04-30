/**
 * Dify API调试脚本
 * 用于测试Dify API聊天消息端点的请求格式
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

// 测试Dify API聊天消息端点
async function testDifyAPI() {
  log('测试Dify API聊天消息端点...');
  
  try {
    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
      throw new Error('未找到DIFY_API_KEY环境变量');
    }
    
    // 记录API密钥长度（不显示实际密钥）
    log(`使用API密钥，长度: ${apiKey.length}字符`);
    
    // Dify API请求示例 - 根据实际代码中的格式
    const testPayload = {
      query: "测试问题，这是一个简单的测试",  // 用户问题
      response_mode: "blocking",              // 阻塞模式
      conversation_id: "",                    // 首次对话为空
      user: "test-user",                      // 用户标识
      inputs: {                               // 可选的输入
        context_memories: "这是一些上下文记忆，用于提供背景信息。"
      }
    };
    
    // 使用应用级 API 端点
    // 应用密钥格式: "app-U4atYg7zzgecfchOHo1HGAr2"
    // 对于Dify应用密钥，我们需要提取appId部分以构建正确的URL
    // 直接硬编码应用ID，避免解析错误
    const appId = "U4atYg7zzgecfchOHo1HGAr2";
    
    if (!appId) {
      log(`无法从API密钥中提取应用ID，格式可能不正确`, 'warn');
      log(`将使用公共API端点`, 'info');
      var endpoint = `https://api.dify.ai/v1/chat-messages`;
    } else {
      log(`成功提取应用ID: ${appId.substring(0, 4)}...`, 'success');
      var endpoint = `https://api.dify.ai/v1/apps/${appId}/chat-messages`;
    }
    
    log(`请求端点: ${endpoint}`);
    log(`请求头: Authorization: Bearer ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
    log(`请求体: ${JSON.stringify(testPayload, null, 2)}`);
    
    // 发送API请求，带超时控制
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      log('请求超时，已中止', 'warn');
    }, 60000); // 60秒超时 - Dify工作流需要较长时间
    
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      // 记录响应状态
      log(`响应状态: ${response.status} ${response.statusText}`);
      
      // 获取并格式化响应体
      const responseText = await response.text();
      log(`原始响应: ${responseText}`);
      
      try {
        // 尝试解析为JSON以获得更好的格式
        const responseData = JSON.parse(responseText);
        log(`格式化响应: ${JSON.stringify(responseData, null, 2)}`, 'success');
      } catch (e) {
        // 如果不是有效的JSON，保持文本格式
        log(`响应无法解析为JSON: ${e.message}`, 'warn');
      }
      
      return true;
    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }
    
    return true;
  } catch (error) {
    log(`Dify API测试失败: ${error.message}`, 'error');
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