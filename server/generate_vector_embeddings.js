/**
 * 为记忆生成向量嵌入脚本
 * 使用定时戳格式ID与记忆内容创建向量嵌入
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

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

/**
 * 使用真实AI嵌入服务
 * 导入服务器中已实现的GenAI服务
 */

// 使用spawn直接调用Python脚本，避免模块路径问题
import { spawn } from 'child_process';
import path from 'path';

// 输出日志表明使用了真实服务
console.log("使用Python嵌入服务为记忆生成3072维语义向量");

/**
 * 获取所有没有向量嵌入的记忆
 */
async function getMemoriesWithoutEmbeddings() {
  console.log("尝试查找所有缺失嵌入的记忆...");
  
  const query = `
    SELECT m.id, m.content
    FROM memories m
    WHERE NOT EXISTS (
      SELECT 1 FROM memory_embeddings me 
      WHERE me.memory_id = m.id
    )
    AND m.content IS NOT NULL
    AND m.content <> '从记忆文件导入的内容'
    AND length(m.content) > 10
    ORDER BY m.created_at DESC
    LIMIT 50
  `;
  
  try {
    const result = await pool.query(query);
    console.log(`查询结果: 找到 ${result.rows.length} 条缺失嵌入的记忆`);
    return result.rows;
  } catch (err) {
    console.error(`查询出错: ${err.message}`);
    return [];
  }
}

/**
 * 获取所有没有有效向量嵌入的时间戳格式ID记忆
 */
async function getTimeStampMemoriesWithoutEmbeddings() {
  console.log("尝试查找所有缺失嵌入的记忆...");
  
  const query = `
    SELECT m.id, m.content
    FROM memories m
    WHERE NOT EXISTS (
      SELECT 1 FROM memory_embeddings me 
      WHERE me.memory_id = m.id
    )
    AND m.content IS NOT NULL
    AND length(m.content) > 10
    AND m.id ~ '^\\d{14}'
    ORDER BY m.created_at DESC
    LIMIT 50
  `;
  
  try {
    const result = await pool.query(query);
    console.log(`查询结果: 找到 ${result.rows.length} 条缺失嵌入的记忆`);
    return result.rows;
  } catch (err) {
    console.error(`查询出错: ${err.message}`);
    return [];
  }
}

/**
 * 使用Python嵌入服务生成向量嵌入
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.log('无法为空文本生成嵌入');
    return null;
  }

  // 清理文本，移除多余空白
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .trim();

  // 截断文本，如果过长
  const truncatedText = cleanedText.length > 8000 
    ? cleanedText.substring(0, 8000)
    : cleanedText;
  
  try {
    // 使用Python嵌入服务生成向量嵌入
    console.log('使用Python嵌入服务生成向量嵌入');
    
    // 使用Promise封装子进程调用
    const result = await new Promise((resolve, reject) => {
      // 创建Python进程
      const scriptPath = path.join(process.cwd(), 'server', 'services', 'embedding.py');
      console.log(`Python嵌入脚本路径: ${scriptPath}`);
      
      const pythonProcess = spawn('python3', [scriptPath, '--text', truncatedText]);
      
      let outputData = '';
      let errorData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        console.error(`Python错误: ${data.toString().trim()}`);
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python进程异常退出，代码: ${code}`);
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
            console.log(`提取JSON部分: ${jsonStr.length} 字符`);
            
            try {
              // 解析JSON
              const result = JSON.parse(jsonStr);
              
              if (result.success === false) {
                console.error(`Python嵌入服务报告错误: ${result.error}`);
                reject(new Error(result.error || '嵌入服务返回失败结果'));
                return;
              }
              
              if (result && result.embedding && Array.isArray(result.embedding)) {
                resolve(result.embedding);
              } else {
                reject(new Error('嵌入结果格式不正确或缺少embedding字段'));
              }
            } catch (jsonError) {
              reject(new Error(`解析JSON失败: ${jsonError.message}`));
            }
          } else {
            reject(new Error(`输出中未找到有效的JSON: ${outputData}`));
          }
        } catch (error) {
          reject(new Error(`处理输出时出错: ${error.message}`));
        }
      });
    });
    
    // 验证嵌入维度，确保是有效的向量
    if (!result || !Array.isArray(result)) {
      console.log('Python嵌入服务返回无效结果');
      return null;
    }
    
    if (result.length < 1000) {
      console.log(`警告: 嵌入维度异常 (${result.length}), 预期3072维向量`);
    } else {
      console.log(`成功生成${result.length}维向量嵌入`);
    }
    
    return result;
  } catch (error) {
    console.error(`生成嵌入时出错: ${error}`);
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
    console.error(`保存记忆嵌入出错: ${error}`);
    return false;
  }
}

/**
 * 处理一批记忆的向量嵌入生成
 * 实现批处理和速率限制，每批5条记忆，批次间等待60秒
 */
