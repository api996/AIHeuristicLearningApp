/**
 * 测试嵌入向量维度
 */

// 导入Gemini服务
import { genAiService, initializeGenAIService } from './server/services/genai/genai_service';

async function testEmbeddingDimension() {
  console.log('===== 测试嵌入向量维度 =====');
  
  try {
    // 初始化GenAI服务
    await initializeGenAIService();
    
    // 测试文本
    const testText = '这是一个测试文本，用于验证嵌入向量的维度是否正确';
    console.log(`使用测试文本: "${testText}"`);
    
    // 生成嵌入向量
    console.log('正在生成嵌入向量...');
    const embedding = await genAiService.generateEmbedding(testText);
    
    // 检查嵌入向量维度
    console.log(`生成的嵌入向量维度: ${embedding.length}`);
    console.log(`期望的嵌入向量维度: 3072`);
    console.log(`向量维度是否匹配: ${embedding.length === 3072 ? '✓' : '✗'}`);
    
    // 输出前5个元素
    console.log('向量前5个元素:');
    console.log(embedding.slice(0, 5));
    
    // 成功完成
    console.log('===== 测试完成 =====');
  } catch (error) {
    console.error(`测试失败: ${error}`);
    process.exit(1);
  }
}

// 运行测试
testEmbeddingDimension();
