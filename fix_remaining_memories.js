/**
 * 修复剩余记忆向量嵌入脚本
 * 手动处理特定的记忆ID，为其生成向量嵌入
 */

import axios from 'axios';
import { readFileSync } from 'fs';

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
 * 使用Python嵌入服务生成向量嵌入
 * 直接调用Python脚本，而不是启动服务
 */
async function generateEmbedding(text) {
  try {
    const url = '/api/embedding/embed';
    log(`生成嵌入向量，文本长度: ${text.length}`, 'info');
    
    const response = await api.post(url, { text });
    
    if (response.status === 200 && response.data && response.data.success) {
      const embedding = response.data.embedding;
      log(`成功生成嵌入向量，维度: ${embedding.length}`, 'success');
      return embedding;
    }
    
    log(`生成嵌入向量失败: ${JSON.stringify(response.data)}`, 'error');
    return null;
  } catch (error) {
    log(`生成嵌入向量时出错: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 将向量嵌入保存到数据库
 */
async function saveMemoryEmbedding(memoryId, vectorData) {
  try {
    const url = `/api/embedding/process-memory/${memoryId}`;
    log(`保存记忆 ${memoryId} 的嵌入向量`, 'info');
    
    const response = await api.post(url);
    
    if (response.status === 200 && response.data && response.data.success) {
      log(`成功保存记忆 ${memoryId} 的嵌入向量，维度: ${response.data.dimensions}`, 'success');
      return true;
    }
    
    log(`保存记忆 ${memoryId} 的嵌入向量失败: ${JSON.stringify(response.data)}`, 'error');
    return false;
  } catch (error) {
    log(`保存记忆 ${memoryId} 的嵌入向量时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 处理特定记忆ID
 */
async function processMemory(memoryId) {
  try {
    log(`开始处理记忆 ${memoryId}`, 'info');
    
    // 直接调用处理API
    const result = await saveMemoryEmbedding(memoryId);
    
    if (result) {
      log(`记忆 ${memoryId} 成功处理完成`, 'success');
    } else {
      log(`记忆 ${memoryId} 处理失败`, 'error');
    }
    
    return result;
  } catch (error) {
    log(`处理记忆 ${memoryId} 时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  log('=== 开始处理特定记忆ID ===', 'info');
  
  try {
    // 手动指定特定记忆ID
    const specificMemoryIds = ['20250501054926733532', '20250430111346433553', 'test-1745747812345'];
    log(`将手动处理 ${specificMemoryIds.length} 条指定的记忆ID`, 'info');
    
    // 处理每个指定的记忆ID
    for (const memoryId of specificMemoryIds) {
      log(`\n开始处理记忆: ${memoryId}`, 'info');
      await processMemory(memoryId);
      log('等待 5 秒再处理下一条...', 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 获取缺失嵌入的记忆列表
    const response = await api.get('/api/embedding/missing-embeddings?limit=5');
    
    if (response.status === 200 && response.data && response.data.success) {
      const memories = response.data.memories || [];
      log(`找到 ${memories.length} 条缺失嵌入的记忆记录`, 'info');
      
      if (memories.length === 0) {
        log('所有记忆已有嵌入向量，无需处理', 'success');
        return;
      }
      
      // 处理每条记忆
      for (const memory of memories) {
        log(`\n开始处理记忆: ${memory.id}`, 'info');
        await processMemory(memory.id);
        log('等待 5 秒再处理下一条...', 'info');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      log('\n处理完成！', 'success');
    } else {
      log(`获取记忆列表失败: ${JSON.stringify(response.data)}`, 'error');
    }
  } catch (error) {
    log(`脚本运行时出错: ${error.message}`, 'error');
  }
}

// 运行脚本
main().catch(e => log(`脚本运行时遇到错误: ${e.message}`, 'error'));