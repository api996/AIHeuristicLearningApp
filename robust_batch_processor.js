/**
 * 健壮的记忆嵌入批处理脚本
 * 通过HTTP API持续处理缺失嵌入向量的记忆
 * 加强了错误处理、重试机制和进度报告
 */

import axios from 'axios';

// 端点配置
const SERVER_URL = 'https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev';

// 处理配置
const CONFIG = {
  BATCH_SIZE: 2,                 // 每批处理的记忆数量（较小值减轻服务器负担）
  LIMIT_PER_REQUEST: 5,          // 每次请求的最大记忆数量
  ITEM_DELAY: 8000,              // 同一批次内处理间隔（毫秒）
  BATCH_DELAY: 25000,            // 批次间隔（毫秒）
  RETRY_DELAY: 10000,            // 重试间隔（毫秒）
  MAX_RETRIES: 5,                // 最大重试次数
  PROGRESS_INTERVAL: 300000,     // 进度报告间隔（毫秒）- 5分钟
  CONTINUE_ON_ERROR: true,       // 出错时是否继续
  CHECK_INTERVAL: 180000,        // 处理完一批后检查新记忆的间隔（毫秒）- 3分钟
  RATE_LIMIT: 10                 // 每分钟最多处理的记忆数量
};

// 存储累计统计信息
const STATS = {
  totalProcessed: 0,
  totalSuccess: 0,
  totalFail: 0,
  startTime: Date.now(),
  lastProgressReport: Date.now(),
};

// 颜色格式化工具
const colors = {
  info: '\x1b[36m',    // 青色
  success: '\x1b[32m',  // 绿色
  warn: '\x1b[33m',     // 黄色
  error: '\x1b[31m',    // 红色
  highlight: '\x1b[35m', // 紫色
  reset: '\x1b[0m',     // 重置颜色
};

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

/**
 * 生成进度报告
 */
function generateProgressReport() {
  const now = Date.now();
  const elapsedMs = now - STATS.startTime;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
  
  const totalProcessed = STATS.totalSuccess + STATS.totalFail;
  const successRate = totalProcessed > 0 ? Math.round((STATS.totalSuccess / totalProcessed) * 100) : 0;
  
  log('\n===============================================', 'highlight');
  log('进度报告', 'highlight');
  log('===============================================', 'highlight');
  log(`运行时间: ${elapsedMinutes}分 ${elapsedSeconds}秒`, 'info');
  log(`总处理记忆: ${totalProcessed} 条`, 'info');
  log(`成功: ${STATS.totalSuccess} 条`, 'success');
  log(`失败: ${STATS.totalFail} 条`, 'error');
  log(`成功率: ${successRate}%`, totalProcessed > 0 ? 'success' : 'info');
  log('===============================================\n', 'highlight');
  
  // 更新最后报告时间
  STATS.lastProgressReport = now;
}

/**
 * 检查是否应生成进度报告
 */
function checkProgressReport() {
  const now = Date.now();
  if (now - STATS.lastProgressReport >= CONFIG.PROGRESS_INTERVAL) {
    generateProgressReport();
    return true;
  }
  return false;
}

/**
 * 获取缺失嵌入的记忆列表（带重试机制）
 */
async function getMissingEmbeddings(limit = CONFIG.LIMIT_PER_REQUEST) {
  let retries = 0;
  
  while (retries <= CONFIG.MAX_RETRIES) {
    try {
      if (retries > 0) {
        log(`尝试第 ${retries} 次重试获取缺失嵌入的记忆列表`, 'warn');
      }
      
      const url = `${SERVER_URL}/api/embedding/missing-embeddings?limit=${limit}`;
      log(`请求缺失嵌入的记忆列表: ${url}`, 'info');
      
      const response = await axios.get(url);
      
      if (response.status === 200 && response.data.success) {
        const memories = response.data.memories || [];
        log(`发现 ${memories.length} 个缺失嵌入的记忆`, 'success');
        return memories;
      }
      
      log(`获取缺失嵌入列表失败: ${JSON.stringify(response.data)}`, 'error');
      
      // 如果已达到最大重试次数，则返回空列表
      if (retries >= CONFIG.MAX_RETRIES) {
        log(`已达到最大重试次数 ${CONFIG.MAX_RETRIES}，无法获取缺失嵌入列表`, 'error');
        return [];
      }
      
      // 否则等待后重试
      retries++;
      log(`将在 ${CONFIG.RETRY_DELAY/1000} 秒后重试获取缺失嵌入列表...`, 'warn');
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
    } catch (error) {
      log(`获取缺失嵌入列表错误: ${error.message}`, 'error');
      
      // 如果已达到最大重试次数，则返回空列表
      if (retries >= CONFIG.MAX_RETRIES) {
        log(`已达到最大重试次数 ${CONFIG.MAX_RETRIES}，无法获取缺失嵌入列表`, 'error');
        return [];
      }
      
      // 否则等待后重试
      retries++;
      log(`将在 ${CONFIG.RETRY_DELAY/1000} 秒后重试获取缺失嵌入列表...`, 'warn');
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
    }
  }
  
  return []; // 如果执行到这里，说明所有重试都失败了
}

/**
 * 处理单个记忆（带重试机制）
 */
