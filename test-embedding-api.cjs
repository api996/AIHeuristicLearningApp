/**
 * 测试嵌入API脚本
 */

const { Pool } = require('@neondatabase/serverless');
const ws = require('ws');
const axios = require('axios');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 配置数据库连接
// 必须显式设置WebSocket构造函数
const neonConfig = require('@neondatabase/serverless');
neonConfig.neonConfig.webSocketConstructor = ws;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10
});

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m',   // 红色
    reset: '\x1b[0m',    // 重置颜色
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 获取缺失嵌入的记忆列表
 */
async function getMemoriesWithoutEmbeddings(limit = 10) {
  try {
    const query = `
      SELECT m.id, m.content, m.user_id, m.type
      FROM memories m
      WHERE NOT EXISTS (
        SELECT 1 FROM memory_embeddings me 
        WHERE me.memory_id = m.id
      )
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    log(`找到 ${result.rows.length} 条缺失嵌入的记忆记录`, 'info');
    return result.rows;
  } catch (err) {
    log(`查询记忆时出错: ${err.message}`, 'error');
    return [];
  }
}

/**
 * 为单个记忆生成嵌入向量
 */
async function processMemory(memoryId) {
  try {
    const url = 'https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev/api/embedding/process-memory/' + memoryId;
    log(`请求URL: ${url}`, 'info');
    
    const response = await axios.post(url);
    
    if (response.status === 200 && response.data && response.data.success) {
      log(`成功处理记忆 ${memoryId}`, 'success');
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
      
      // 为了减轻服务器负担，每次处理之后等待一下
      await new Promise(resolve => setTimeout(resolve, 500));
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
 * 主函数
 */
async function main() {
  log('=== 开始处理缺失嵌入的记忆 ===', 'info');
  
  try {
    // 获取缺少嵌入的记忆 (只处理前5条进行测试)
    const memories = await getMemoriesWithoutEmbeddings(5);
    
    if (memories.length === 0) {
      log('没有可处理的记忆', 'info');
      return;
    }
    
    // 分批处理记忆
    const result = await processBatch(memories, 5, 3000);
    
    log(`
=== 处理完成 ===
成功: ${result.successCount}
失败: ${result.failCount}
总处理: ${result.successCount + result.failCount}
`, 'success');
  } catch (error) {
    log(`脚本运行错误: ${error.message}`, 'error');
  } finally {
    // 关闭连接
    await pool.end();
  }
}

// 运行脚本
main().catch(e => log(`脚本运行时遇到错误: ${e.message}`, 'error'));
