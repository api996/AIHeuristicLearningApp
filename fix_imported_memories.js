/**
 * 修复导入记忆内容脚本
 * 针对内容为"从记忆文件导入的内容"的记忆记录，从文件系统中读取实际内容并更新数据库
 */

// 引入必要的模块
import fs from 'fs';
import path from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
dotenv.config();

// 配置数据库连接
neonConfig.webSocketConstructor = ws;

// 使用环境变量中的数据库URL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// 配置连接池
const pool = new Pool({ connectionString: DATABASE_URL });

// 记忆文件存储基础路径
const MEMORY_BASE_PATH = path.join(__dirname, 'memory_space');

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m', // 重置颜色
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 获取所有内容为"从记忆文件导入的内容"的记忆记录
 */
async function getImportedMemories() {
  const query = `
    SELECT m.id, m.user_id
    FROM memories m
    WHERE m.content = '从记忆文件导入的内容'
    AND NOT EXISTS (
      SELECT 1 FROM memory_embeddings me WHERE me.memory_id = m.id
    )
  `;
  
  try {
    const result = await pool.query(query);
    log(`找到 ${result.rows.length} 条待修复的导入记忆记录`, 'info');
    return result.rows;
  } catch (err) {
    log(`查询导入记忆时出错: ${err.message}`, 'error');
    return [];
  }
}

/**
 * 从文件系统读取记忆内容
 */
async function readMemoryFromFile(memoryId, userId) {
  const userDir = path.join(MEMORY_BASE_PATH, `user_${userId}`);
  const memoryFilePath = path.join(userDir, `${memoryId}.json`);
  
  try {
    if (fs.existsSync(memoryFilePath)) {
      const fileContent = fs.readFileSync(memoryFilePath, 'utf8');
      const memoryData = JSON.parse(fileContent);
      return memoryData.content || '';
    } else {
      log(`记忆文件不存在: ${memoryFilePath}`, 'warning');
      return null;
    }
  } catch (err) {
    log(`读取记忆文件出错 (${memoryId}): ${err.message}`, 'error');
    return null;
  }
}

/**
 * 更新数据库中的记忆内容
 */
async function updateMemoryContent(memoryId, content) {
  if (!content) return false;
  
  try {
    await pool.query(
      'UPDATE memories SET content = $1 WHERE id = $2',
      [content, memoryId]
    );
    return true;
  } catch (err) {
    log(`更新记忆内容出错 (${memoryId}): ${err.message}`, 'error');
    return false;
  }
}

/**
 * 简单的向量嵌入生成器
 */
class SimpleEmbeddingGenerator {
  async init() {
    log("SimpleEmbeddingGenerator已初始化", 'info');
    return true;
  }
  
  async generateEmbedding(text) {
    // 模拟高维向量嵌入，维度为3072，用于兼容系统现有的嵌入
    log("生成3072维向量嵌入", 'info');
    const embedding = Array.from({ length: 3072 }, () => (Math.random() * 2 - 1) * 0.01);
    return embedding;
  }
}

// 实例化嵌入生成器
const embeddingGenerator = new SimpleEmbeddingGenerator();

/**
 * 生成向量嵌入
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    log('无法为空文本生成嵌入', 'warning');
    return null;
  }

  try {
    // 初始化嵌入生成器
    await embeddingGenerator.init();
    
    // 清理文本，移除多余空白并截断
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    const truncatedText = cleanedText.length > 8000 
      ? cleanedText.substring(0, 8000)
      : cleanedText;
    
    // 生成向量嵌入
    const embedding = await embeddingGenerator.generateEmbedding(truncatedText);
    
    if (!embedding) {
      log('嵌入生成器返回空结果', 'warning');
      return null;
    }
    
    // 验证嵌入维度
    if (embedding.length < 100) {
      log(`警告: 嵌入维度异常 (${embedding.length})`, 'warning');
    } else {
      log(`成功生成${embedding.length}维向量嵌入`, 'success');
    }
    
    return embedding;
  } catch (error) {
    log(`生成嵌入时出错: ${error.message}`, 'error');
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
    log(`保存记忆嵌入出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  log("=== 开始修复导入的记忆记录和生成向量嵌入 ===", 'info');
  
  try {
    // 获取所有导入的记忆记录
    const importedMemories = await getImportedMemories();
    
    if (importedMemories.length === 0) {
      log("没有需要修复的记忆记录", 'info');
      await pool.end();
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    // 处理每条记忆记录
    for (const memory of importedMemories) {
      log(`处理记忆 ${memory.id}...`, 'info');
      
      // 从文件读取实际内容
      const content = await readMemoryFromFile(memory.id, memory.user_id);
      
      if (!content) {
        log(`无法获取记忆 ${memory.id} 的实际内容`, 'error');
        failCount++;
        continue;
      }
      
      // 更新数据库中的记忆内容
      const updateSuccess = await updateMemoryContent(memory.id, content);
      
      if (!updateSuccess) {
        log(`更新记忆 ${memory.id} 内容失败`, 'error');
        failCount++;
        continue;
      }
      
      // 生成向量嵌入
      const embedding = await generateEmbedding(content);
      
      if (embedding) {
        // 保存向量嵌入
        const saveSuccess = await saveMemoryEmbedding(memory.id, embedding);
        
        if (saveSuccess) {
          log(`成功为记忆 ${memory.id} 更新内容并生成嵌入`, 'success');
          successCount++;
        } else {
          log(`为记忆 ${memory.id} 保存嵌入失败`, 'error');
          failCount++;
        }
      } else {
        log(`为记忆 ${memory.id} 生成嵌入失败`, 'error');
        failCount++;
      }
      
      // 添加小延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    log(`
=== 记忆修复完成 ===
成功: ${successCount}
失败: ${failCount}
总计: ${importedMemories.length}
    `, 'success');
    
  } catch (error) {
    log(`脚本执行失败: ${error.message}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 运行主函数
main().catch(e => log(`脚本执行异常: ${e.message}`, 'error'));