async function processMemoryBatch(memories) {
  let successCount = 0;
  let failCount = 0;
  
  // 没有记忆需要处理
  if (!memories || memories.length === 0) {
    console.log("没有记忆需要处理");
    return { successCount, failCount };
  }

  console.log(`开始处理 ${memories.length} 条记忆，实施批处理策略`);
  
  // 分批处理，每批5条记忆
  const batchSize = 5;
  const batchDelay = 60000; // 60秒
  
  // 将记忆分组
  const batches = [];
  for (let i = 0; i < memories.length; i += batchSize) {
    batches.push(memories.slice(i, i + batchSize));
  }
  
  console.log(`分成 ${batches.length} 批处理，每批最多 ${batchSize} 条记忆，批次间等待 ${batchDelay/1000} 秒`);
  
  // 处理每一批
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 条记忆`);
    
    // 处理批次中的每条记忆
    for (const memory of batch) {
      console.log(`处理记忆 ${memory.id}...`);
      
      // 生成向量嵌入
      const embedding = await generateEmbedding(memory.content);
      
      if (embedding) {
        // 保存向量嵌入
        const success = await saveMemoryEmbedding(memory.id, embedding);
        
        if (success) {
          console.log(`成功为记忆 ${memory.id} 生成并保存向量嵌入`);
          successCount++;
        } else {
          console.log(`保存记忆 ${memory.id} 的向量嵌入失败`);
          failCount++;
        }
      } else {
        console.log(`为记忆 ${memory.id} 生成向量嵌入失败`);
        failCount++;
      }
      
      // 记忆间添加短暂延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 如果还有后续批次，则等待指定时间
    if (batchIndex < batches.length - 1) {
      console.log(`批次 ${batchIndex + 1} 完成，等待 ${batchDelay/1000} 秒后处理下一批...`);
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  return { successCount, failCount };
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log("=== 开始为记忆生成向量嵌入 ===");
    
    // 验证Python脚本存在
    const scriptPath = path.join(process.cwd(), 'server', 'services', 'embedding.py');
    try {
      const fs = await import('fs');
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Python嵌入脚本不存在: ${scriptPath}`);
      }
      console.log(`Python嵌入脚本路径有效: ${scriptPath}`);
    } catch (error) {
      console.error(`验证Python脚本路径出错: ${error}`);
      throw error;
    }
    
    // 优先处理时间戳格式ID的记忆
    const timestampMemories = await getTimeStampMemoriesWithoutEmbeddings();
    console.log(`找到 ${timestampMemories.length} 条时间戳格式ID未有嵌入的记忆`);
    
    if (timestampMemories.length > 0) {
      console.log("开始处理时间戳格式ID记忆...");
      const { successCount, failCount } = await processMemoryBatch(timestampMemories);
      
      console.log(`
=== 时间戳格式ID记忆处理完成 ===
成功: ${successCount}
失败: ${failCount}
总计: ${timestampMemories.length}
      `);
    } else {
      // 如果时间戳格式ID记忆已全部处理完毕，则处理任何剩余的记忆
      const otherMemories = await getMemoriesWithoutEmbeddings();
      console.log(`找到 ${otherMemories.length} 条其他格式ID未有嵌入的记忆`);
      
      if (otherMemories.length === 0) {
        console.log("没有需要处理的记忆，脚本完成");
        await pool.end();
        return;
      }
      
      console.log("开始处理其他记忆...");
      const { successCount, failCount } = await processMemoryBatch(otherMemories);
      
      console.log(`
=== 其他记忆处理完成 ===
成功: ${successCount}
失败: ${failCount}
总计: ${otherMemories.length}
      `);
    }
    
    // 关闭数据库连接
    await pool.end();
  } catch (error) {
    console.error("脚本执行失败:", error);
    await pool.end();
    process.exit(1);
  }
}

// 运行主函数
main();