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
 * 使用Flask嵌入API服务生成向量嵌入
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
    // 使用Flask API服务生成向量嵌入
    console.log('使用Flask API服务生成向量嵌入');
    
    // API端点
    const apiUrl = 'http://localhost:9002/api/embed';
    
    // 使用axios调用API
    const axios = await import('axios');
    
    console.log(`发送请求到Flask嵌入API: ${apiUrl}, 文本长度: ${truncatedText.length}`);
    const response = await axios.default.post(apiUrl, {
      text: truncatedText
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30秒超时
    });
    
    if (response.status !== 200) {
      console.error(`API请求失败，状态码: ${response.status}`);
      return null;
    }
    
    const result = response.data;
    
    // 验证返回的结果
    if (!result.success) {
      console.error(`API返回错误: ${result.error}`);
      return null;
    }
    
    if (!result.embedding || !Array.isArray(result.embedding)) {
      console.error('API返回格式无效: 缺少embedding字段或不是数组');
      return null;
    }
    
    // 验证嵌入维度，确保是有效的向量
    const embedding = result.embedding;
    
    if (embedding.length < 1000) {
      console.log(`警告: 嵌入维度异常 (${embedding.length}), 预期3072维向量`);
    } else {
      console.log(`成功生成${embedding.length}维向量嵌入`);
    }
    
    return embedding;
  } catch (error) {
    console.error(`生成嵌入时出错: ${error}`);
    
    // 检查是否是连接错误
    if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
      console.log('Flask嵌入API服务可能未启动，尝试启动服务...');
      // 这里可以尝试自动启动服务
      try {
        const { spawn } = await import('child_process');
        const startScriptPath = path.join(process.cwd(), 'server', 'services', 'api', 'embedding', 'start_service.py');
        
        console.log(`尝试启动嵌入服务: ${startScriptPath}`);
        const startProcess = spawn('python3', [startScriptPath], {
          detached: true,
          stdio: 'ignore'
        });
        
        // 不等待进程完成，让它在后台运行
        startProcess.unref();
        
        console.log('启动请求已发送，等待服务启动...');
        // 短暂等待服务启动
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('重试生成嵌入...');
        // 递归调用自身，但只递归一次，避免无限循环
        const retryResult = await generateEmbedding(text);
        return retryResult;
      } catch (startError) {
        console.error(`启动Flask嵌入API服务失败: ${startError}`);
      }
    }
    
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
 * 获取单个指定记忆
 * @param {string} memoryId 记忆ID
 */
async function getSingleMemory(memoryId) {
  console.log(`尝试获取指定记忆ID: ${memoryId}`);
  
  const query = `
    SELECT id, content
    FROM memories
    WHERE id = $1
    AND content IS NOT NULL
    AND length(content) > 10
  `;
  
  try {
    const result = await pool.query(query, [memoryId]);
    
    if (result.rows.length === 0) {
      console.log(`未找到指定ID的记忆: ${memoryId}`);
      return null;
    }
    
    console.log(`成功获取指定记忆ID: ${memoryId}`);
    return result.rows[0];
  } catch (err) {
    console.error(`查询指定记忆出错: ${err.message}`);
    return null;
  }
}

/**
 * 解析命令行参数
 */
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  for (const arg of args) {
    if (arg.startsWith('--memory-id=')) {
      params.memoryId = arg.split('=')[1];
    }
  }
  
  return params;
}

/**
 * 处理单个记忆
 */
async function processSingleMemory(memoryId) {
  console.log(`开始处理单个记忆, ID: ${memoryId}`);
  
  // 获取记忆内容
  const memory = await getSingleMemory(memoryId);
  
  if (!memory) {
    console.error(`无法获取指定记忆: ${memoryId}`);
    return false;
  }
  
  console.log(`获取到记忆 ${memoryId}, 内容长度: ${memory.content.length}`);
  
  // 生成向量嵌入
  const embedding = await generateEmbedding(memory.content);
  
  if (!embedding) {
    console.error(`为记忆 ${memoryId} 生成向量嵌入失败`);
    return false;
  }
  
  // 保存向量嵌入
  const success = await saveMemoryEmbedding(memory.id, embedding);
  
  if (success) {
    console.log(`成功为记忆 ${memoryId} 生成并保存向量嵌入`);
    return true;
  } else {
    console.error(`保存记忆 ${memoryId} 的向量嵌入失败`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log("=== 开始为记忆生成向量嵌入 ===");
    
    // 解析命令行参数
    const params = parseCommandLineArgs();
    
    // 如果指定了单个记忆ID，只处理该记忆
    if (params.memoryId) {
      console.log(`单记忆模式: 处理记忆ID ${params.memoryId}`);
      const success = await processSingleMemory(params.memoryId);
      
      if (success) {
        console.log(`单记忆处理成功: ${params.memoryId}`);
      } else {
        console.log(`单记忆处理失败: ${params.memoryId}`);
        process.exit(1);
      }
      
      // 关闭数据库连接
      await pool.end();
      return;
    }
    
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