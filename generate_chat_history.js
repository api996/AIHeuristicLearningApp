/**
 * 聊天历史生成脚本
 * 
 * 此脚本基于记忆数据为用户生成聊天历史记录
 * 通过分析记忆内容，生成对应的聊天历史和消息
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import ws from 'ws';

// 配置Neon WebSocket连接
neonConfig.webSocketConstructor = ws;

// 加载环境变量
dotenv.config();

// 颜色日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m' // 重置颜色
  };
  
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

// 创建数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * 为用户创建聊天和消息记录
 */
async function generateChatHistoryForUser(userId) {
  try {
    // 获取用户的记忆数据
    const memoriesResult = await pool.query(
      'SELECT * FROM memories WHERE user_id = $1 ORDER BY timestamp',
      [userId]
    );
    
    if (memoriesResult.rowCount === 0) {
      log(`用户 ${userId} 没有记忆数据，跳过`, 'warn');
      return;
    }
    
    log(`开始为用户 ${userId} 生成聊天历史，基于 ${memoriesResult.rowCount} 条记忆...`);
    
    // 按日期对记忆进行分组，每天的对话创建一个聊天记录
    const memoriesByDate = {};
    
    memoriesResult.rows.forEach(memory => {
      // 提取日期部分
      const date = memory.timestamp.toISOString().split('T')[0];
      
      if (!memoriesByDate[date]) {
        memoriesByDate[date] = [];
      }
      
      memoriesByDate[date].push(memory);
    });
    
    // 处理每一天的记忆
    for (const [date, memories] of Object.entries(memoriesByDate)) {
      // 为这一天创建一个聊天记录
      const chatTitle = `${date} 对话`;
      
      // 插入聊天记录
      const chatResult = await pool.query(
        `INSERT INTO chats (user_id, created_at, title, model) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, new Date(date), chatTitle, 'gemini-pro']
      );
      
      const chatId = chatResult.rows[0].id;
      log(`创建聊天记录: ${chatTitle}, ID: ${chatId}`);
      
      // 为每条记忆创建消息记录
      for (let i = 0; i < memories.length; i++) {
        const memory = memories[i];
        
        try {
          // 提取记忆内容中的对话
          const content = memory.content;
          
          // 简单规则：如果内容包含问答格式，则分割为多条消息
          if (content.includes('问：') && content.includes('答：')) {
            // 分割问答对
            const parts = content.split(/(?=问：|答：)/g);
            
            for (const part of parts) {
              if (part.trim().length === 0) continue;
              
              // 确定角色
              let role = 'assistant';
              if (part.startsWith('问：')) {
                role = 'user';
              }
              
              // 清理内容
              let cleanContent = part.replace(/^(问：|答：)/, '').trim();
              
              // 插入消息
              await pool.query(
                `INSERT INTO messages (chat_id, role, content, created_at, model, is_active, is_edited) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [chatId, role, cleanContent, memory.timestamp, 'gemini-pro', true, false]
              );
            }
          } else {
            // 如果没有明确的问答格式，则默认为两条消息：用户提问和AI回答
            // 用户消息（假设是记忆内容的前半部分）
            const userContent = content.substring(0, content.length / 2).trim();
            if (userContent) {
              await pool.query(
                `INSERT INTO messages (chat_id, role, content, created_at, model, is_active, is_edited) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [chatId, 'user', userContent, memory.timestamp, 'gemini-pro', true, false]
              );
            }
            
            // AI回答（假设是记忆内容的后半部分）
            const assistantContent = content.substring(content.length / 2).trim();
            if (assistantContent) {
              await pool.query(
                `INSERT INTO messages (chat_id, role, content, created_at, model, is_active, is_edited) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [chatId, 'assistant', assistantContent, memory.timestamp, 'gemini-pro', true, false]
              );
            }
          }
        } catch (error) {
          log(`处理记忆 ${memory.id} 时出错: ${error.message}`, 'error');
        }
      }
      
      log(`为聊天 ${chatId} 创建了消息记录`, 'success');
    }
    
    log(`用户 ${userId} 的聊天历史生成完成`, 'success');
  } catch (error) {
    log(`为用户 ${userId} 生成聊天历史时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 获取所有普通用户ID
 */
async function getAllUsers() {
  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE role != 'admin'"
    );
    
    return result.rows.map(row => row.id);
  } catch (error) {
    log(`获取用户列表时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    log('开始生成聊天历史...');
    
    // 获取所有普通用户
    const userIds = await getAllUsers();
    
    log(`发现 ${userIds.length} 个普通用户需要生成聊天历史`);
    
    // 为每个用户生成聊天历史
    for (const userId of userIds) {
      await generateChatHistoryForUser(userId);
    }
    
    log('聊天历史生成完成!', 'success');
  } catch (error) {
    log(`生成过程中出错: ${error.message}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 执行主函数
main().catch(error => {
  log(`脚本执行失败: ${error.message}`, 'error');
  process.exit(1);
});