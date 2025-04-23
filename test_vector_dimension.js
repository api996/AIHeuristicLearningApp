/**
 * 向量维度标准化测试脚本
 * 检查Python嵌入服务和GenAI服务的维度标准化是否正常工作
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 自定义日志函数
const log = (message, type = 'info') => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [${type}] ${message}`);
};

// 测试数据
const testText = "这是一个测试文本，用于检查向量维度标准化功能是否正常工作。";
const expectedDimension = 3072;

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
  });

  // 发送输入数据到Python进程
  const inputData = {
    operation: "embed",
    text: testText
  };
  
  pythonProcess.stdin.write(JSON.stringify(inputData));
  pythonProcess.stdin.end();
  
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
 * 测试GenAI服务的向量生成
 */
async function testGenAIService() {
  console.log("\n===== 测试JavaScript GenAI服务 =====");
  try {
    // 动态导入GenAI服务
    const { genAiService } = await import('./server/services/genai/genai_service.js');
    
    // 等待服务初始化
    console.log("等待GenAI服务初始化...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 调用生成向量方法
    console.log(`生成文本"${testText}"的向量嵌入...`);
    const embedding = await genAiService.generateEmbedding(testText);
    
    if (!embedding) {
      console.error("测试失败: 没有返回向量嵌入");
      return false;
    }
    
    const embeddingDimension = embedding.length;
    console.log(`生成的向量维度: ${embeddingDimension}`);
    
    if (embeddingDimension === expectedDimension) {
      console.log("✅ 测试通过: 向量维度符合预期");
      
      // 测试维度标准化函数
      console.log("\n测试维度标准化函数...");
      
      // 创建一个768维的测试向量
      const testVector = Array.from({ length: 768 }, (_, i) => i / 768);
      console.log(`测试向量原始维度: ${testVector.length}`);
      
      // 调用标准化函数
      const normalizedVector = genAiService.normalizeVectorDimension(testVector);
      console.log(`标准化后的向量维度: ${normalizedVector.length}`);
      
      if (normalizedVector.length === expectedDimension) {
        console.log("✅ 维度标准化测试通过");
        return true;
      } else {
        console.error(`❌ 维度标准化测试失败: 标准化后维度(${normalizedVector.length})不符合预期(${expectedDimension})`);
        return false;
      }
    } else {
      console.error(`❌ 测试失败: 向量维度(${embeddingDimension})不符合预期(${expectedDimension})`);
      return false;
    }
  } catch (error) {
    console.error(`测试失败: ${error}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("开始测试向量维度标准化功能...");
  
  let pythonSuccess = false;
  let genaiSuccess = false;
  
  try {
    // 测试Python嵌入服务
    pythonSuccess = await testPythonEmbedding();
    
    // 测试GenAI服务
    genaiSuccess = await testGenAIService();
    
    // 输出总结果
    console.log("\n===== 测试结果总结 =====");
    console.log(`Python嵌入服务测试: ${pythonSuccess ? '通过 ✅' : '失败 ❌'}`);
    console.log(`GenAI服务测试: ${genaiSuccess ? '通过 ✅' : '失败 ❌'}`);
    
    if (pythonSuccess && genaiSuccess) {
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