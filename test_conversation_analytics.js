/**
 * 对话分析服务测试脚本
 * 用于调试对话分析可能存在的问题
 */
import fetch from 'node-fetch';

// 测试Gemini API响应解析
async function testGeminiAnalysis() {
  // 模拟Gemini API调用函数
  async function mockCallGeminiForAnalysis() {
    // 模拟成功的响应
    return {
      currentPhase: "W",
      summary: "用户对学习数学的必要性表示疑惑",
      confidence: 0.85
    };
    
    // 注释掉下面的代码，用于测试各种失败情况
    /*
    // 模拟JSON格式错误
    return {
      current_phase: "W",  // 字段名称错误
      summary: "用户对学习数学的必要性表示疑惑",
      confidence: 0.85
    };
    */
    
    /*
    // 模拟空响应
    return null;
    */
    
    /*
    // 模拟API错误
    throw new Error("API调用失败");
    */
  }
  
  try {
    console.log("测试1: 模拟Gemini API调用...");
    const result = await mockCallGeminiForAnalysis();
    
    console.log("API返回结果:", result);
    
    // 解析和验证结果
    if (!result) {
      console.error("错误: API返回空结果");
      return;
    }
    
    // 验证字段
    const validPhases = ["K", "W", "L", "Q"];
    if (!result.currentPhase || !validPhases.includes(result.currentPhase)) {
      console.error(`错误: 无效的对话阶段 "${result.currentPhase}"`);
    } else {
      console.log(`有效的对话阶段: ${result.currentPhase}`);
    }
    
    if (!result.summary || typeof result.summary !== 'string') {
      console.error("错误: 摘要缺失或格式错误");
    } else {
      console.log(`有效的摘要: "${result.summary}"`);
    }
    
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      console.error(`错误: 置信度无效 "${result.confidence}"`);
    } else {
      console.log(`有效的置信度: ${result.confidence}`);
    }
    
  } catch (error) {
    console.error("测试过程中发生错误:", error);
    if (error.stack) {
      console.error("错误堆栈:", error.stack);
    }
  }
}

// 测试JSON解析容错性
function testJsonParsing() {
  console.log("\n测试2: JSON解析容错性...");
  
  // 几种可能的API响应文本
  const responseTexts = [
    // 标准JSON
    '{"currentPhase": "W", "summary": "用户表示困惑", "confidence": 0.8}',
    
    // 带前缀文本的JSON
    '以下是分析结果:\n{"currentPhase": "K", "summary": "用户在获取知识", "confidence": 0.7}',
    
    // 格式化的JSON带缩进和换行
    `{
      "currentPhase": "L",
      "summary": "用户在深化理解",
      "confidence": 0.9
    }`,
    
    // 不规范JSON (缺少引号)
    '{currentPhase: "Q", summary: "用户在质疑", confidence: 0.6}',
    
    // 严重损坏的JSON
    'currentPhase = K, summary = 用户在学习'
  ];
  
  for (const [index, text] of responseTexts.entries()) {
    console.log(`\n测试响应文本 ${index + 1}:`);
    try {
      // 尝试使用标准JSON解析
      try {
        const result = JSON.parse(text);
        console.log("标准JSON解析成功:", result);
      } catch (jsonError) {
        console.log("标准JSON解析失败:", jsonError.message);
        
        // 尝试使用正则表达式提取
        const phaseMatch = text.match(/currentPhase"?\s*[:=]\s*"?([KWLQ])"?/i);
        const summaryMatch = text.match(/summary"?\s*[:=]\s*"?([^",}]*)"?/i);
        
        if (phaseMatch || summaryMatch) {
          console.log("使用正则表达式提取成功:");
          if (phaseMatch) console.log(`- 阶段: ${phaseMatch[1]}`);
          if (summaryMatch) console.log(`- 摘要: ${summaryMatch[1]}`);
        } else {
          console.log("正则表达式提取失败");
        }
      }
    } catch (error) {
      console.error(`测试响应文本 ${index + 1} 发生错误:`, error);
    }
  }
}

// 运行所有测试
async function runAllTests() {
  console.log("开始对话分析错误诊断测试\n");
  
  await testGeminiAnalysis();
  testJsonParsing();
  
  console.log("\n测试完成");
}

// 执行测试
runAllTests();