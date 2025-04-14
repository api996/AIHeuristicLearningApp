/**
 * 记忆文件系统到数据库迁移工具
 * 此脚本用于将存储在文件系统中的记忆数据迁移到PostgreSQL数据库
 */

import fs from 'fs';
import path from 'path';
import { storage } from '../server/storage';
import { db } from '../server/db';
import { memories, memoryKeywords, memoryEmbeddings } from '../shared/schema';
import { log } from '../server/vite';

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
 * 从文件系统迁移记忆数据到数据库
 */
async function migrateMemoriesToDatabase() {
  try {
    log("开始迁移记忆数据到数据库...");
    
    // 检查是否已有数据库记录，避免重复迁移
    const existingCount = await db.select().from(memories);
    if (existingCount.length > 0) {
      log(`数据库中已有 ${existingCount.length} 条记忆记录，请确认是否继续迁移`);
      // 可以添加交互确认逻辑
    }
    
    // 基础路径
    const memoryBasePath = path.resolve(process.cwd(), 'memory_space');
    if (!fs.existsSync(memoryBasePath)) {
      log(`记忆目录不存在: ${memoryBasePath}`);
      return;
    }
    
    // 获取所有用户目录
    const userDirs = fs.readdirSync(memoryBasePath).filter(item => {
      const fullPath = path.join(memoryBasePath, item);
      return fs.statSync(fullPath).isDirectory() && !isNaN(Number(item));
    });
    
    log(`找到 ${userDirs.length} 个用户目录`);
    
    let totalMemories = 0;
    let migratedMemories = 0;
    let failedMemories = 0;
    
    // 处理每个用户目录
    for (const userDir of userDirs) {
      const userId = parseInt(userDir, 10);
      const userPath = path.join(memoryBasePath, userDir);
      const memoryFiles = fs.readdirSync(userPath).filter(file => file.endsWith('.json'));
      
      log(`用户 ${userId}: 找到 ${memoryFiles.length} 个记忆文件`);
      totalMemories += memoryFiles.length;
      
      // 检查用户是否存在
      const user = await storage.getUser(userId);
      if (!user) {
        log(`警告: 用户 ${userId} 不存在于数据库中，将跳过其记忆迁移`);
        failedMemories += memoryFiles.length;
        continue;
      }
      
      // 处理每个记忆文件
      for (const file of memoryFiles) {
        try {
          const filePath = path.join(userPath, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const memoryData: FileMemory = JSON.parse(fileContent);
          
          // 添加记忆到数据库
          const memory = await storage.createMemory(
            userId,
            memoryData.content,
            memoryData.type || 'chat',
            memoryData.summary
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
    }
    
    log(`迁移完成! 总记忆: ${totalMemories}, 成功: ${migratedMemories}, 失败: ${failedMemories}`);
    
    if (migratedMemories > 0) {
      log(`验证数据库记录...`);
      const dbCount = await db.select({ count: db.fn.count() }).from(memories);
      log(`数据库中现有 ${dbCount[0].count} 条记忆记录`);
    }
    
  } catch (error) {
    log(`迁移过程出错: ${error}`);
  }
}

// 运行迁移
migrateMemoriesToDatabase().then(() => {
  log("迁移脚本执行完毕");
}).catch(error => {
  log(`迁移脚本执行出错: ${error}`);
});