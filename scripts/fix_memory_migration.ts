/**
 * 修复记忆文件系统到数据库迁移
 * 此脚本用于修复记忆数据迁移，特别针对用户ID=6的记忆数据
 */

import fs from 'fs';
import path from 'path';
import { storage } from '../server/storage';
import { db } from '../server/db';
import { memories, memoryKeywords, memoryEmbeddings } from '../shared/schema';
import { log } from '../server/vite';
import { eq, and } from 'drizzle-orm';

interface FileMemory {
  content: string;
  type: string;
  timestamp: string;
  embedding?: number[];
  summary?: string;
  keywords?: string[];
  id?: string;
}

/**
 * 修复指定用户的记忆迁移
 */
async function fixMemoryMigration(targetUserId: number) {
  try {
    log(`开始修复用户ID=${targetUserId}的记忆迁移...`);
    
    // 检查是否已有该用户的数据库记录
    const existingCount = await db.select()
      .from(memories)
      .where(eb => eb.eq(memories.userId, targetUserId));
      
    log(`数据库中已有用户ID=${targetUserId}的记忆记录 ${existingCount.length} 条`);
    
    // 使用项目根目录的memory_space
    const memoryBasePath = path.resolve('memory_space');
    log(`使用记忆路径: ${memoryBasePath}`);
    
    // 验证路径是否存在
    if (!fs.existsSync(memoryBasePath)) {
      log(`记忆目录不存在: ${memoryBasePath}`);
      return;
    }
    
    // 指定用户的记忆目录
    const userPath = path.join(memoryBasePath, targetUserId.toString());
    
    // 验证用户目录是否存在
    if (!fs.existsSync(userPath)) {
      log(`用户记忆目录不存在: ${userPath}`);
      return;
    }
    
    const memoryFiles = fs.readdirSync(userPath).filter(file => file.endsWith('.json'));
    
    log(`用户 ${targetUserId}: 找到 ${memoryFiles.length} 个记忆文件`);
    
    // 检查用户是否存在
    const user = await storage.getUser(targetUserId);
    if (!user) {
      log(`警告: 用户 ${targetUserId} 不存在于数据库中，无法迁移记忆`);
      return;
    }
    
    let migratedMemories = 0;
    let failedMemories = 0;
    
    // 处理每个记忆文件
    for (const file of memoryFiles) {
      try {
        const filePath = path.join(userPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const memoryData: FileMemory = JSON.parse(fileContent);
        
        // 检查是否已经迁移过该记忆（使用timestamp作为标识）
        const timestamp = new Date(memoryData.timestamp);
        const existingMemory = await db.select()
          .from(memories)
          .where(eb => 
            eb.and([
              eb.eq(memories.userId, targetUserId),
              eb.eq(memories.timestamp, timestamp)
            ])
          );
        
        if (existingMemory.length > 0) {
          log(`记忆文件 ${file} 已经迁移过，跳过`);
          continue;
        }
        
        // 添加记忆到数据库
        const memory = await storage.createMemory(
          targetUserId,
          memoryData.content,
          memoryData.type || 'chat',
          memoryData.summary,
          timestamp
        );
        
        log(`创建记忆: ${memory.id}`);
        
        // 添加关键词
        if (memoryData.keywords && Array.isArray(memoryData.keywords)) {
          for (const keyword of memoryData.keywords) {
            if (keyword && typeof keyword === 'string') {
              await storage.addKeywordToMemory(memory.id, keyword);
            }
          }
          log(`添加了 ${memoryData.keywords.length} 个关键词`);
        }
        
        // 添加嵌入向量
        if (memoryData.embedding && Array.isArray(memoryData.embedding)) {
          await storage.saveMemoryEmbedding(memory.id, memoryData.embedding);
          log(`添加了嵌入向量 (${memoryData.embedding.length} 维)`);
        }
        
        migratedMemories++;
      } catch (error) {
        log(`迁移记忆 ${file} 失败: ${error}`);
        failedMemories++;
      }
    }
    
    log(`迁移完成! 成功: ${migratedMemories}, 失败: ${failedMemories}`);
    
    const dbCount = await db.select()
      .from(memories)
      .where(eb => eb.eq(memories.userId, targetUserId));
      
    log(`数据库中现有用户ID=${targetUserId}的记忆记录 ${dbCount.length} 条`);
    
  } catch (error) {
    log(`迁移过程出错: ${error}`);
  }
}

// 运行修复迁移，指定用户ID=6
fixMemoryMigration(6).then(() => {
  log("记忆修复迁移脚本执行完毕");
}).catch(error => {
  log(`修复迁移脚本执行出错: ${error}`);
});