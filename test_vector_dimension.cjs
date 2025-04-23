/**
 * 向量维度标准化测试脚本 (CommonJS版本)
 * 检查向量维度标准化功能是否正常工作
 */
const { spawn } = require('child_process');
const path = require('path');

// 自定义日志函数
const log = (message, type = 'info') => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [${type}] ${message}`);
};

// 测试数据
const testText = "这是一个测试文本，用于检查向量维度标准化功能是否正常工作。";
const expectedDimension = 3072;

/**
 * 手动实现维度标准化函数，模拟我们在服务中的实现
 * @param {number[]} vector 输入向量
 * @param {number} targetDimension 目标维度
 * @returns {number[]} 标准化后的向量
 */
function normalizeVectorDimension(vector, targetDimension = 3072) {
  if (!vector || vector.length === 0) {
    log("无法标准化空向量", "error");
    return Array.from({ length: targetDimension }, () => 0);
  }
  
  const currentDimension = vector.length;
  
  // 如果已经是目标维度，直接返回
  if (currentDimension === targetDimension) {
    return vector;
  }
  
  log(`标准化向量维度: ${currentDimension} -> ${targetDimension}`, "info");
  
  if (currentDimension < targetDimension) {
    // 通过重复向量内容扩展维度
    const repeats = Math.ceil(targetDimension / currentDimension);
    let extendedVector = [];
    
    for (let i = 0; i < repeats; i++) {
      extendedVector = extendedVector.concat(vector);
    }
    
    // 截断到目标维度
    const normalizedVector = extendedVector.slice(0, targetDimension);
    log(`向量维度已扩展: ${currentDimension} -> ${normalizedVector.length}`, "info");
    return normalizedVector;
  } else {
    // 如果向量维度大于目标维度，截断为目标维度
    const normalizedVector = vector.slice(0, targetDimension);
    log(`向量维度已截断: ${currentDimension} -> ${normalizedVector.length}`, "info");
    return normalizedVector;
  }
}

/**
 * 调用Python嵌入服务生成向量
 */
async function testPythonEmbedding() {
  console.log("===== 测试Python嵌入服务 =====");
  
  // 调用Python脚本
  const pythonScriptPath = path.join(__dirname, 'server/services/embedding.py');
  const pythonProcess = spawn('python3', ['-u', pythonScriptPath]);
  
  let outputData = "";
  let errorData = "";

  // 收集输出
  pythonProcess.stdout.on('data', (data) => {
    outputData += data.toString();
  });

  // 收集错误信息
  pythonProcess.stderr.on('data', (data) => {
    errorData += data.toString();
    console.error(`Python错误: ${data.toString().trim()}`);
  });

  // 处理进程结束
  const result = await new Promise((resolve, reject) => {
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python进程异常退出，代码: ${code}`);
        resolve({ error: `进程异常退出 (${code}): ${errorData}` });
      }

      try {
        // 尝试解析JSON输出
        const jsonStart = outputData.indexOf('{');
        const jsonEnd = outputData.lastIndexOf('}');
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = outputData.substring(jsonStart, jsonEnd + 1);
          const result = JSON.parse(jsonStr);
          resolve(result);
        } else {
          resolve({ error: "无法解析Python响应" });
        }
      } catch (parseError) {
        console.error(`解析Python输出失败: ${parseError}`);
        resolve({ error: `解析输出失败: ${parseError}` });
      }
    });

    // 发送输入数据到Python进程
    pythonProcess.stdin.write(JSON.stringify({
      operation: "embed",
      text: testText
    }));
    pythonProcess.stdin.end();
  });
  
  // 检查结果
  if (result.error) {
    console.error(`测试失败: ${result.error}`);
    return false;
  }
  
  if (!result.embedding || !Array.isArray(result.embedding)) {
    console.error("测试失败: 没有返回向量嵌入");
    return false;
  }
  
  const embeddingDimension = result.embedding.length;
  console.log(`生成的向量维度: ${embeddingDimension}`);
  
  if (embeddingDimension === expectedDimension) {
    console.log("✅ 测试通过: 向量维度符合预期");
    return true;
  } else {
    console.error(`❌ 测试失败: 向量维度(${embeddingDimension})不符合预期(${expectedDimension})`);
    return false;
  }
}

/**
 * 测试手动维度标准化函数
 */
function testManualNormalization() {
  console.log("\n===== 测试向量维度标准化函数 =====");
  
  // 创建测试向量
  const testCases = [
    { name: "768维向量", vector: Array.from({ length: 768 }, (_, i) => i / 768) },
    { name: "1024维向量", vector: Array.from({ length: 1024 }, (_, i) => i / 1024) },
    { name: "4096维向量", vector: Array.from({ length: 4096 }, (_, i) => i / 4096) },
    { name: "空向量", vector: [] }
  ];
  
  let allTestsPassed = true;
  
  for (const testCase of testCases) {
    console.log(`\n测试情景: ${testCase.name}`);
    console.log(`原始向量维度: ${testCase.vector.length}`);
    
    const normalized = normalizeVectorDimension(testCase.vector);
    console.log(`标准化后的向量维度: ${normalized.length}`);
    
    if (normalized.length === expectedDimension) {
      console.log(`✅ 测试通过: 向量维度符合预期(${expectedDimension})`);
    } else {
      console.error(`❌ 测试失败: 向量维度(${normalized.length})不符合预期(${expectedDimension})`);
      allTestsPassed = false;
    }
  }
  
  return allTestsPassed;
}

/**
 * 主函数
 */
async function main() {
  console.log("开始测试向量维度标准化功能...");
  
  let pythonSuccess = false;
  let normalizationSuccess = false;
  
  try {
    // 测试Python嵌入服务
    pythonSuccess = await testPythonEmbedding();
    
    // 测试维度标准化函数
    normalizationSuccess = testManualNormalization();
    
    // 输出总结果
    console.log("\n===== 测试结果总结 =====");
    console.log(`Python嵌入服务测试: ${pythonSuccess ? '通过 ✅' : '失败 ❌'}`);
    console.log(`维度标准化函数测试: ${normalizationSuccess ? '通过 ✅' : '失败 ❌'}`);
    
    if (pythonSuccess && normalizationSuccess) {
      console.log("\n🎉 所有测试通过! 向量维度标准化功能正常工作。");
    } else {
      console.error("\n❌ 部分测试失败，请检查详细日志分析原因。");
    }
  } catch (error) {
    console.error(`测试过程发生错误: ${error}`);
  }
}

// 执行测试
main().catch(console.error);