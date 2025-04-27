/**
 * 简化版API连接测试脚本
 * 此脚本自动测试所有配置的API密钥
 */

import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generativeai';
import OpenAI from 'openai';

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
      return true;
    } else {
      throw new Error('未收到有效的API响应');
    }
  } catch (error) {
    log(`Gemini API连接失败: ${error.message}`, 'error');
    return false;
  }
}

// 测试指定的API
async function testAPI(apiName) {
  switch(apiName) {
    case 'dify':
      return await testDifyAPI();
    case 'serper':
      return await testSerperAPI();
    case 'deepseek':
      return await testDeepSeekAPI();
    case 'grok':
      return await testGrokAPI();
    case 'gemini':
      return await testGeminiAPI();
    default:
      log(`未知的API: ${apiName}`, 'error');
      return false;
  }
}

// 主函数
async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  const apiToTest = args[0] || 'all';
  
  log(`API连接测试工具启动，测试目标: ${apiToTest}`, 'info');
  
  if (apiToTest === 'all') {
    log('开始测试所有API连接...', 'info');
    
    const results = {
      dify: await testDifyAPI(),
      serper: await testSerperAPI(),
      deepseek: await testDeepSeekAPI(),
      grok: await testGrokAPI(),
      gemini: await testGeminiAPI()
    };
    
    log('\n========= API 连接测试结果 =========', 'info');
    for (const [api, success] of Object.entries(results)) {
      log(`${api}: ${success ? '成功 ✓' : '失败 ✗'}`, success ? 'success' : 'error');
    }
    log('===================================', 'info');
  } else {
    await testAPI(apiToTest);
  }
}

main().catch(error => {
  log(`程序执行出错: ${error.message}`, 'error');
});