async function processMemory(memoryId) {
  let retries = 0;
  
  while (retries <= CONFIG.MAX_RETRIES) {
    try {
      if (retries > 0) {
        log(`尝试第 ${retries} 次重试处理记忆 ${memoryId}`, 'warn');
      } else {
        log(`开始处理记忆 ${memoryId}`, 'info');
      }
      
      const url = `${SERVER_URL}/api/embedding/process-memory/${memoryId}`;
      const response = await axios.post(url);
      
      if (response.status === 200 && response.data.success) {
        log(`记忆 ${memoryId} 处理成功, 维度: ${response.data.dimensions || 3072}`, 'success');
        return true;
      } else {
        log(`处理记忆 ${memoryId} 失败: ${JSON.stringify(response.data)}`, 'error');
        
        // 如果已达到最大重试次数，则放弃
        if (retries >= CONFIG.MAX_RETRIES) {
          log(`已达到最大重试次数 ${CONFIG.MAX_RETRIES}，放弃处理记忆 ${memoryId}`, 'error');
          return false;
        }
        
        // 否则等待后重试
        retries++;
        log(`将在 ${CONFIG.RETRY_DELAY/1000} 秒后重试...`, 'warn');
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        continue;
      }
    } catch (error) {
      log(`处理记忆 ${memoryId} 时出错: ${error.message}`, 'error');
      
      // 如果已达到最大重试次数，则放弃
      if (retries >= CONFIG.MAX_RETRIES) {
        log(`已达到最大重试次数 ${CONFIG.MAX_RETRIES}，放弃处理记忆 ${memoryId}`, 'error');
        return false;
      }
      
      // 否则等待后重试
      retries++;
      log(`将在 ${CONFIG.RETRY_DELAY/1000} 秒后重试...`, 'warn');
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
    }
  }
  
  return false; // 如果执行到这里，说明所有重试都失败了
}

/**
 * 分批处理记忆
 */
async function processBatch(memories, batchSize = CONFIG.BATCH_SIZE) {
  if (!memories || memories.length === 0) {
    log('没有记忆需要处理', 'warn');
    return { success: 0, fail: 0 };
  }
  
  log(`将处理 ${memories.length} 条记忆记录，每批 ${batchSize} 条，批次间隔 ${CONFIG.ITEM_DELAY}ms`, 'info');
  
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
      STATS.totalSuccess++;
    } else {
      failCount++;
      STATS.totalFail++;
    }
    
    // 同一批次内的记录处理间隔等待
    if (i < batchMemories.length - 1) {
      log(`等待 ${CONFIG.ITEM_DELAY/1000} 秒后处理下一个...`, 'info');
      await new Promise(resolve => setTimeout(resolve, CONFIG.ITEM_DELAY));
    }
  }
  
  log(`\n===== 批次处理完成 =====`, 'info');
  log(`成功: ${successCount} 条`, 'success');
  log(`失败: ${failCount} 条`, 'error');
  
  return { success: successCount, fail: failCount };
}

/**
 * 持续处理所有记忆的主函数
 */
async function processAllMemories() {
  let batchCount = 0;
  let lastMemoryCount = 0;
  let emptyRequestsInARow = 0;
  
  log(`===== 开始持续处理缺失向量嵌入的记忆 =====`, 'highlight');
  log(`使用配置: 每批次${CONFIG.BATCH_SIZE}条记忆，批次间隔${CONFIG.BATCH_DELAY/1000}秒，最大重试${CONFIG.MAX_RETRIES}次`, 'info');
  
  STATS.startTime = Date.now();
  STATS.lastProgressReport = Date.now();
  
  while (true) {
    batchCount++;
    log(`\n------- 开始处理第 ${batchCount} 轮记忆 -------`, 'info');
    
    // 检查是否需要生成进度报告
    checkProgressReport();
    
    // 获取缺失嵌入的记忆列表
    const memories = await getMissingEmbeddings(CONFIG.LIMIT_PER_REQUEST);
    
    if (memories.length === 0) {
      log('没有找到缺失嵌入的记忆，等待后重新检查', 'warn');
      emptyRequestsInARow++;
      
      // 如果连续3次没有发现记忆，生成一次总结报告
      if (emptyRequestsInARow >= 3) {
        log('已连续3次未发现缺失嵌入的记忆，生成最终报告', 'warn');
        generateProgressReport();
        log('处理完成，脚本将退出', 'success');
        break;
      }
      
      // 等待一段时间后重新检查是否有新记忆需要处理
      log(`等待 ${CONFIG.CHECK_INTERVAL/1000} 秒后重新检查...`, 'info');
      await new Promise(resolve => setTimeout(resolve, CONFIG.CHECK_INTERVAL));
      continue;
    }
    
    // 重置空请求计数
    emptyRequestsInARow = 0;
    
    // 分批处理记忆
    await processBatch(memories, CONFIG.BATCH_SIZE);
    
    // 显示批次间隔信息
    log(`等待 ${CONFIG.BATCH_DELAY/1000} 秒后处理下一批...`, 'info');
    await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  log(`未捕获的异常: ${error.message}`, 'error');
  log(`${error.stack}`, 'error');
  // 生成最后的进度报告
  generateProgressReport();
});

// 处理Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  log(`未处理的Promise拒绝: ${reason}`, 'error');
  // 生成最后的进度报告
  generateProgressReport();
});

// 执行主函数
processAllMemories().catch(error => {
  log(`脚本执行出错: ${error.message}`, 'error');
  // 生成最后的进度报告
  generateProgressReport();
});
