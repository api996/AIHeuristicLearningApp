/**
 * Serper API 搜索请求示例
 * 用于测试和诊断SERPER_API_KEY问题
 */

import fetch from 'node-fetch';

// API密钥 - 您需要在环境变量中设置或直接替换此值
const SERPER_API_KEY = process.env.SERPER_API_KEY;

// 搜索查询参数
const searchQuery = "今天的黄金走势";
const searchParams = {
  q: searchQuery,    // 搜索关键词
  gl: "cn",          // 地理位置 (cn代表中国)
  hl: "zh-cn",       // 语言 (中文)
  num: 10            // 结果数量
};

// 请求URL
const url = "https://google.serper.dev/search";

// 请求选项
const requestOptions = {
  method: "POST",
  headers: {
    "X-API-KEY": SERPER_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(searchParams)
};

// 记录请求信息 (不显示API密钥)
console.log("准备发送Serper API搜索请求:");
console.log(`URL: ${url}`);
console.log(`查询: ${searchQuery}`);
console.log("请求参数:", searchParams);
console.log("请求头部:", {
  "X-API-KEY": "【已隐藏】",
  "Content-Type": "application/json"
});

// 执行搜索请求
async function executeSearch() {
  try {
    // 检查API密钥
    if (!SERPER_API_KEY) {
      throw new Error("缺少SERPER_API_KEY环境变量");
    }
    
    // 发送请求
    console.log("发送搜索请求...");
    const response = await fetch(url, requestOptions);
    
    // 检查响应状态
    console.log(`收到响应状态码: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      // 尝试获取错误信息
      const errorText = await response.text();
      throw new Error(`API响应错误 (${response.status}): ${errorText}`);
    }
    
    // 解析JSON响应
    const searchResults = await response.json();
    
    // 如果结果包含organic字段，说明搜索成功
    if (searchResults.organic && Array.isArray(searchResults.organic)) {
      console.log(`搜索成功! 找到${searchResults.organic.length}个结果`);
      
      // 打印前3个结果
      console.log("\n搜索结果预览:");
      searchResults.organic.slice(0, 3).forEach((result, index) => {
        console.log(`\n结果 #${index + 1}:`);
        console.log(`标题: ${result.title || '无标题'}`);
        console.log(`摘要: ${result.snippet || '无摘要'}`);
        console.log(`链接: ${result.link || '无链接'}`);
      });
    } else {
      console.log("搜索未返回预期结果格式");
      console.log("返回数据:", JSON.stringify(searchResults, null, 2));
    }
  } catch (error) {
    console.error("搜索请求失败:", error.message);
  }
}

// 执行搜索函数
executeSearch();