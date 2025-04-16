/**
 * 同步用户7的真实文件记忆到数据库
 * 清理了错误的测试数据后，将实际文件导入到数据库
 */

import { promises as fs } from 'fs';
import path from 'path';
import { db } from '../server/db.js';
import { memories, memoryKeywords, memoryEmbeddings } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

/**
 * 从文件系统导入用户记忆到数据库
 * @param {number} userId 用户ID
 */
async function importUserMemoriesFromFiles(userId) {
  console.log(`开始为用户 ${userId} 从文件导入记忆...`);
  
  // 构建用户记忆目录路径
  const memoryDir = path.join(process.cwd(), 'memory_space', String(userId));
  
  try {
    const files = await fs.readdir(memoryDir);
    console.log(`找到 ${files.length} 个记忆文件`);
    
    // 导入的记忆列表
    const importedMemories = [];
    
    // 处理每个文件
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(memoryDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const memoryData = JSON.parse(content);
          
          console.log(`正在处理文件: ${file}`);
          console.log(`内容: ${memoryData.content.substring(0, 50)}...`);
          
          // 导入记忆基本数据
          const insertedMemory = await db.insert(memories).values({
            user_id: userId,
            content: memoryData.content || '',
            type: memoryData.type || 'chat',
            timestamp: memoryData.timestamp ? new Date(memoryData.timestamp) : new Date(),
            summary: memoryData.summary || null,
          }).returning();
          
          if (!insertedMemory || insertedMemory.length === 0) {
            throw new Error('Failed to insert memory');
          }
          
          const memoryId = insertedMemory[0].id;
          console.log(`成功创建记忆，ID: ${memoryId}`);
          
          // 导入关键词
          if (memoryData.keywords && Array.isArray(memoryData.keywords)) {
            for (const keyword of memoryData.keywords) {
              await db.insert(memoryKeywords).values({
                memory_id: memoryId,
                keyword,
              });
            }
            console.log(`添加了 ${memoryData.keywords.length} 个关键词`);
          }
          
          // 导入向量嵌入
          if (memoryData.embedding && Array.isArray(memoryData.embedding)) {
            await db.insert(memoryEmbeddings).values({
              memory_id: memoryId,
              vector_data: JSON.stringify(memoryData.embedding),
            });
            console.log(`添加了向量嵌入`);
          }
          
          importedMemories.push({id: memoryId});
          
          // 短暂延迟，避免数据库压力
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`处理文件 ${file} 时出错:`, err);
        }
      }
    }
    
    console.log(`为用户 ${userId} 成功导入 ${importedMemories.length} 条记忆`);
    return importedMemories;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`用户 ${userId} 的记忆目录不存在`);
      return [];
    }
    console.error(`读取用户 ${userId} 的记忆目录出错:`, err);
    return [];
  }
}

// 用户ID
const userId = 7;

// 执行导入
importUserMemoriesFromFiles(userId)
  .then(memories => {
    console.log(`导入完成，总共导入 ${memories.length} 条记忆`);
    process.exit(0);
  })
  .catch(err => {
    console.error('导入过程中遇到错误:', err);
    process.exit(1);
  });