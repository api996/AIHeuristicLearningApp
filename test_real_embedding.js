/**
 * 真实向量嵌入测试脚本
 * 模拟创建一条记忆并为其生成向量嵌入
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';

// 加载环境变量
dotenv.config();

// 配置数据库连接
const { DATABASE_URL } = process.env;

// 检查环境变量
if (!DATABASE_URL) {
  console.error("缺少必要的环境变量: DATABASE_URL");
  process.exit(1);
}

// 配置数据库连接
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: DATABASE_URL });

// 生成临时测试ID
const testId = 'test-' + Date.now();
const testContent = '这是一个测试记忆，用于验证向量嵌入服务是否正常工作。测试中文和英文文本的处理能力，以及整个流程是否连贯。This is a test memory to verify if the vector embedding service works properly.';

// 创建测试记忆
async function createTestMemory() {
  try {
    console.log(`创建测试记忆, ID: ${testId}`);
    
    // 使用RETURNING获取插入的记录
    const result = await pool.query(
      'INSERT INTO memories (id, user_id, content, type, timestamp, summary) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [testId, 999, testContent, 'test', new Date().toISOString(), '测试记忆']
    );
    
    if (result.rows.length > 0) {
      console.log(`测试记忆创建成功, ID: ${result.rows[0].id}`);
      return result.rows[0].id;
    } else {
      throw new Error('创建测试记忆失败，未返回ID');
    }
  } catch (error) {
    console.error(`创建测试记忆失败: ${error}`);
    throw error;
  }
}

// 生成记忆的向量嵌入
async function generateEmbedding(memoryId) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`为记忆ID ${memoryId} 生成向量嵌入...`);
      
      // 构建命令，使用绝对路径
      const scriptPath = path.join(process.cwd(), 'server', 'generate_vector_embeddings.js');
      const command = `node ${scriptPath} --memory-id=${memoryId}`;
      
      console.log(`执行命令: ${command}`);
      
      // 执行命令
      const child = spawn('node', [scriptPath, `--memory-id=${memoryId}`], {
        stdio: 'inherit' // 将子进程输出传递到父进程
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log(`向量嵌入生成成功，退出码: ${code}`);
          resolve(true);
        } else {
          console.error(`向量嵌入生成失败，退出码: ${code}`);
          resolve(false);
        }
      });
      
      child.on('error', (error) => {
        console.error(`向量嵌入生成错误: ${error}`);
        reject(error);
      });
    } catch (error) {
      console.error(`生成向量嵌入失败: ${error}`);
      reject(error);
    }
  });
}

// 删除测试记忆和嵌入
async function cleanup(memoryId) {
  try {
    console.log(`清理测试数据, 记忆ID: ${memoryId}`);
    
    // 首先删除记忆的向量嵌入
    await pool.query('DELETE FROM memory_embeddings WHERE memory_id = $1', [memoryId]);
    console.log('已删除向量嵌入');
    
    // 然后删除记忆
    await pool.query('DELETE FROM memories WHERE id = $1', [memoryId]);
    console.log('已删除测试记忆');
    
    return true;
  } catch (error) {
    console.error(`清理测试数据失败: ${error}`);
    return false;
  }
}

// 验证是否成功生成向量嵌入
async function verifyEmbedding(memoryId) {
  try {
    console.log(`验证记忆ID ${memoryId} 的向量嵌入...`);
    
    const result = await pool.query(
      'SELECT * FROM memory_embeddings WHERE memory_id = $1',
      [memoryId]
    );
    
    if (result.rows.length > 0) {
      const embedding = result.rows[0];
      console.log(`找到向量嵌入, ID: ${embedding.id}`);
      
      // 验证向量数据
      const vectorData = embedding.vector_data;
      if (Array.isArray(vectorData) && vectorData.length > 0) {
        console.log(`向量维度: ${vectorData.length}`);
        console.log(`向量示例值: ${vectorData.slice(0, 5).join(', ')}...`);
        return true;
      } else {
        console.error('向量数据格式无效');
        return false;
      }
    } else {
      console.error(`未找到记忆ID ${memoryId} 的向量嵌入`);
      return false;
    }
  } catch (error) {
    console.error(`验证向量嵌入失败: ${error}`);
    return false;
  }
}

// 主函数
async function main() {
  let memoryId = null;
  
  try {
    console.log('=== 开始向量嵌入服务测试 ===');
    
    // 步骤1: 创建测试记忆
    memoryId = await createTestMemory();
    
    // 步骤2: 生成向量嵌入
    const success = await generateEmbedding(memoryId);
    
    if (!success) {
      throw new Error('生成向量嵌入失败');
    }
    
    // 步骤3: 验证向量嵌入
    const verified = await verifyEmbedding(memoryId);
    
    if (verified) {
      console.log('=== 测试成功: 向量嵌入服务正常工作 ===');
    } else {
      console.error('=== 测试失败: 未能验证向量嵌入 ===');
    }
  } catch (error) {
    console.error(`测试失败: ${error}`);
  } finally {
    // 清理测试数据
    if (memoryId) {
      await cleanup(memoryId);
    }
    
    // 关闭数据库连接
    await pool.end();
  }
}

// 运行主函数
main();