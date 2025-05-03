/**
 * 查找缺失向量嵌入的记忆
 * 直接使用SQL查询数据库来发现缺失向量嵌入的记忆
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
 * 缺失嵌入向量的记忆
 */
async function findMissingEmbeddings() {
  const client = await pool.connect();
  
  try {
    log('=== 查找缺失向量嵌入的记忆 ===', 'info');
    
    // 获取总记忆数
    const totalMemoriesResult = await client.query('SELECT COUNT(*) AS count FROM memories');
    const totalMemories = parseInt(totalMemoriesResult.rows[0].count);
    
    // 获取已有嵌入向量的记忆数
    const withEmbeddingsResult = await client.query('SELECT COUNT(*) AS count FROM memory_embeddings');
    const withEmbeddings = parseInt(withEmbeddingsResult.rows[0].count);
    
    log(`总记忆数: ${totalMemories}`, 'info');
    log(`已有嵌入向量的记忆数: ${withEmbeddings}`, 'info');
    log(`缺失嵌入向量的记忆数: ${totalMemories - withEmbeddings}`, 'info');
    log(`完成百分比: ${(withEmbeddings / totalMemories * 100).toFixed(2)}%`, 'success');
    
    // 获取缺失嵌入向量的记忆详细信息
    const missingEmbeddingsResult = await client.query(`
      SELECT m.id, m.user_id, m.content, m.timestamp, m.summary 
      FROM memories m 
      WHERE NOT EXISTS (
        SELECT 1 FROM memory_embeddings me 
        WHERE me.memory_id = m.id
      )
      ORDER BY m.timestamp DESC
    `);
    
    if (missingEmbeddingsResult.rows.length > 0) {
      log(`\n找到 ${missingEmbeddingsResult.rows.length} 条缺失嵌入向量的记忆:`, 'warning');
      
      missingEmbeddingsResult.rows.forEach((row, index) => {
        const content = row.content.length > 50 ? row.content.substring(0, 50) + '...' : row.content;
        log(`\n${index + 1}. 记忆ID: ${row.id}`, 'warning');
        log(`   用户ID: ${row.user_id}`, 'info');
        log(`   时间戳: ${row.timestamp}`, 'info');
        log(`   内容: ${content}`, 'info');
        log(`   摘要: ${row.summary || '无摘要'}`, 'info');
      });
      
      // 尝试直接处理第一条记忆
      const memory = missingEmbeddingsResult.rows[0];
      log(`\n正在尝试处理记忆ID: ${memory.id}`, 'info');
      
      try {
        // 直接调用API处理这条记忆
        const processUrl = `http://localhost:5000/api/embedding/process-memory/${memory.id}`;
        log(`发送请求到: ${processUrl}`, 'info');
        
        const processResponse = await axios.post(processUrl, {}, {
          headers: {
            'Cookie': 'connect.sid=s%3AQcJn...', // 使用有效的会话令牌
            'Content-Type': 'application/json'
          }
        });
        
        if (processResponse.data && processResponse.data.success) {
          log(`记忆 ${memory.id} 已成功处理！`, 'success');
          log(`向量维度: ${processResponse.data.dimensions || '未知'}`, 'success');
        } else {
          log(`处理记忆 ${memory.id} 失败: ${JSON.stringify(processResponse.data)}`, 'error');
        }
      } catch (error) {
        log(`调用API时出错: ${error.message}`, 'error');
        
        // 如果远程请求失败，尝试完整URL
        try {
          const fullUrl = `https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev/api/embedding/process-memory/${memory.id}`;
          log(`尝试完整URL: ${fullUrl}`, 'info');
          
          const fullResponse = await axios.post(fullUrl, {}, {
            headers: {
              'Cookie': 'connect.sid=s%3AQcJn...', // 使用有效的会话令牌
              'Content-Type': 'application/json'
            }
          });
          
          if (fullResponse.data && fullResponse.data.success) {
            log(`记忆 ${memory.id} 已成功处理！`, 'success');
            log(`向量维度: ${fullResponse.data.dimensions || '未知'}`, 'success');
          } else {
            log(`处理记忆 ${memory.id} 失败: ${JSON.stringify(fullResponse.data)}`, 'error');
          }
        } catch (err) {
          log(`完整URL请求也失败: ${err.message}`, 'error');
        }
      }
    } else {
      log('\n所有记忆都已有嵌入向量!', 'success');
    }
    
  } catch (error) {
    log(`错误: ${error.message}`, 'error');
  } finally {
    client.release();
  }
}

// 运行脚本
findMissingEmbeddings().catch(error => log(`脚本运行时出错: ${error.message}`, 'error')).finally(() => pool.end());
