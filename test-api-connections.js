/**
 * API连接测试脚本
 * 此脚本用于测试各种AI API的连接状态
 */

import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generativeai';
import OpenAI from 'openai';
import readline from 'readline';

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
      log('Dify API连接成功!', 'success');
      const data = await response.json();
      log(`获取到应用参数: ${JSON.stringify(data, null, 2)}`, 'success');
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

// 测试Serper API连接
async function testSerperAPI() {
  log('测试Serper API连接...');
  
  try {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error('未找到SERPER_API_KEY环境变量');
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: 'test connection',
        gl: 'us',
        hl: 'en'
      })
    });

    if (response.ok) {
      log('Serper API连接成功!', 'success');
      const data = await response.json();
      if (data.organic && data.organic.length > 0) {
        log(`搜索结果数量: ${data.organic.length}`, 'success');
      }
      return true;
    } else {
      const errorData = await response.text();
      throw new Error(`API响应错误: ${response.status} - ${errorData}`);
    }
  } catch (error) {
    log(`Serper API连接失败: ${error.message}`, 'error');
    return false;
  }
}

// 测试DeepSeek API连接
async function testDeepSeekAPI() {
  log('测试DeepSeek API连接...');
  
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('未找到DEEPSEEK_API_KEY环境变量');
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.nim.ainimate.nvidia.com/v1/namespaces/deepseek/inferencers/deepseek-coder'
    });

    const completion = await openai.chat.completions.create({
      model: "deepseek-coder",
      messages: [
        { role: "system", content: "你是一个有用的AI助手。" },
        { role: "user", content: "测试DeepSeek API连接" }
      ],
      max_tokens: 50
    });

    if (completion && completion.choices && completion.choices.length > 0) {
      log('DeepSeek API连接成功!', 'success');
      log(`响应内容: ${completion.choices[0].message.content}`, 'success');
      return true;
    } else {
      throw new Error('未收到有效的API响应');
    }
  } catch (error) {
    log(`DeepSeek API连接失败: ${error.message}`, 'error');
    return false;
  }
}

// 测试Grok API连接
async function testGrokAPI() {
  log('测试Grok API连接...');
  
  try {
    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      throw new Error('未找到GROK_API_KEY环境变量');
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1'
    });

    const completion = await openai.chat.completions.create({
      model: "grok-3-fast-beta",
      messages: [
        { role: "system", content: "你是一个有用的AI助手。" },
        { role: "user", content: "测试Grok API连接" }
      ],
      max_tokens: 50
    });

    if (completion && completion.choices && completion.choices.length > 0) {
      log('Grok API连接成功!', 'success');
      log(`响应内容: ${completion.choices[0].message.content}`, 'success');
      return true;
    } else {
      throw new Error('未收到有效的API响应');
    }
  } catch (error) {
    log(`Grok API连接失败: ${error.message}`, 'error');
    return false;
  }
}

// 测试Gemini API连接
async function testGeminiAPI() {
  log('测试Gemini API连接...');
  
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('未找到GEMINI_API_KEY环境变量');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-001" });
    
    const result = await model.generateContent("测试Gemini API连接");
    const response = await result.response;
    const text = response.text();
    
    if (text) {
      log('Gemini API连接成功!', 'success');
      log(`响应内容: ${text}`, 'success');
      return true;
    } else {
      throw new Error('未收到有效的API响应');
    }
  } catch (error) {
    log(`Gemini API连接失败: ${error.message}`, 'error');
    return false;
  }
}

// 创建交互式命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 显示菜单
function showMenu() {
  console.log('\n========= API 连接测试工具 =========');
  console.log('1. 测试 Dify API');
  console.log('2. 测试 Serper API');
  console.log('3. 测试 DeepSeek API');
  console.log('4. 测试 Grok API');
  console.log('5. 测试 Gemini API');
  console.log('6. 测试所有 API');
  console.log('0. 退出');
  console.log('===================================');
  
  rl.question('请选择要测试的API (0-6): ', async (answer) => {
    switch (answer) {
      case '1':
        await testDifyAPI();
        showMenu();
        break;
      case '2':
        await testSerperAPI();
        showMenu();
        break;
      case '3':
        await testDeepSeekAPI();
        showMenu();
        break;
      case '4':
        await testGrokAPI();
        showMenu();
        break;
      case '5':
        await testGeminiAPI();
        showMenu();
        break;
      case '6':
        log('开始测试所有API连接...', 'info');
        await testDifyAPI();
        await testSerperAPI();
        await testDeepSeekAPI();
        await testGrokAPI();
        await testGeminiAPI();
        log('所有API测试完成', 'info');
        showMenu();
        break;
      case '0':
        log('退出测试工具', 'info');
        rl.close();
        break;
      default:
        log('无效的选择，请重新输入', 'warn');
        showMenu();
        break;
    }
  });
}

// 启动测试工具
async function main() {
  log('API连接测试工具启动...', 'info');
  showMenu();
}

main().catch(error => {
  log(`程序执行出错: ${error.message}`, 'error');
});