/**
 * Dify API连接测试脚本
 * 用于检查Dify API的连接状态和错误原因
 */

import fetch from 'node-fetch';

// 获取环境变量
const difyApiKey = process.env.DIFY_API_KEY;

// 测试函数
async function testDifyConnection() {
  console.log("开始测试Dify API连接...");
  
  if (!difyApiKey) {
    console.error("错误: 未找到DIFY_API_KEY环境变量");
    return;
  }
  
  // 显示API密钥前几个字符（安全日志）
  const apiKeyPrefix = difyApiKey.substring(0, 4) + '...' + difyApiKey.substring(difyApiKey.length - 4);
  console.log(`使用Dify API密钥: ${apiKeyPrefix}`);
  
  // 简单请求数据
  const requestData = {
    query: "测试Dify API连接是否正常",
    response_mode: "blocking",
    conversation_id: "",
    user: "test-user",
    inputs: {}
  };
  
  // 使用AbortController设置超时
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.error("请求超时: 连接时间超过10秒");
  }, 10000); // 10秒超时
  
  try {
    console.log("发送请求到 https://api.dify.ai/v1/chat-messages");
    
    const response = await fetch("https://api.dify.ai/v1/chat-messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${difyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
      signal: controller.signal
    });
    
    // 清除超时
    clearTimeout(timeoutId);
    
    console.log(`API响应状态: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API错误: ${response.status} - ${errorText}`);
      
      if (response.status === 401) {
        console.error("认证失败: API密钥可能无效或已过期");
      } else if (response.status === 429) {
        console.error("请求过多: 已超出API调用频率限制");
      } else if (response.status === 404) {
        console.error("未找到资源: API端点可能已更改");
      } else if (response.status === 403) {
        console.error("禁止访问: 没有权限访问此资源");
      }
      return;
    }
    
    // 成功响应
    const data = await response.json();
    console.log("API响应数据:", JSON.stringify(data, null, 2));
    console.log("连接测试成功!");
  } catch (error) {
    // 清除超时
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error("请求被中止: 可能是因为超时");
    } else {
      console.error(`测试出错: ${error.message}`);
      
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error("DNS解析错误: 服务器地址可能不正确");
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error("连接被拒绝: 服务器可能未运行或防火墙阻止");
      } else if (error.message.includes('timeout')) {
        console.error("连接超时: 服务器响应时间过长");
      } else if (error.message.includes('certificate')) {
        console.error("SSL证书错误: 证书可能已过期或不受信任");
      }
    }
  }
}

// 执行测试
testDifyConnection();