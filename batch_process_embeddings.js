/**
 * 批量处理向量嵌入脚本
 * 直接调用API批量处理缺失向量嵌入的记忆
 */

import pg from 'pg';
import axios from 'axios';

// 创建数据库连接池
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

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

/**
 * 获取缺失嵌入向量的记忆ID列表
 */
async function getMissingEmbeddingIds(limit = 10) {
  const client = await pool.connect();
  
  try {
    const query = `
      SELECT m.id 
      FROM memories m 
      WHERE NOT EXISTS (
        SELECT 1 FROM memory_embeddings me 
        WHERE me.memory_id = m.id
      )
      LIMIT $1
    `;
    
    const result = await client.query(query, [limit]);
    return result.rows.map(row => row.id);
  } catch (error) {
    log(`获取缺失嵌入向量的记忆ID时出错: ${error.message}`, 'error');
    return [];
  } finally {
    client.release();
  }
}

/**
 * 处理单个记忆
 */
async function processMemory(memoryId) {
  try {
    log(`开始处理记忆 ${memoryId}`, 'info');
    
    // 调用API处理记忆
    const url = `https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev/api/embedding/process-memory/${memoryId}`;
    
    const response = await axios.post(url, {}, {
      headers: {
        'Cookie': 'connect.sid=s%3AQcJn...', // 使用有效的会话令牌
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.success) {
      log(`记忆 ${memoryId} 处理成功, 维度: ${response.data.dimensions || '未知'}`, 'success');
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
async function processBatch(memoryIds, batchSize = 2, delay = 15000) {
  const batches = [];
  
  // 将记忆ID列表拆分成小批次
  for (let i = 0; i < memoryIds.length; i += batchSize) {
    batches.push(memoryIds.slice(i, i + batchSize));
  }
  
  log(`记忆总数: ${memoryIds.length}, 拆分为 ${batches.length} 个批次处理, 每批处理 ${batchSize} 条`, 'info');
  
  let successCount = 0;
  let failCount = 0;
  
  // 逐个处理批次
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log(`\n开始处理第 ${i + 1}/${batches.length} 批记忆, 包含 ${batch.length} 条记忆`, 'info');
    
    // 并行处理批次中的记忆
    const results = await Promise.all(batch.map(memoryId => processMemory(memoryId)));
    
    // 统计成功和失败的数量
    const batchSuccess = results.filter(r => r).length;
    const batchFail = results.filter(r => !r).length;
    
    successCount += batchSuccess;
    failCount += batchFail;
    
    log(`批次 ${i + 1} 完成: 成功 ${batchSuccess} 条, 失败 ${batchFail} 条`, 'info');
    log(`总计: 成功 ${successCount} 条, 失败 ${failCount} 条, 进度 ${((i + 1) / batches.length * 100).toFixed(2)}%`, 'info');
    
    // 如果不是最后一个批次，等待指定时间
    if (i < batches.length - 1) {
      log(`等待 ${delay / 1000} 秒后处理下一批...`, 'info');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return { successCount, failCount, totalCount: memoryIds.length };
}

/**
 * 主函数
 */
async function main() {
  // 设置参数
  const batchSize = 4;        // 每批处理记忆数量
  const batchDelay = 10000;   // 批次间等待时间（毫秒）
  const processLimit = 40;    // 每次运行处理的记忆数量上限
  
  try {
    log(`=== 批量处理向量嵌入 ===`, 'info');
    log(`批大小: ${batchSize}, 批次间隔: ${batchDelay / 1000} 秒, 处理上限: ${processLimit} 条`, 'info');
    
    // 获取缺失向量嵌入的记忆ID
    const memoryIds = await getMissingEmbeddingIds(processLimit);
    
    if (memoryIds.length === 0) {
      log(`没有找到缺失向量嵌入的记忆`, 'success');
      return;
    }
    
    log(`找到 ${memoryIds.length} 条缺失向量嵌入的记忆`, 'info');
    
    // 分批处理记忆
    const result = await processBatch(memoryIds, batchSize, batchDelay);
    
    log(`\n处理完成!`, 'success');
    log(`总计: 成功 ${result.successCount} 条, 失败 ${result.failCount} 条, 总共 ${result.totalCount} 条`, 'success');
    log(`成功率: ${(result.successCount / result.totalCount * 100).toFixed(2)}%`, 'success');
    
  } catch (error) {
    log(`脚本运行时出错: ${error.message}`, 'error');
  } finally {
    // 关闭数据库连接池
    await pool.end();
  }
}

// 运行脚本
main().catch(error => log(`脚本运行时出错: ${error.message}`, 'error'));
