/**
 * 记忆数据恢复脚本
 * 
 * 此脚本用于将文件系统中的记忆数据恢复到数据库中
 * 它会清理管理员用户的错误数据，并恢复普通用户的记忆数据
 */

import fs from 'fs';
import path from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import ws from 'ws';

// 加载环境变量
dotenv.config();

// 配置Neon WebSocket连接
neonConfig.webSocketConstructor = ws;

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

// 记忆目录
const MEMORY_DIR = 'memory_space';

/**
 * 清理管理员用户的错误数据
 */
async function cleanAdminData() {
  try {
    // 管理员用户ID
    const adminUserId = 1;
    
    // 删除管理员的记忆数据
    const result = await pool.query(
      'DELETE FROM memories WHERE user_id = $1 RETURNING id',
      [adminUserId]
    );
    
    log(`已清理管理员用户的${result.rowCount}条记忆记录`, 'success');
  } catch (error) {
    log(`清理管理员数据时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 读取记忆文件内容
 */
function readMemoryFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log(`读取文件失败 ${filePath}: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 恢复用户的记忆数据
 */
async function restoreUserMemories(userId) {
  try {
    const userDir = path.join(MEMORY_DIR, userId.toString());
    
    // 检查用户目录是否存在
    if (!fs.existsSync(userDir)) {
      log(`用户 ${userId} 没有记忆数据目录`, 'warn');
      return;
    }
    
    // 读取用户目录下的所有记忆文件
    const files = fs.readdirSync(userDir).filter(file => file.endsWith('.json'));
    
    if (files.length === 0) {
      log(`用户 ${userId} 目录下没有记忆文件`, 'warn');
      return;
    }
    
    log(`开始恢复用户 ${userId} 的 ${files.length} 条记忆记录...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // 处理每一个记忆文件
    for (const file of files) {
      const filePath = path.join(userDir, file);
      const memoryData = readMemoryFile(filePath);
      
      if (!memoryData) {
        errorCount++;
        continue;
      }
      
      // 提取ID（通常是文件名去掉扩展名）
      const memoryId = file.replace('.json', '');
      
      try {
        // 检查记忆是否已存在
        const existCheck = await pool.query(
          'SELECT id FROM memories WHERE id = $1',
          [memoryId]
        );
        
        if (existCheck.rowCount > 0) {
          log(`记忆 ${memoryId} 已存在，跳过`, 'warn');
          continue;
        }
        
        // 插入记忆数据
        await pool.query(
          `INSERT INTO memories (
            id, user_id, content, type, timestamp, summary, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            memoryId,
            userId,
            memoryData.content || '',
            memoryData.type || 'chat',
            memoryData.timestamp ? new Date(memoryData.timestamp) : new Date(),
            memoryData.summary || null,
            new Date()
          ]
        );
        
        // 如果有关键词，插入关键词
        if (memoryData.keywords && Array.isArray(memoryData.keywords) && memoryData.keywords.length > 0) {
          for (const keyword of memoryData.keywords) {
            await pool.query(
              'INSERT INTO memory_keywords (memory_id, keyword) VALUES ($1, $2)',
              [memoryId, keyword]
            );
          }
        }
        
        // 如果有向量嵌入，插入向量嵌入
        if (memoryData.embedding && Array.isArray(memoryData.embedding)) {
          // 检查向量维度
          if (memoryData.embedding.length === 3072) {
            await pool.query(
              'INSERT INTO memory_embeddings (memory_id, vector_data) VALUES ($1, $2)',
              [memoryId, JSON.stringify(memoryData.embedding)]
            );
          } else {
            log(`记忆 ${memoryId} 向量维度异常: ${memoryData.embedding.length}`, 'warn');
          }
        }
        
        successCount++;
      } catch (error) {
        log(`插入记忆 ${memoryId} 失败: ${error.message}`, 'error');
        errorCount++;
      }
    }
    
    log(`用户 ${userId} 记忆恢复完成: 成功${successCount}条, 失败${errorCount}条`, 'success');
  } catch (error) {
    log(`恢复用户 ${userId} 的记忆时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    log('开始恢复记忆数据...');
    
    // 1. 清理管理员的错误数据
    await cleanAdminData();
    
    // 2. 获取所有普通用户ID
    const userDirs = fs.readdirSync(MEMORY_DIR)
      .filter(dir => fs.statSync(path.join(MEMORY_DIR, dir)).isDirectory())
      .filter(dir => dir !== '1'); // 排除管理员
    
    log(`发现 ${userDirs.length} 个用户目录需要恢复`);
    
    // 3. 恢复每个用户的记忆数据
    for (const userDir of userDirs) {
      const userId = parseInt(userDir, 10);
      if (isNaN(userId)) {
        log(`跳过非数字用户目录: ${userDir}`, 'warn');
        continue;
      }
      
      await restoreUserMemories(userId);
    }
    
    log('记忆数据恢复完成!', 'success');
  } catch (error) {
    log(`恢复过程中出错: ${error.message}`, 'error');
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