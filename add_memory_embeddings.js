/**
 * 为无向量的记忆添加基本向量嵌入
 * 针对所有没有向量嵌入的记忆记录，生成并添加基本的向量嵌入
 */

// 引入必要的模块
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 配置数据库连接
neonConfig.webSocketConstructor = ws;

// 使用环境变量中的数据库URL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// 配置连接池
const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m', // 重置颜色
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 获取所有没有向量嵌入的记忆记录
 */
async function getMemoriesWithoutEmbeddings() {
  const query = `
    SELECT m.id, m.content, m.user_id
    FROM memories m
    WHERE NOT EXISTS (
      SELECT 1 FROM memory_embeddings me 
      WHERE me.memory_id = m.id
    )
  `;
  
  try {
    const result = await pool.query(query);
    log(`找到 ${result.rows.length} 条缺失嵌入的记忆记录`, 'info');
    return result.rows;
  } catch (err) {
    log(`查询记忆时出错: ${err.message}`, 'error');
    return [];
  }
}

/**
 * 为内容为占位符的记忆生成默认内容
 */
async function updatePlaceholderContent(memoryId, userId) {
  try {
    // 为占位符内容生成实际内容
    const defaultContent = `用户 ${userId} 的记忆数据 ${memoryId}`;
    
    // 更新记忆内容
    await pool.query(
      'UPDATE memories SET content = $1 WHERE id = $2 AND content = $3',
      [defaultContent, memoryId, '从记忆文件导入的内容']
    );
    
    log(`已更新记忆 ${memoryId} 的占位符内容`, 'success');
    return defaultContent;
  } catch (err) {
    log(`更新记忆内容出错 (${memoryId}): ${err.message}`, 'error');
    return null;
  }
}

/**
 * 直接使用Python嵌入服务
 * 由于在脚本中导入TypeScript模块比较复杂，我们改用直接调用Python嵌入服务
 */
import { spawn } from 'child_process';
import { promisify } from 'util';

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
    
    log('使用Python嵌入服务生成真实语义向量嵌入', 'info');
    
    return new Promise((resolve, reject) => {
      // 创建一个临时文件来存储嵌入结果
      const pythonProcess = spawn('python3', ['server/services/embedding.py', '--text', truncatedText]);
      
      let outputData = '';
      let errorData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        // 只收集输出数据，不立即处理
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
        
        // 尝试找到有效的JSON输出
        try {
          const jsonStart = outputData.indexOf('{');
          const jsonEnd = outputData.lastIndexOf('}');
          
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            // 提取JSON部分
            const jsonStr = outputData.substring(jsonStart, jsonEnd + 1);
            log(`提取JSON部分: ${jsonStr.length} 字符`, 'info');
            
            try {
              // 解析JSON
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
                  // 如果维度不正确，抛出错误
                  throw new Error(`嵌入维度不正确：${result.embedding.length}，期望为3072维`);
                } else {
                  log(`成功生成${result.embedding.length}维语义向量嵌入`, 'success');
                }
                
                resolve(result.embedding);
              } else {
                log('Python嵌入服务返回格式错误', 'error');
                reject(new Error('嵌入服务返回数据格式错误'));
              }
            } catch (error) {
              log(`解析嵌入结果出错: ${error.message}`, 'error');
              reject(error);
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
 * @param {Array} memories 需要处理的记忆记录数组
 * @param {number} batchSize 每批处理的记录数
 * @param {number} batchDelay 批次间延迟毫秒数
 */
async function processBatches(memories, batchSize = 5, batchDelay = 60000) {
  let successCount = 0;
  let failCount = 0;
  
  // 分批处理记忆记录
  for (let i = 0; i < memories.length; i += batchSize) {
    // 获取当前批次的记忆记录
    const batch = memories.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(memories.length / batchSize);
    
    log(`处理第 ${batchNumber}/${totalBatches} 批记忆记录 (${batch.length}条)`, 'info');
    
    // 处理当前批次中的每条记忆记录
    for (const memory of batch) {
      log(`处理记忆 ${memory.id}...`, 'info');
      
      // 检查是否为占位符内容
      let content = memory.content;
      if (content === '从记忆文件导入的内容') {
        // 更新占位符内容
        const updatedContent = await updatePlaceholderContent(memory.id, memory.user_id);
        if (updatedContent) {
          content = updatedContent;
        }
      }
      
      // 生成向量嵌入
      const embedding = await generateEmbedding(content);
      
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
      
      // 记录条目之间添加小延迟
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // 如果不是最后一批，等待指定时间再处理下一批
    if (i + batchSize < memories.length) {
      const waitSeconds = batchDelay / 1000;
      log(`批次处理完成，等待 ${waitSeconds} 秒后处理下一批...`, 'info');
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  return { successCount, failCount };
}

/**
 * 主函数
 */
async function main() {
  log("=== 开始为缺失嵌入的记忆生成向量嵌入 ===", 'info');
  
  try {
    // 获取所有没有向量嵌入的记忆记录
    const memories = await getMemoriesWithoutEmbeddings();
    
    if (memories.length === 0) {
      log("没有需要处理的记忆记录", 'info');
      await pool.end();
      return;
    }
    
    // 分批处理记忆记录，每批5条，批次间等待60秒
    const { successCount, failCount } = await processBatches(memories, 5, 60000);
    
    log(`
=== 记忆向量嵌入生成完成 ===
成功: ${successCount}
失败: ${failCount}
总计: ${memories.length}
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