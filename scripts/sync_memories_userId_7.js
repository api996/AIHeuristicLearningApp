/**
 * 同步用户7的文件记忆到数据库
 * 这个脚本专门用于将用户7的文件系统记忆导入到数据库
 */

import { promises as fs } from 'fs';
import path from 'path';
import { db } from '../server/db';
import { memories, memoryKeywords, memoryEmbeddings } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * 从文件系统读取用户记忆文件
 * @param {number} userId 用户ID
 * @returns {Promise<Array>} 记忆文件列表
 */
async function readUserMemoryFiles(userId) {
  const userDir = path.join(process.cwd(), 'memory_space', userId.toString());
  
  try {
    const files = await fs.readdir(userDir);
    const memoryFiles = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(userDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const memoryData = JSON.parse(content);
          memoryFiles.push(memoryData);
        } catch (err) {
          console.error(`Error reading memory file ${file}:`, err);
        }
      }
    }
    
    return memoryFiles;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`No memory directory found for user ${userId}`);
      return [];
    }
    console.error(`Error reading user directory for user ${userId}:`, err);
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
    // 导入记忆基本数据
    const insertedMemory = await db.insert(memories).values({
      user_id: userId,
      content: memoryData.content || '',
      type: memoryData.type || 'text',
      timestamp: memoryData.timestamp ? new Date(memoryData.timestamp) : new Date(),
      summary: memoryData.summary || null,
    }).returning();
    
    if (!insertedMemory || insertedMemory.length === 0) {
      throw new Error('Failed to insert memory');
    }
    
    const memoryId = insertedMemory[0].id;
    
    // 导入关键词
    if (memoryData.keywords && Array.isArray(memoryData.keywords)) {
      for (const keyword of memoryData.keywords) {
        await db.insert(memoryKeywords).values({
          memory_id: memoryId,
          keyword,
        });
      }
    }
    
    // 导入向量嵌入
    if (memoryData.embedding && Array.isArray(memoryData.embedding)) {
      await db.insert(memoryEmbeddings).values({
        memory_id: memoryId,
        vector_data: JSON.stringify(memoryData.embedding),
      });
    }
    
    console.log(`Successfully imported memory ${memoryId} for user ${userId}`);
    return memoryId;
  } catch (error) {
    console.error(`Error importing memory for user ${userId}:`, error);
    return null;
  }
}

/**
 * 同步用户7的记忆到数据库
 */
async function syncUser7Memories() {
  const userId = 7;
  console.log(`开始同步用户 ${userId} 的记忆数据...`);
  
  // 从文件系统读取记忆
  const fileMemories = await readUserMemoryFiles(userId);
  console.log(`从文件系统读取到 ${fileMemories.length} 条记忆`);
  
  if (fileMemories.length === 0) {
    console.log('没有找到记忆文件，结束处理');
    return;
  }
  
  // 导入每一条记忆
  let importedCount = 0;
  for (const memory of fileMemories) {
    const memoryId = await importMemoryToDatabase(userId, memory);
    if (memoryId) {
      importedCount++;
    }
  }
  
  console.log(`成功导入 ${importedCount} 条记忆（共 ${fileMemories.length} 条）`);
}

// 执行同步
syncUser7Memories()
  .then(() => {
    console.log('用户7记忆同步完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('用户7记忆同步出错:', error);
    process.exit(1);
  });