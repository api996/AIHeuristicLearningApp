/**
 * 批量处理记忆嵌入脚本 - 连续运行版
 * 直接通过HTTP API调用来处理
 * 处理完一组记忆后会休息，然后继续处理下一组
 */

import axios from 'axios';

// 端点配置
const SERVER_URL = 'https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev';

// 运行参数
const BATCH_SIZE = 2; // 每批处理数量
const BATCH_DELAY = 5000; // 两批之间的延迟（毫秒）
const ITEM_DELAY = 2000; // 每个记忆之间的延迟（毫秒）
const LIMIT_PER_REQUEST = 10; // 每次获取缺失嵌入的记忆数量

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
    return { success: 0, fail: 0 };
  }
  
  log(`将处理 ${memories.length} 条记忆记录，每批 ${batchSize} 条，批次间隔 ${delay}ms`, 'info');
  
  let successCount = 0;
  let failCount = 0;
  
  // 只处理指定数量的记忆
  const processCount = Math.min(memories.length, batchSize);
  const batchMemories = memories.slice(0, processCount);
  
  log(`\n开始处理这一批（${batchMemories.length} 条记录）`, 'info');
  
  // 处理每个记忆
  for (let i = 0; i < batchMemories.length; i++) {
    const memory = batchMemories[i];
    log(`处理记忆 [${i + 1}/${batchMemories.length}]: ${memory.id}`, 'info');
    
    const success = await processMemory(memory.id);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // 同一批次内的记录处理间隔等待
    if (i < batchMemories.length - 1) {
      log(`等待 ${ITEM_DELAY/1000} 秒后处理下一个...`, 'info');
      await new Promise(resolve => setTimeout(resolve, ITEM_DELAY));
    }
  }
  
  log(`\n===== 批次处理完成 =====`, 'info');
  log(`成功: ${successCount} 条`, 'success');
  log(`失败: ${failCount} 条`, 'error');
  
  return { success: successCount, fail: failCount };
}

/**
 * 处理所有记忆的主函数
 */
async function processAllMemories() {
  let totalSuccess = 0;
  let totalFail = 0;
  let batchCount = 0;
  
  log(`===== 开始持续处理缺失向量嵌入的记忆 =====`, 'info');
  
  while (true) {
    batchCount++;
    log(`\n------- 开始处理第 ${batchCount} 轮记忆 -------`, 'info');
    
    // 获取缺失嵌入的记忆列表
    const memories = await getMissingEmbeddings(LIMIT_PER_REQUEST);
    
    if (memories.length === 0) {
      log('没有找到缺失嵌入的记忆，处理完成', 'success');
      break;
    }
    
    // 分批处理记忆
    const result = await processBatch(memories, BATCH_SIZE, ITEM_DELAY);
    
    totalSuccess += result.success;
    totalFail += result.fail;
    
    // 显示处理进度
    log(`\n总进度 - 成功: ${totalSuccess} 条, 失败: ${totalFail} 条, 共计: ${totalSuccess + totalFail} 条`, 'info');
    
    // 批次间等待
    log(`等待 ${BATCH_DELAY/1000} 秒后处理下一批...`, 'info');
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
  }
  
  log(`\n===== 全部记忆处理完成 =====`, 'success');
  log(`成功: ${totalSuccess} 条`, 'success');
  log(`失败: ${totalFail} 条`, 'error');
  log(`总计: ${totalSuccess + totalFail} 条`, 'info');
}

// 执行主函数
processAllMemories().catch(error => {
  log(`脚本执行出错: ${error.message}`, 'error');
});
