/**
 * 记忆修复路由
 * 用于修复用户记忆的向量嵌入
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { memories, memoryEmbeddings } from '../../shared/schema';
import { vectorEmbeddingsService } from '../services/learning/vector_embeddings';
import { log } from "../../vite";

const router = Router();

// 记忆修复API
router.get('/repair-memory', async (req, res) => {
  const { userId } = req.query;
  const userIdNumber = Number(userId);
  
  if (!userId || isNaN(userIdNumber)) {
    return res.status(400).json({
      success: false,
      message: '无效的用户ID',
    });
  }

  try {
    logger.info(`开始修复用户ID=${userIdNumber}的记忆向量嵌入`);
    
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
    
    logger.info(`找到${userMemories.length}条记忆数据需要修复`);
    
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
          logger.warn(`记忆ID ${memory.id} 内容无效，跳过向量化`);
          continue;
        }
        
        // 生成向量嵌入
        const embedding = await vectorize(memory.content);
        
        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          logger.warn(`记忆ID ${memory.id} 向量化失败，跳过`);
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
        logger.info(`修复记忆ID ${memory.id} 的向量嵌入成功`);
      } catch (error) {
        logger.error(`修复记忆ID ${memory.id} 时出错: ${error.message}`);
      }
    }
    
    logger.info(`成功修复${repairedCount}/${userMemories.length}条记忆的向量嵌入`);
    
    return res.json({
      success: true,
      totalMemories: userMemories.length,
      repairedCount,
      message: `成功修复${repairedCount}条记忆数据的向量嵌入`,
    });
  } catch (error) {
    logger.error(`记忆修复过程中出错: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `修复过程中出错: ${error.message}`,
    });
  }
});

export default router;