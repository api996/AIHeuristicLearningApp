/**
 * 简单记忆创建与跟踪测试
 * 创建一条记忆并检查是否会自动完成后续处理步骤
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fetch from 'node-fetch';

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
  const memoryContent = `理解JavaScript变量提升(hoisting)很重要：变量和函数声明会在编译阶段被放入内存中，
  但是只有声明会被提升，赋值操作不会被提升。例如:
  
  console.log(x); // 输出: undefined
  var x = 5;
  
  上面的代码等价于:
  
  var x;
  console.log(x); // 输出: undefined
  x = 5;
  
  但如果使用let或const，则会报错，因为它们不会被提升:
  
  console.log(y); // 抛出ReferenceError
  let y = 10;
  
  这就是为什么推荐使用let和const而不是var，它们可以帮助避免变量提升带来的混乱。`;
  
  try {
    // 直接通过API创建记忆
    log(`正在创建记忆，ID: ${memoryId}`);
    
    const apiUrl = 'http://localhost:5000/api/memories';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        memoryId,
        content: memoryContent,
        type: 'note',
        timestamp
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API错误: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    log(`通过API成功创建记忆: ${JSON.stringify(data)}`, 'success');
    return { memoryId, userId };
  } catch (error) {
    // 如果API方式失败，尝试直接插入数据库
    log(`API创建失败，尝试数据库直接插入: ${error.message}`, 'warning');
    
    try {
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
 */
async function runTest() {
  log('======= 开始简单记忆流程测试 =======', 'info');
  
  try {
    // 创建记忆
    const { memoryId, userId } = await createSimpleMemory();
    
    // 等待向量嵌入生成
    const hasEmbedding = await waitForEmbedding(memoryId, 60); // 等待最多60秒
    
    if (hasEmbedding) {
      log(`记忆系统流程成功：记忆创建➝向量嵌入生成`, 'success');
    } else {
      log(`记忆流程部分成功：记忆已创建，但向量嵌入未自动生成`, 'warning');
      
      // 检查向量嵌入生成服务是否运行
      log(`检查系统中的向量嵌入服务状态...`);
      const serviceQuery = await pool.query(`
        SELECT value FROM system_config WHERE key = 'embedding_service_enabled'
      `);
      
      if (serviceQuery.rows.length > 0) {
        log(`向量嵌入服务状态: ${serviceQuery.rows[0].value}`);
      } else {
        log(`未找到向量嵌入服务配置信息`, 'warning');
      }
      
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
        log(`记忆总数: ${stats.total_memories}, 向量嵌入总数: ${stats.total_embeddings}`);
        log(`还有 ${stats.total_memories - stats.total_embeddings} 条记忆缺少向量嵌入`);
      }
    }
    
    log('======= 简单记忆流程测试完成 =======', 'success');
  } catch (error) {
    log(`测试过程中出错: ${error.message}`, 'error');
  } finally {
    await pool.end();
  }
}

// 执行测试
runTest();