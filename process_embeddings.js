/**
 * 记忆嵌入向量批处理脚本
 * 使用方法：
 * node process_embeddings.js --batch-size 10 --batch-delay 60000
 */

// 引入必要的模块
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

// 加载环境变量
dotenv.config();

// 配置数据库连接
neonConfig.webSocketConstructor = ws;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}
const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * 解析命令行参数
 */
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    batchSize: 10,      // 默认每批处琅10条记录
    batchDelay: 60000,  // 默认批次间隔1分钟 (60000ms)
    maxBatches: 5       // 最多处琅5批，以避免脚本运行时间过长
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--batch-size' && i + 1 < args.length) {
      const size = parseInt(args[i + 1]);
      if (!isNaN(size) && size > 0) {
        options.batchSize = size;
      }
      i++;
    } else if (arg === '--batch-delay' && i + 1 < args.length) {
      const delay = parseInt(args[i + 1]);
      if (!isNaN(delay) && delay >= 0) {
        options.batchDelay = delay;
      }
      i++;
    } else if (arg === '--max-batches' && i + 1 < args.length) {
      const maxBatches = parseInt(args[i + 1]);
      if (!isNaN(maxBatches) && maxBatches > 0) {
        options.maxBatches = maxBatches;
      }
      i++;
    }
  }

  return options;
}

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
 * 获取没有向量嵌入的记忆记录
 */
async function getMemoriesWithoutEmbeddings(limit) {
  const query = `
    SELECT m.id, m.content, m.user_id
    FROM memories m
    WHERE NOT EXISTS (
      SELECT 1 FROM memory_embeddings me 
      WHERE me.memory_id = m.id
    )
    LIMIT $1
  `;
  
  try {
    const result = await pool.query(query, [limit]);
    log(`找到 ${result.rows.length} 条缺失嵌入的记忆记录`, 'info');
    return result.rows;
  } catch (err) {
    log(`查询记忆时出错: ${err.message}`, 'error');
    return [];
  }
}

/**
 * 生成向量嵌入 - 使用Python嵌入服务
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    log('无法为空文本生成嵌入', 'warning');
    return null;
  }

  try {
    // 清理文本，移除多余空白并截断
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    const truncatedText = cleanedText.length > 8000 
      ? cleanedText.substring(0, 8000)
      : cleanedText;
    
    log('使用Python嵌入服务生成语义向量嵌入', 'info');
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['server/services/embedding.py', '--text', truncatedText]);
      
      let outputData = '';
      let errorData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        log(`Python嵌入服务错误: ${data.toString()}`, 'error');
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`Python嵌入服务异常退出，代码: ${code}`, 'error');
          reject(new Error(`Python进程异常退出: ${errorData}`));
          return;
        }
        
        try {
          const jsonStart = outputData.indexOf('{');
          const jsonEnd = outputData.lastIndexOf('}');
          
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const jsonStr = outputData.substring(jsonStart, jsonEnd + 1);
            const result = JSON.parse(jsonStr);
            
            if (result.success === false) {
              log(`Python嵌入服务报告错误: ${result.error}`, 'error');
              reject(new Error(result.error || '嵌入服务返回失败结果'));
              return;
            }
            
            if (result && result.embedding && Array.isArray(result.embedding)) {
              // 验证嵌入维度
              if (result.embedding.length !== 3072) {
                log(`警告: 嵌入维度异常 (${result.embedding.length}), 期望为3072维`, 'warning');
                reject(new Error(`嵌入维度不正确：${result.embedding.length}，期望为3072维`));
                return;
              }
              
              log(`成功生成${result.embedding.length}维语义向量嵌入`, 'success');
              resolve(result.embedding);
            } else {
              log('Python嵌入服务返回格式错误', 'error');
              reject(new Error('嵌入服务返回数据格式错误'));
            }
          } else {
            log('未找到有效的JSON输出', 'error');
            reject(new Error('Python服务未返回有效的JSON数据'));
          }
        } catch (error) {
          log(`解析嵌入结果出错: ${error.message}`, 'error');
          reject(error);
        }
      });
    });
  } catch (error) {
    log(`生成嵌入时出错: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return null;
  }
}

/**
 * 保存记忆的向量嵌入
 */
