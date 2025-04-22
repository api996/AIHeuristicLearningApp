/**
 * 记忆修复帮助工具
 * 提供修复记忆向量嵌入的功能
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { memories, memoryEmbeddings } from '../../shared/schema';
import { genAiService } from "../services/genai/genai_service";
import { log } from "../vite";

/**
 * 修复用户的记忆向量嵌入
 * @param userId 用户ID
 * @returns 修复结果
 */
export async function repairUserMemoryEmbeddings(userId: number): Promise<{
  success: boolean;
  totalMemories: number;
  repairedCount: number;
  message: string;
}> {
  try {
    log(`开始修复用户ID=${userId}的记忆向量嵌入`, 'info');
    
    // 获取用户的所有记忆
    const userMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, userId));
    
    if (!userMemories || userMemories.length === 0) {
      return {
        success: false,
        totalMemories: 0,
        repairedCount: 0,
        message: '未找到用户记忆数据',
      };
    }
    
    log(`找到${userMemories.length}条记忆数据需要修复`, 'info');
    
    let repairedCount = 0;
    
    // 为每条记忆生成向量嵌入
    for (const memory of userMemories) {
      try {
        // 获取现有的嵌入数据
        const existingEmbedding = await db
          .select()
          .from(memoryEmbeddings)
          .where(eq(memoryEmbeddings.memoryId, memory.id))
          .limit(1);
        
        // 检查记忆内容是否有效
        if (!memory.content || typeof memory.content !== 'string') {
          log(`记忆ID ${memory.id} 内容无效，跳过向量化`, 'warn');
          continue;
        }
        
        // 直接使用genAiService生成向量嵌入
        const embedding = await genAiService.generateEmbedding(memory.content);
        
        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          log(`记忆ID ${memory.id} 向量化失败，跳过`, 'warn');
          continue;
        }
        
        if (existingEmbedding && existingEmbedding.length > 0) {
          // 更新现有嵌入
          await db
            .update(memoryEmbeddings)
            .set({ vectorData: embedding })
            .where(eq(memoryEmbeddings.id, existingEmbedding[0].id));
        } else {
          // 创建新嵌入
          await db.insert(memoryEmbeddings).values({
            memoryId: memory.id,
            vectorData: embedding,
          });
        }
        
        repairedCount++;
        log(`修复记忆ID ${memory.id} 的向量嵌入成功`, 'info');
      } catch (error: any) {
        log(`修复记忆ID ${memory.id} 时出错: ${error.message || error}`, 'error');
      }
    }
    
    log(`成功修复${repairedCount}/${userMemories.length}条记忆的向量嵌入`, 'info');
    
    return {
      success: true,
      totalMemories: userMemories.length,
      repairedCount,
      message: `成功修复${repairedCount}条记忆数据的向量嵌入`,
    };
  } catch (error: any) {
    log(`记忆修复过程中出错: ${error.message || error}`, 'error');
    return {
      success: false,
      totalMemories: 0,
      repairedCount: 0,
      message: `修复过程中出错: ${error.message || '未知错误'}`,
    };
  }
}