/**
 * 修复剩余记忆向量嵌入脚本
 * 手动处理特定的记忆ID，为其生成向量嵌入
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import ws from 'ws';

// ES模块中获取__dirname等价代码
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置neon WebSocket
neonConfig.webSocketConstructor = ws;

// 配置数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 彩色日志输出函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
  };
  
  const color = colors[type] || colors.info;
  const reset = '\x1b[0m';
  console.log(`${color}[${type.toUpperCase()}]${reset} ${message}`);
}

/**
 * 使用Python嵌入服务生成向量嵌入
 * 直接调用Python脚本，而不是启动服务
 */
async function generateEmbedding(text) {
  log(`正在为文本生成嵌入: "${text}"`, 'info');
  
  // 如果文本为空或者仅包含空白字符，生成一个默认的替代文本
  if (!text || text.trim() === '' || text === '1') {
    text = "这是一个占位符内容，用于测试向量嵌入生成功能。";
    log(`使用默认替代文本: "${text}"`, 'warning');
  }
  
  return new Promise((resolve, reject) => {
    const pythonPath = 'python3';
    const scriptPath = path.join(process.cwd(), 'server/services/embedding.py');
    
    // 检查脚本是否存在
    if (!fs.existsSync(scriptPath)) {
      reject(new Error(`找不到Python嵌入脚本: ${scriptPath}`));
      return;
    }
    
    log(`使用Python脚本: ${scriptPath}`, 'info');
    
    // 准备命令行参数，文本需要转义
    const args = ['--text', text];
    
    const pythonProcess = spawn(pythonPath, [scriptPath, ...args]);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      log(`Python错误: ${data}`, 'error');
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        log(`Python进程退出，代码: ${code}`, 'error');
        reject(new Error(`Python进程异常退出，错误信息: ${errorData}`));
        return;
      }
      
      try {
        // 解析JSON输出
        const result = JSON.parse(outputData);
        
        if (!result.success) {
          reject(new Error(`嵌入生成失败: ${result.error}`));
          return;
        }
        
        const embedding = result.embedding;
        const dimensions = result.dimensions;
        
        log(`成功生成嵌入向量，维度: ${dimensions}`, 'success');
        resolve(embedding);
      } catch (error) {
        log(`解析输出失败: ${error.message}`, 'error');
        log(`输出内容: ${outputData}`, 'error');
        reject(error);
      }
    });
  });
}

/**
 * 将向量嵌入保存到数据库
 */
async function saveMemoryEmbedding(memoryId, vectorData) {
  try {
    // 确保向量数据被正确格式化为JSONB
    const jsonbData = JSON.stringify(vectorData);
    log(`向量数据已序列化为JSON字符串，长度: ${jsonbData.length}`, 'info');
    
    const query = `
      INSERT INTO memory_embeddings (memory_id, vector_data)
      VALUES ($1, $2::jsonb)
      RETURNING id
    `;
    
    const values = [memoryId, jsonbData];
    const result = await pool.query(query, values);
    
    if (result.rows && result.rows.length > 0) {
      log(`成功保存向量嵌入，ID: ${result.rows[0].id}，记忆ID: ${memoryId}`, 'success');
      return result.rows[0].id;
    } else {
      throw new Error('插入成功但未返回ID');
    }
  } catch (error) {
    log(`保存向量嵌入失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 处理特定记忆ID
 */
async function processMemory(memoryId) {
  try {
    log(`开始处理记忆ID: ${memoryId}`, 'info');
    
    // 查询记忆内容
    const memoryQuery = 'SELECT content FROM memories WHERE id = $1';
    const memoryResult = await pool.query(memoryQuery, [memoryId]);
    
    if (!memoryResult.rows || memoryResult.rows.length === 0) {
      log(`找不到记忆ID: ${memoryId}`, 'error');
      return false;
    }
    
    const content = memoryResult.rows[0].content;
    log(`记忆内容: "${content}"`, 'info');
    
    // 生成向量嵌入
    const embedding = await generateEmbedding(content);
    
    // 保存向量嵌入
    await saveMemoryEmbedding(memoryId, embedding);
    
    return true;
  } catch (error) {
    log(`处理记忆失败 ${memoryId}: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    log('开始修复剩余记忆的向量嵌入', 'info');
    
    // 手动列出需要处理的记忆ID
    const memoryIds = [
      '20250418154909410535'
    ];
    
    log(`需要处理的记忆数量: ${memoryIds.length}`, 'info');
    
    let successCount = 0;
    let failureCount = 0;
    
    // 依次处理每个记忆
    for (const memoryId of memoryIds) {
      const success = await processMemory(memoryId);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // API速率限制，每次处理完等待60秒
      if (memoryIds.indexOf(memoryId) < memoryIds.length - 1) {
        log('等待60秒，遵守API速率限制...', 'info');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
    
    log(`处理完成。成功: ${successCount}, 失败: ${failureCount}`, 'info');
    
    // 关闭数据库连接
    await pool.end();
  } catch (error) {
    log(`脚本执行失败: ${error.message}`, 'error');
    
    // 确保关闭数据库连接
    try {
      await pool.end();
    } catch (_) {}
    
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  log(`未捕获的错误: ${error.message}`, 'error');
  process.exit(1);
});