async function saveMemoryEmbedding(memoryId, vectorData) {
  try {
    await pool.query(
      'INSERT INTO memory_embeddings (memory_id, vector_data) VALUES ($1, $2)',
      [memoryId, JSON.stringify(vectorData)]
    );
    return true;
  } catch (error) {
    log(`保存记忆嵌入出错: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}

/**
 * 分批处理记忆记录
 */
async function processBatches(memories, batchSize, batchDelay, maxBatches) {
  let successCount = 0;
  let failCount = 0;
  
  // 分批处理记忆记录
  const totalBatches = Math.min(Math.ceil(memories.length / batchSize), maxBatches);
  const processLimit = Math.min(memories.length, batchSize * maxBatches);
  
  log(`将处理 ${processLimit}/${memories.length} 条记忆，分为 ${totalBatches} 批，每批 ${batchSize} 条`, 'info');
  
  for (let i = 0; i < processLimit; i += batchSize) {
    // 获取当前批次的记忆记录
    const batch = memories.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    log(`\n处理第 ${batchNumber}/${totalBatches} 批记忆记录 (${batch.length}条)`, 'info');
    
    // 处理当前批次中的每条记忆记录
    for (const memory of batch) {
      log(`处理记忆 ${memory.id}...`, 'info');
      
      try {
        // 生成向量嵌入
        const embedding = await generateEmbedding(memory.content);
        
        if (embedding) {
          // 保存向量嵌入
          const saveSuccess = await saveMemoryEmbedding(memory.id, embedding);
          
          if (saveSuccess) {
            log(`成功为记忆 ${memory.id} 生成并保存嵌入`, 'success');
            successCount++;
          } else {
            log(`为记忆 ${memory.id} 保存嵌入失败`, 'error');
            failCount++;
          }
        } else {
          log(`为记忆 ${memory.id} 生成嵌入失败`, 'error');
          failCount++;
        }
      } catch (error) {
        log(`处理记忆 ${memory.id} 时出错: ${error.message}`, 'error');
        failCount++;
      }
      
      // 记录条目之间添加小延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 如果不是最后一批，等待指定时间再处理下一批
    if (i + batchSize < processLimit) {
      const waitSeconds = batchDelay / 1000;
      log(`批次处理完成，等待 ${waitSeconds} 秒后处理下一批...`, 'info');
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  return { successCount, failCount, totalProcessed: successCount + failCount };
}

/**
 * 主函数
 */
async function main() {
  const options = parseCommandLineArgs();
  log(`=== 开始为缺失嵌入的记忆生成向量嵌入 ===`, 'info');
  log(`参数设置: 每批 ${options.batchSize} 条, 批间延迟 ${options.batchDelay/1000} 秒, 最大批次数 ${options.maxBatches}`, 'info');
  
  try {
    // 获取所有没有向量嵌入的记忆记录
    const allMemoriesCount = await pool.query(`
      SELECT COUNT(*) FROM memories m
      WHERE NOT EXISTS (SELECT 1 FROM memory_embeddings me WHERE me.memory_id = m.id)
    `);
    
    const totalCount = parseInt(allMemoriesCount.rows[0].count);
    log(`总共有 ${totalCount} 条记忆没有向量嵌入`, 'info');
    
    if (totalCount === 0) {
      log("没有需要处理的记忆记录", 'info');
      await pool.end();
      return;
    }
    
    // 获取需要处理的记忆记录，限制数量
    const fetchLimit = options.batchSize * options.maxBatches;
    const memories = await getMemoriesWithoutEmbeddings(fetchLimit);
    
    if (memories.length === 0) {
      log("未获取到记忆记录数据", 'error');
      await pool.end();
      return;
    }
    
    // 分批处理记忆记录
    const result = await processBatches(memories, options.batchSize, options.batchDelay, options.maxBatches);
    
    log(`
=== 记忆向量嵌入生成完成 ===
成功: ${result.successCount}
失败: ${result.failCount}
已处理: ${result.totalProcessed}
总计需处理: ${totalCount}
剩余未处理: ${totalCount - result.totalProcessed}
`, 'success');
    
  } catch (error) {
    log(`脚本执行失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 运行主函数
main().catch(e => log(`脚本执行异常: ${e instanceof Error ? e.message : String(e)}`, 'error'));
