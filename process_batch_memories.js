/**
 * 分批处理记忆嵌入脚本
 * 通过HTTP API批量处理缺失嵌入向量的记忆
 */

import axios from 'axios';

// 端点配置
const SERVER_URL = 'https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev';

// 颜色格式化工具
const colors = {
  info: '\x1b[36m',   // 青色
  success: '\x1b[32m', // 绿色
  warn: '\x1b[33m',    // 黄色
  error: '\x1b[31m',   // 红色
  reset: '\x1b[0m',    // 重置颜色
};

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 获取缺失嵌入的记忆列表
 */
async function getMissingEmbeddings(limit = 10) {
  try {
    const url = `${SERVER_URL}/api/embedding/missing-embeddings?limit=${limit}`;
    log(`请求缺失嵌入的记忆列表: ${url}`, 'info');
    
    const response = await axios.get(url);
    
    if (response.status === 200 && response.data.success) {
      const memories = response.data.memories || [];
      log(`发现 ${memories.length} 个缺失嵌入的记忆`, 'success');
      return memories;
    }
    
    log(`获取缺失嵌入列表失败: ${JSON.stringify(response.data)}`, 'error');
    return [];
  } catch (error) {
    log(`获取缺失嵌入列表错误: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 处理单个记忆
 */
async function processMemory(memoryId) {
  try {
    log(`开始处理记忆 ${memoryId}`, 'info');
    
    const url = `${SERVER_URL}/api/embedding/process-memory/${memoryId}`;
    const response = await axios.post(url);
    
    if (response.status === 200 && response.data.success) {
      log(`记忆 ${memoryId} 处理成功, 维度: ${response.data.dimensions || 3072}`, 'success');
      return true;
    } else {
      log(`处理记忆 ${memoryId} 失败: ${JSON.stringify(response.data)}`, 'error');
      return false;
    }
  } catch (error) {
    log(`处理记忆 ${memoryId} 时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 分批处理记忆
 */
async function processBatch(memories, batchSize = 5, delay = 3000) {
  if (!memories || memories.length === 0) {
    log('没有记忆需要处理', 'warn');
    return;
  }
  
  log(`将处理 ${memories.length} 条记忆记录，每批 ${batchSize} 条，批次间隔 ${delay}ms`, 'info');
  
  let successCount = 0;
  let failCount = 0;
  let currentBatch = 1;
  
  // 分批处理
  for (let i = 0; i < memories.length; i += batchSize) {
    const batch = memories.slice(i, i + batchSize);
    log(`\n开始处理第 ${currentBatch} 批（${batch.length} 条记录）`, 'info');
    
    // 逻辑处理该批次的记录
    for (let j = 0; j < batch.length; j++) {
      const memory = batch[j];
      log(`处理记忆 [${i + j + 1}/${memories.length}]: ${memory.id}`, 'info');
      
      const success = await processMemory(memory.id);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // 同一批次内的记录处理间隔等待
      if (j < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 更新当前批次计数
    currentBatch++;
    
    if (i + batchSize < memories.length) {
      log(`第 ${currentBatch - 1} 批处理完成，正在等待 ${delay / 1000} 秒后处理下一批...`, 'info');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  log(`\n===== 处理完成 =====`, 'info');
  log(`成功: ${successCount} 条`, 'success');
  log(`失败: ${failCount} 条`, 'error');
}

/**
 * 主函数
 */
async function main() {
  log(`===== 开始处理缺失向量嵌入的记忆 =====`, 'info');
  
  // 获取缺失嵌入的记忆列表（最多10条）
  const memories = await getMissingEmbeddings(10);
  
  if (memories.length === 0) {
    log('没有找到缺失嵌入的记忆', 'warn');
    return;
  }
  
  // 分批处理记忆，每戡3条，批次间隔10秒
  await processBatch(memories, 3, 10000);
}

// 执行主函数
main().catch(error => {
  log(`脚本执行出错: ${error.message}`, 'error');
});
