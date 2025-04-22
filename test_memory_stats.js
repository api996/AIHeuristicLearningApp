/**
 * 记忆系统状态检查脚本
 * 检查现有记忆记录、向量嵌入、聚类和学习路径的状态
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

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
 * 检查用户记忆系统状态
 */
async function checkMemorySystemStatus(userId = 6) {
  log(`开始检查用户 ID=${userId} 的记忆系统状态...`);

  try {
    // 1. 检查总记忆数量
    const memoriesResult = await pool.query(`
      SELECT COUNT(*) as count FROM memories
      WHERE user_id = $1
    `, [userId]);
    
    const totalMemories = memoriesResult.rows[0].count;
    log(`用户拥有 ${totalMemories} 条记忆记录`, 'success');

    // 2. 检查带有时间戳格式ID的记忆数量
    const timestampIdResult = await pool.query(`
      SELECT COUNT(*) as count FROM memories
      WHERE user_id = $1 AND id ~ '^[0-9]{18,22}$'
    `, [userId]);
    
    const timestampIdCount = timestampIdResult.rows[0].count;
    log(`时间戳格式ID的记忆数量: ${timestampIdCount}`, 'success');
    
    // 3. 检查向量嵌入数量
    const embeddingsResult = await pool.query(`
      SELECT COUNT(*) as count FROM memory_embeddings me
      JOIN memories m ON me.memory_id = m.id
      WHERE m.user_id = $1
    `, [userId]);
    
    const embeddingsCount = embeddingsResult.rows[0].count;
    log(`向量嵌入数量: ${embeddingsCount}`, 'success');
    
    if (totalMemories > 0) {
      // 4. 检查最近添加的记忆
      const recentMemoriesResult = await pool.query(`
        SELECT id, type, substring(content, 1, 60) as preview, created_at
        FROM memories
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [userId]);
      
      log('最近添加的5条记忆:');
      recentMemoriesResult.rows.forEach((memory, index) => {
        log(`  ${index + 1}. ID: ${memory.id.substring(0, 12)}..., 类型: ${memory.type}`);
        log(`     预览: ${memory.preview.replace(/\n/g, ' ')}...`);
        log(`     时间: ${new Date(memory.created_at).toLocaleString()}`);
      });
    }
    
    // 5. 检查向量嵌入维度
    if (embeddingsCount > 0) {
      const sampleEmbeddingResult = await pool.query(`
        SELECT memory_id, vector_data
        FROM memory_embeddings
        LIMIT 1
      `);
      
      if (sampleEmbeddingResult.rows.length > 0) {
        const sample = sampleEmbeddingResult.rows[0];
        const dimensions = sample.vector_data ? sample.vector_data.length : '未知';
        log(`向量嵌入维度: ${dimensions}`);
      }
    }
    
    log('记忆系统状态检查完成', 'success');
  } catch (error) {
    log(`检查记忆系统状态时出错: ${error.message}`, 'error');
  } finally {
    await pool.end();
  }
}

// 执行检查
checkMemorySystemStatus();