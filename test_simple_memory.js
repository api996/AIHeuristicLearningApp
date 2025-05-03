/**
 * 简单记忆创建与跟踪测试
 * 创建一条记忆并检查是否会自动完成后续处理步骤
 * 
 * 说明：
 * 1. 本脚本直接向数据库插入记忆记录
 * 2. 检查向量嵌入是否自动生成（通常需要等待定时任务执行，约5分钟）
 * 3. 如果需要立即生成向量嵌入，脚本会手动触发向量嵌入生成进程
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { exec } from 'child_process';

// 配置数据库连接
if (!process.env.DATABASE_URL) {
  throw new Error("需要设置DATABASE_URL环境变量");
}

// 初始化数据库连接
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${reset}`);
}

/**
 * 生成与系统中匹配的时间戳ID格式
 */
function generateTimestampId() {
  const now = new Date();
  
  // 格式: YYYYMMDDHHmmssXXXXXX (年月日时分秒+6位随机数)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}${random}`;
}

/**
 * 创建一条简单记忆
 */
async function createSimpleMemory() {
  const userId = 6; // 使用ID=6的用户
  const timestamp = new Date().toISOString();
  const memoryId = generateTimestampId();
  
  // 创建一条简单且有教育价值的记忆内容
  const memoryContent = `理解记忆系统架构很重要：记忆数据使用向量嵌入表示，可以通过余弦相似度等方法计算语义相似度。
  
  记忆处理流程包括：
  1. 创建记忆记录并保存到数据库
  2. 定时任务检测未处理的记忆并生成向量嵌入
  3. 利用向量嵌入进行聚类分析，发现知识主题
  4. 基于聚类结果生成学习轨迹和知识图谱
  
  这种基于向量的记忆表示方法能够捕捉文本的语义信息，远优于简单的关键词匹配或标签分类方法。`;
  
  try {
    // 直接插入数据库（我们已知API方式不可用）
    log(`正在创建记忆，ID: ${memoryId}`);
    
    await pool.query(`
      INSERT INTO memories (id, user_id, content, type, timestamp, created_at) 
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [memoryId, userId, memoryContent, 'note', timestamp]);
    
    log(`数据库直接插入成功，ID: ${memoryId}`, 'success');
    return { memoryId, userId };
  } catch (dbError) {
    log(`数据库插入失败: ${dbError.message}`, 'error');
    throw dbError;
  }
}

/**
 * 手动触发向量嵌入生成
 */
async function triggerVectorEmbeddingGeneration() {
  log('手动触发向量嵌入生成处理...');
  
  return new Promise((resolve, reject) => {
    const scriptPath = './server/generate_vector_embeddings.js';
    const embedProcess = exec(`node ${scriptPath}`, {
      timeout: 30000, // 30秒超时
    });
    
    let output = '';
    
    embedProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      output += message + '\n';
      log(`[向量嵌入生成] ${message}`);
    });
    
    embedProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      log(`[向量嵌入生成错误] ${message}`, 'error');
    });
    
    embedProcess.on('close', (code) => {
      if (code === 0) {
        log('向量嵌入生成处理成功完成', 'success');
        resolve(true);
      } else {
        log(`向量嵌入生成处理失败，退出码: ${code}`, 'error');
        reject(new Error(`向量嵌入生成失败，退出码: ${code}`));
      }
    });
    
    embedProcess.on('error', (error) => {
      log(`执行向量嵌入生成脚本时出错: ${error.message}`, 'error');
      reject(error);
    });
  });
}

/**
 * 等待并检查向量嵌入生成
 */
async function waitForEmbedding(memoryId, maxWaitTimeSeconds = 30) {
  log(`等待记忆ID ${memoryId} 的向量嵌入生成，最长等待${maxWaitTimeSeconds}秒...`);
  
  const startTime = Date.now();
  const maxWaitTime = maxWaitTimeSeconds * 1000;
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // 检查向量嵌入是否存在
      const result = await pool.query(`
        SELECT memory_id, vector_data FROM memory_embeddings 
        WHERE memory_id = $1
      `, [memoryId]);
      
      if (result.rows.length > 0) {
        const embedding = result.rows[0];
        const vectorLength = embedding.vector_data ? embedding.vector_data.length : "未知";
        log(`向量嵌入已生成! 维度: ${vectorLength}`, 'success');
        return true;
      }
      
      // 等待2秒再次检查
      log(`向量嵌入尚未生成，已等待${Math.round((Date.now() - startTime) / 1000)}秒...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      log(`检查向量嵌入时出错: ${error.message}`, 'error');
      return false;
    }
  }
  
  log(`等待超时，向量嵌入在${maxWaitTimeSeconds}秒内未生成`, 'warning');
  return false;
}

/**
 * 主测试函数
 * @param {boolean} forceEmbedding 是否强制手动触发向量嵌入生成
 */
async function runTest(forceEmbedding = true) {
  log('======= 开始简单记忆流程测试 =======', 'info');
  
  try {
    // 创建记忆
    const { memoryId, userId } = await createSimpleMemory();
    log(`已创建新记忆，ID: ${memoryId}`, 'info');
    
    // 第一次检查：等待自动向量嵌入生成（等待短时间）
    log('首先等待短时间，检查是否自动生成向量嵌入...');
    const hasAutoEmbedding = await waitForEmbedding(memoryId, 15); // 等待15秒
    
    if (hasAutoEmbedding) {
      log(`记忆系统流程成功：记忆创建后向量嵌入自动生成`, 'success');
      log('======= 简单记忆流程测试完成 =======', 'success');
    } else {
      log(`未检测到自动生成的向量嵌入，这是正常的，因为定时任务每5分钟才会运行一次`, 'info');
      
      // 查看所有记忆的向量嵌入状态
      const statsQuery = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM memories WHERE user_id = $1) as total_memories,
          (SELECT COUNT(*) FROM memory_embeddings me 
           JOIN memories m ON me.memory_id = m.id 
           WHERE m.user_id = $1) as total_embeddings
      `, [userId]);
      
      if (statsQuery.rows.length > 0) {
        const stats = statsQuery.rows[0];
        log(`记忆统计 - 总数: ${stats.total_memories}, 向量嵌入总数: ${stats.total_embeddings}`);
        log(`还有 ${stats.total_memories - stats.total_embeddings} 条记忆缺少向量嵌入`);
      }
      
      // 如果设置了强制生成标志，则手动触发向量嵌入生成
      if (forceEmbedding) {
        log('开始手动触发向量嵌入生成...', 'info');
        
        try {
          await triggerVectorEmbeddingGeneration();
          
          // 检查是否已生成向量嵌入
          const hasEmbedding = await waitForEmbedding(memoryId, 10); // 再等待10秒
          
          if (hasEmbedding) {
            log(`手动触发向量嵌入生成成功!`, 'success');
          } else {
            log(`手动触发后仍未生成向量嵌入，这可能是由于脚本执行问题`, 'warning');
          }
        } catch (embedError) {
          log(`手动触发向量嵌入生成失败: ${embedError.message}`, 'error');
        }
      } else {
        log('跳过手动触发向量嵌入生成步骤', 'info');
      }
      
      log('======= 简单记忆流程测试完成 =======', 'info');
    }
  } catch (error) {
    log(`测试过程中出错: ${error.message}`, 'error');
  } finally {
    await pool.end();
  }
}

// 执行测试
// 参数true表示自动触发向量嵌入生成，设为false则只创建记忆，不触发生成
runTest(true);