/**
 * 同步文件系统中的记忆到数据库
 * 检查文件系统中存在但数据库中不存在的记忆，将它们导入到数据库
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { pool } from '../server/db.js';
import { log } from '../server/vite.js';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 记忆空间目录
const MEMORY_SPACE_DIR = path.join(__dirname, '..', 'memory_space');

/**
 * 从文件系统读取用户的记忆文件
 * @param {number} userId 用户ID
 * @returns {Promise<Array>} 记忆文件列表
 */
async function readUserMemoryFiles(userId) {
  const userDir = path.join(MEMORY_SPACE_DIR, userId.toString());
  
  if (!fs.existsSync(userDir)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(userDir);
    const memoryFiles = files.filter(file => file.endsWith('.json'));
    
    const memories = [];
    for (const file of memoryFiles) {
      try {
        const filePath = path.join(userDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const memoryData = JSON.parse(fileContent);
        
        // 添加文件名作为ID
        memoryData.fileName = file;
        memories.push(memoryData);
      } catch (err) {
        console.error(`无法解析记忆文件: ${file}`, err);
      }
    }
    
    return memories;
  } catch (err) {
    console.error(`读取用户${userId}记忆目录出错:`, err);
    return [];
  }
}

/**
 * 获取数据库中用户的记忆
 * @param {number} userId 用户ID
 * @returns {Promise<Array>} 数据库中的记忆
 */
async function getDatabaseMemories(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM memories WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.error(`获取用户${userId}数据库记忆出错:`, err);
    return [];
  }
}

/**
 * 将文件系统记忆导入到数据库
 * @param {number} userId 用户ID
 * @param {Object} memoryData 记忆数据
 */
async function importMemoryToDatabase(userId, memoryData) {
  try {
    // 基本记忆数据
    const content = memoryData.content || '';
    const type = memoryData.type || 'chat';
    const timestamp = memoryData.timestamp ? new Date(memoryData.timestamp) : new Date();
    const summary = memoryData.summary || null;
    
    // 创建记忆记录
    const memoryResult = await pool.query(
      `INSERT INTO memories (user_id, content, type, timestamp, summary, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, content, type, timestamp, summary, new Date()]
    );
    
    const memoryId = memoryResult.rows[0].id;
    console.log(`已导入记忆 ${memoryId} (文件: ${memoryData.fileName})`);
    
    // 导入关键词
    if (memoryData.keywords && Array.isArray(memoryData.keywords)) {
      for (const keyword of memoryData.keywords) {
        await pool.query(
          'INSERT INTO memory_keywords (memory_id, keyword) VALUES ($1, $2)',
          [memoryId, keyword]
        );
      }
      console.log(`已导入 ${memoryData.keywords.length} 个关键词`);
    }
    
    // 导入向量嵌入
    if (memoryData.embedding && Array.isArray(memoryData.embedding)) {
      await pool.query(
        'INSERT INTO memory_embeddings (memory_id, vector_data) VALUES ($1, $2)',
        [memoryId, JSON.stringify(memoryData.embedding)]
      );
      console.log(`已导入向量嵌入`);
    }
    
    return memoryId;
  } catch (err) {
    console.error(`导入记忆到数据库出错:`, err);
    return null;
  }
}

/**
 * 同步特定用户的文件系统记忆到数据库
 * @param {number} userId 用户ID
 */
async function syncUserMemories(userId) {
  console.log(`开始同步用户 ${userId} 的记忆...`);
  
  // 获取文件系统中的记忆
  const fileMemories = await readUserMemoryFiles(userId);
  console.log(`文件系统中发现 ${fileMemories.length} 条记忆`);
  
  if (fileMemories.length === 0) {
    console.log(`用户 ${userId} 没有文件系统记忆，跳过`);
    return 0;
  }
  
  // 获取数据库中的记忆
  const dbMemories = await getDatabaseMemories(userId);
  console.log(`数据库中已有 ${dbMemories.length} 条记忆`);
  
  // 导入新记忆
  let importedCount = 0;
  
  for (const fileMemory of fileMemories) {
    // 检查是否已存在 (基于内容匹配)
    const exists = dbMemories.some(dbMemory => 
      dbMemory.content === fileMemory.content
    );
    
    if (!exists) {
      const memoryId = await importMemoryToDatabase(userId, fileMemory);
      if (memoryId) {
        importedCount++;
      }
    }
  }
  
  console.log(`用户 ${userId} 共导入 ${importedCount} 条新记忆`);
  return importedCount;
}

/**
 * 同步所有用户的记忆
 */
async function syncAllUserMemories() {
  console.log('开始同步所有用户的记忆...');
  
  // 检查记忆空间目录
  if (!fs.existsSync(MEMORY_SPACE_DIR)) {
    console.error(`记忆空间目录 ${MEMORY_SPACE_DIR} 不存在`);
    return;
  }
  
  // 获取所有用户目录
  const userDirs = fs.readdirSync(MEMORY_SPACE_DIR);
  console.log(`发现 ${userDirs.length} 个用户目录`);
  
  let totalImported = 0;
  
  // 处理每个用户
  for (const userDir of userDirs) {
    // 确保是数字 (用户ID)
    if (/^\d+$/.test(userDir)) {
      const userId = parseInt(userDir, 10);
      const importedCount = await syncUserMemories(userId);
      totalImported += importedCount;
    }
  }
  
  console.log(`同步完成，总共导入 ${totalImported} 条新记忆`);
}

// 执行同步
syncAllUserMemories()
  .then(() => {
    console.log('记忆同步完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('记忆同步出错:', err);
    process.exit(1);
  });