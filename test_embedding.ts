/**
 * 测试向量嵌入服务 (TypeScript 版本)
 */

// 使用彩色输出
function colorLog(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type], message);
}

// 直接导入嵌入服务类
import { EmbeddingService } from './server/services/embedding';

/**
 * 测试嵌入生成
 */
async function testEmbedding(): Promise<void> {
  try {
    colorLog('===== 测试向量嵌入生成 =====', 'info');
    
    // 测试文本
    const testText = '这是一个测试句子，用于验证嵌入服务是否正常工作。';
    colorLog(`测试文本: "${testText}"`, 'info');
    
    // 初始化嵌入服务
    const embeddingService = new EmbeddingService();
    colorLog('嵌入服务初始化成功', 'success');
    
    // 生成嵌入向量
    colorLog('开始生成嵌入...', 'info');
    const startTime = Date.now();
    const embedding = await embeddingService.embed_single_text(testText);
    const elapsedTime = Date.now() - startTime;
    
    if (embedding && Array.isArray(embedding)) {
      colorLog(`嵌入生成成功，维度: ${embedding.length}, 耗时: ${elapsedTime}ms`, 'success');
      colorLog(`嵌入向量前5个值: [${embedding.slice(0, 5).join(', ')}]`, 'info');
    } else {
      colorLog('嵌入生成失败，返回无效结果', 'error');
    }
    
    // 测试相似度计算
    await testSimilarity(embeddingService);
    
  } catch (error) {
    colorLog(`嵌入生成出错: ${error}`, 'error');
  }
}

/**
 * 测试相似度计算
 */
async function testSimilarity(embeddingService: EmbeddingService): Promise<void> {
  try {
    colorLog('===== 测试相似度计算 =====', 'info');
    
    const text1 = '我喜欢在公园散步';
    const text2 = '公园里散步是我的爱好';
    const text3 = '人工智能正在迅速发展';
    
    colorLog(`文本1: "${text1}"`, 'info');
    colorLog(`文本2: "${text2}"`, 'info');
    colorLog(`文本3: "${text3}"`, 'info');
    
    // 计算文本1和文本2的相似度
    colorLog('计算文本1和文本2的相似度...', 'info');
    const similarity12 = await embeddingService.calculate_similarity(text1, text2);
    colorLog(`文本1和文本2的相似度: ${similarity12}`, 'success');
    
    // 计算文本1和文本3的相似度
    colorLog('计算文本1和文本3的相似度...', 'info');
    const similarity13 = await embeddingService.calculate_similarity(text1, text3);
    colorLog(`文本1和文本3的相似度: ${similarity13}`, 'success');
    
    // 验证结果是否符合预期
    if (similarity12 > similarity13) {
      colorLog('测试通过: 相似的文本相似度更高', 'success');
    } else {
      colorLog('测试失败: 不相似的文本相似度反而更高', 'warn');
    }
  } catch (error) {
    colorLog(`相似度计算出错: ${error}`, 'error');
  }
}

// 主函数
async function main(): Promise<void> {
  colorLog('开始测试向量嵌入服务...', 'info');
  await testEmbedding();
  colorLog('测试完成', 'success');
}

// 运行主函数
main().catch(error => {
  colorLog(`测试过程出错: ${error}`, 'error');
});