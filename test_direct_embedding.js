/**
 * 测试直接嵌入服务
 * 直接测试服务的结果
 */

// 使用命令行参数，允许指定要测试的文本
const testText = process.argv[2] || '这是一个测试句子，用于验证嵌入服务是否正常工作。';

// 导入必要的模块
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateEmbedding, calculateSimilarity } from './server/services/learning/flask_embedding_service.js';

// 在ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 彩色输出函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type], message);
}

// 测试向量嵌入生成
async function testEmbedding() {
  try {
    log('===== 测试向量嵌入生成 =====', 'info');
    log(`测试文本: "${testText}"`, 'info');
    
    log('开始生成嵌入...', 'info');
    const startTime = Date.now();
    const embedding = await generateEmbedding(testText);
    const elapsedTime = Date.now() - startTime;
    
    if (embedding && Array.isArray(embedding)) {
      log(`嵌入生成成功，维度: ${embedding.length}, 耗时: ${elapsedTime}ms`, 'success');
      log(`嵌入向量前5个值: [${embedding.slice(0, 5).join(', ')}]`, 'info');
      return embedding;
    } else {
      log('嵌入生成失败，返回无效结果', 'error');
      return null;
    }
  } catch (error) {
    log(`嵌入生成出错: ${error}`, 'error');
    return null;
  }
}

// 测试相似度计算
async function testSimilarity() {
  try {
    log('===== 测试相似度计算 =====', 'info');
    
    const text1 = '我喜欢在公园散步';
    const text2 = '公园里散步是我的爱好';
    const text3 = '人工智能正在迅速发展';
    
    log(`文本1: "${text1}"`, 'info');
    log(`文本2: "${text2}"`, 'info');
    log(`文本3: "${text3}"`, 'info');
    
    log('计算文本1和文本2的相似度...', 'info');
    const similarity12 = await calculateSimilarity(text1, text2);
    log(`文本1和文本2的相似度: ${similarity12}`, 'success');
    
    log('计算文本1和文本3的相似度...', 'info');
    const similarity13 = await calculateSimilarity(text1, text3);
    log(`文本1和文本3的相似度: ${similarity13}`, 'success');
    
    if (similarity12 > similarity13) {
      log('测试通过：相似的文本相似度更高', 'success');
    } else {
      log('测试失败：不相似的文本相似度反而更高', 'error');
    }
  } catch (error) {
    log(`相似度计算出错: ${error}`, 'error');
  }
}

async function main() {
  log('开始测试直接嵌入服务...', 'info');
  
  const embedding = await testEmbedding();
  
  if (embedding) {
    await testSimilarity();
  }
  
  log('测试完成', 'info');
}

main().catch(error => {
  log(`测试过程出错: ${error}`, 'error');
});