/**
 * 向量嵌入服务测试脚本
 * 用于测试修改后的向量嵌入生成功能
 */

// 使用ES模块语法导入向量嵌入服务
import { vectorEmbeddingsService } from './server/services/learning/vector_embeddings.js';

// 简单彩色日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 测试函数
async function testEmbeddingService() {
  log('开始测试向量嵌入服务...');
  
  // 测试文本
  const testText = '这是一个测试文本，用于验证向量嵌入服务是否正常工作。我们期望获得3072维的向量。';
  
  try {
    log('生成向量嵌入中...');
    const embedding = await vectorEmbeddingsService.generateEmbedding(testText);
    
    // 检查向量维度
    log(`成功生成向量嵌入！`, 'success');
    log(`向量维度: ${embedding.length}`);
    
    if (embedding.length === 3072) {
      log('向量维度符合预期: 3072', 'success');
    } else {
      log(`向量维度异常: ${embedding.length}，期望值: 3072`, 'error');
    }
    
    // 检查向量值范围
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    log(`向量值范围: [${min.toFixed(4)}, ${max.toFixed(4)}]`);
    
    // 检查是否有NaN或Infinity
    const hasInvalid = embedding.some(val => isNaN(val) || !isFinite(val));
    if (hasInvalid) {
      log('警告: 向量包含NaN或Infinity值', 'warn');
    } else {
      log('向量值有效，无NaN或Infinity', 'success');
    }
    
    return true;
  } catch (error) {
    log(`测试失败: ${error}`, 'error');
    return false;
  }
}

// 主函数
async function main() {
  try {
    const success = await testEmbeddingService();
    
    if (success) {
      log('向量嵌入服务测试成功！', 'success');
    } else {
      log('向量嵌入服务测试失败！', 'error');
    }
  } catch (error) {
    log(`测试过程中出错: ${error}`, 'error');
  }
}

// 执行测试
main().catch(error => {
  log(`未捕获错误: ${error}`, 'error');
  process.exit(1);
});