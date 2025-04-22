/**
 * 记忆修复路由
 * 用于修复用户记忆的向量嵌入
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { memories, memoryEmbeddings } from '../../shared/schema';
import { vectorEmbeddingsService } from '../services/learning/vector_embeddings';
import { log } from "../vite";

const router = Router();

// 记忆修复API
router.get('/', async (req, res) => {
  const { userId } = req.query;
  const userIdNumber = Number(userId);
  
  if (!userId || isNaN(userIdNumber)) {
    return res.status(400).json({
      success: false,
      message: '无效的用户ID',
    });
  }

  try {
    log(`开始修复用户ID=${userIdNumber}的记忆向量嵌入`, 'info');
    
    // 获取用户的所有记忆
    const userMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, userIdNumber));
    
    if (!userMemories || userMemories.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到用户记忆数据',
      });
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
        
        // 使用向量服务生成向量嵌入，使用备用方法
        // 由于Python服务可能出现问题，直接使用GenAI服务生成嵌入
        let embedding;
        try {
          log(`为记忆ID ${memory.id} 生成向量嵌入，内容长度: ${memory.content.length}`, 'info');
          embedding = await vectorEmbeddingsService.generateEmbedding(memory.content);
        } catch (embedError: any) {
          log(`使用主服务生成向量嵌入失败: ${embedError.message || embedError}，尝试备用方法`, 'warn');
          
          // 导入GenAI服务作为备用
          const { genAiService } = await import('../services/genai/genai_service');
          embedding = await genAiService.generateEmbedding(memory.content);
          
          if (!embedding) {
            log(`备用方法也无法生成向量嵌入`, 'error');
          } else {
            log(`成功使用备用方法生成向量嵌入，维度: ${embedding.length}`, 'info');
          }
        }
        
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
    
    return res.json({
      success: true,
      totalMemories: userMemories.length,
      repairedCount,
      message: `成功修复${repairedCount}条记忆数据的向量嵌入`,
    });
  } catch (error: any) {
    log(`记忆修复过程中出错: ${error.message || error}`, 'error');
    return res.status(500).json({
      success: false,
      message: `修复过程中出错: ${error.message || '未知错误'}`,
    });
  }
});

export default router;