/**
 * 向量嵌入服务
 * 负责生成和管理文本的向量表示
 */

import { log } from "../../vite";
import { genAiService } from "../genai/genai_service";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";

export class VectorEmbeddingsService {
  /**
   * 生成文本的向量嵌入
   * @param text 输入文本
   * @returns 向量嵌入
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        log('[vector_embeddings] 无法为空文本生成嵌入', 'warn');
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
      
      // 使用GenAI服务生成嵌入
      const embedding = await genAiService.generateEmbedding(truncatedText);
      
      if (!embedding) {
        log('[vector_embeddings] 生成嵌入失败', 'error');
        return null;
      }

      return embedding;
    } catch (error) {
      log(`[vector_embeddings] 生成嵌入时出错: ${error}`, 'error');
      return null;
    }
  }

  /**
   * 为记忆生成并保存向量嵌入
   * @param memoryId 记忆ID
   * @param content 记忆内容
   * @returns 成功标志
   */
  async generateAndSaveEmbedding(memoryId: number | string, content: string): Promise<boolean> {
    try {
      // 首先检查是否已有嵌入
      // 确保memoryId作为字符串传递给storage.getEmbeddingByMemoryId
      const memoryIdStr = String(memoryId);
      const existingEmbedding = await storage.getEmbeddingByMemoryId(memoryIdStr);
      if (existingEmbedding) {
        log(`[vector_embeddings] 记忆 ${memoryIdStr} 已有嵌入，跳过生成`, 'info');
        return true;
      }

      // 生成嵌入
      const embedding = await this.generateEmbedding(content);
      if (!embedding) {
        return false;
      }

      // 保存嵌入
      await storage.saveMemoryEmbedding(memoryIdStr, embedding);
      log(`[vector_embeddings] 记忆 ${memoryIdStr} 的嵌入已保存`, 'info');
      
      return true;
    } catch (error) {
      log(`[vector_embeddings] 保存记忆嵌入时出错: ${error}`, 'error');
      return false;
    }
  }

  /**
   * 批量为记忆生成向量嵌入
   * @param memories 记忆对象数组
   * @returns 成功生成嵌入的记忆数量
   */
  async batchGenerateEmbeddings(memories: Memory[]): Promise<number> {
    let successCount = 0;

    for (const memory of memories) {
      // 跳过空内容
      if (!memory.content || memory.content.trim().length === 0) {
        continue;
      }

      try {
        const success = await this.generateAndSaveEmbedding(memory.id, memory.content);
        if (success) {
          successCount++;
        }
      } catch (error) {
        log(`[vector_embeddings] 处理记忆 ${memory.id} 时出错: ${error}`, 'error');
      }
    }

    return successCount;
  }

  /**
   * 查找与输入文本语义相似的记忆
   * @param userId 用户ID
   * @param text 查询文本
   * @param limit 最大结果数
   * @returns 相似记忆数组
   */
  async findSimilarMemories(userId: number, text: string, limit: number = 5): Promise<Memory[]> {
    try {
      // 生成查询文本的向量嵌入
      const queryEmbedding = await this.generateEmbedding(text);
      if (!queryEmbedding) {
        log('[vector_embeddings] 无法为查询生成嵌入', 'error');
        return [];
      }

      // 使用存储服务查找相似记忆
      const similarMemories = await storage.findSimilarMemories(userId, queryEmbedding, limit);
      return similarMemories;
    } catch (error) {
      log(`[vector_embeddings] 查找相似记忆时出错: ${error}`, 'error');
      return [];
    }
  }
}

// 导出服务实例
export const vectorEmbeddingsService = new VectorEmbeddingsService();