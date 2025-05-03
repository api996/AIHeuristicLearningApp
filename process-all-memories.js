/**
 * 批量处理记忆嵌入脚本 - 连续运行版
 * 直接通过HTTP API调用来处理
 * 处理完一组记忆后会休息，然后继续处理下一组
 */

import axios from 'axios';
import { readFileSync } from 'fs';
import { parse } from 'cookie';

// 服务器URL
const SERVER_URL = 'https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev';

// 日志颜色
const colors = {
  info: '\x1b[36m',    // 青色
  success: '\x1b[32m', // 绿色
  warning: '\x1b[33m', // 黄色
  error: '\x1b[31m',   // 红色
  reset: '\x1b[0m',    // 重置颜色
};

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

// 管理员凭证
// 尝试从本地cookie文件读取认证信息
let sessionCookie = '';
try {
  const cookieData = readFileSync('./cookie.txt', 'utf8');
  if (cookieData) {
    // 提取connect.sid cookie - Netscape格式
    const match = cookieData.match(/connect\.sids%3A([^\s\n.]+)\./);
    if (match && match[1]) {
      // 正确格式化cookie
      sessionCookie = `connect.sid=s%3A${match[1]}`;
      log(`成功读取会话cookie: ${sessionCookie.substring(0, 20)}...`, 'success');
    } else {
      log('无法从文件中提取cookie，将使用确切的cookie值', 'warning');
      // 直接使用磁盘上的cookie值
      sessionCookie = 'connect.sid=s%3AQcJnjiWGcu6ZQGzI_bTX-OnCi5Oe8ghz.aqy4m6fup9eTrhv03BfrQtg0XvHV4HSpHhi6HCXwnc4';
      log(`使用预定义cookie: ${sessionCookie.substring(0, 20)}...`, 'info');
    }
  }
} catch (error) {
  log(`无法读取cookie文件: ${error.message}`, 'warning');
}

// 创建axios实例并配置cookie
const api = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'Cookie': sessionCookie,
  }
});

/**
 * 获取缺失嵌入的记忆列表
 */
async function getMissingEmbeddings(limit = 10) {
  try {
    const url = `/api/embedding/missing-embeddings?limit=${limit}`;
    log(`请求缺失嵌入的记忆列表: ${SERVER_URL}${url}`, 'info');
    
    const response = await api.get(url);
    
    if (response.status === 200 && response.data && response.data.success) {
      const memories = response.data.memories || [];
      log(`找到 ${memories.length} 条缺失嵌入的记忆记录`, 'info');
      return memories;
    }
    
    log(`获取记忆列表失败: ${JSON.stringify(response.data)}`, 'error');
    return [];
  } catch (error) {
    log(`获取记忆列表错误: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 处理单个记忆
 */
async function processMemory(memoryId) {
  try {
    const url = `/api/embedding/process-memory/${memoryId}`;
    log(`处理记忆 ${memoryId}, 请求URL: ${SERVER_URL}${url}`, 'info');
    
    const response = await api.post(url);
    
    if (response.status === 200 && response.data && response.data.success) {
      log(`成功处理记忆 ${memoryId}, 维度: ${response.data.dimensions || 3072}`, 'success');
      return true;
    }
    
    log(`处理记忆 ${memoryId} 失败: ${JSON.stringify(response.data)}`, 'error');
    return false;
  } catch (error) {
    log(`处理记忆 ${memoryId} 时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 分批处理记忆
 */
async function processBatch(memories, batchSize = 5, delay = 3000) {
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < memories.length; i += batchSize) {
    const batch = memories.slice(i, i + batchSize);
    log(`处理批次 ${Math.floor(i/batchSize)+1}/${Math.ceil(memories.length/batchSize)}...`, 'info');
    
    for (const memory of batch) {
      log(`处理记忆 ${memory.id}...`, 'info');
      const success = await processMemory(memory.id);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // 为了减轻服务器负担，每次处理之后等待更长时间
      // 在处理记忆之后等待 5 秒
      log(`完成处理，等待 5 秒再继续下一个记忆...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 如果还有更多批次要处理，则等待一段时间
    if (i + batchSize < memories.length) {
      log(`批次处理完成，等待 ${delay/1000} 秒后继续...`, 'info');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return { successCount, failCount };
}

/**
 * 处理所有记忆的主函数
 */
async function processAllMemories() {
  let totalSuccess = 0;
  let totalFail = 0;
  let batchNumber = 1;
  
  while (true) {
    log(`=== 开始处理第 ${batchNumber} 组记忆 ===`, 'info');
    
    // 每组只获取10条记忆
    const memories = await getMissingEmbeddings(10);
    
    if (memories.length === 0) {
      log('没有找到需要处理的记忆，所有记忆已处理完毕', 'success');
      break;
    }
    
    log(`准备处理第 ${batchNumber} 组记忆，共 ${memories.length} 条，每批处理2条，批次间隔延15秒`, 'info');
    
    // 分批处理记忆，每批只奇2条，批次之间等待更长时间
    const result = await processBatch(memories, 2, 15000);
    
    totalSuccess += result.successCount;
    totalFail += result.failCount;
    
    log(`
=== 第 ${batchNumber} 组处理完成 ===
本组成功: ${result.successCount}
本组失败: ${result.failCount}
总处理成功: ${totalSuccess}
总处理失败: ${totalFail}
总处理: ${totalSuccess + totalFail}
`, 'success');
    
    // 每完成一组处理，休息30秒
    log(`休息30秒后继续处理下一组记忆...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    batchNumber++;
  }
  
  log(`
=== 所有记忆处理完成 ===
总成功: ${totalSuccess}
总失败: ${totalFail}
总处理: ${totalSuccess + totalFail}
`, 'success');
}

// 运行脚本
processAllMemories().catch(e => log(`脚本运行时遇到错误: ${e.message}`, 'error'));