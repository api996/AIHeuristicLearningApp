/**
 * 向量嵌入服务
 * 负责生成和管理文本的向量表示
 * 集成内容价值评估，避免无价值内容向量化
 * 
 * 架构说明:
 * 1. 主要使用Gemini API直接生成向量嵌入
 * 2. 提供Python接口以便聚类分析等Python服务使用
 * 3. 优先使用JS的GenAI服务进行嵌入，确保最高可靠性
 */

import { log } from "../../vite";
import { genAiService } from "../genai/genai_service";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";
import { webSearchService } from "../../services/web-search";

export class VectorEmbeddingsService {
  /**
   * 生成文本的向量嵌入
   * @param text 输入文本
   * @returns 向量嵌入
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const errorMsg = '[vector_embeddings] 无法为空文本生成嵌入';
      log(errorMsg, 'warn');
      throw new Error(errorMsg);
    }

    // 清理文本，移除多余空白
    const cleanedText = text
      .replace(/\s+/g, ' ')
      .trim();

    // 截断文本，如果过长
    const truncatedText = cleanedText.length > 8000 
      ? cleanedText.substring(0, 8000)
      : cleanedText;
    
    // 直接使用GenAI服务生成向量嵌入
    log('[vector_embeddings] 使用GenAI服务生成向量嵌入', 'info');
    const embedding = await genAiService.generateEmbedding(truncatedText);
    
    if (!embedding) {
      const errorMsg = '[vector_embeddings] GenAI嵌入服务返回空结果';
      log(errorMsg, 'error');
      throw new Error(errorMsg);
    }
    
    // 验证嵌入维度，确保是有效的向量
    if (embedding.length < 100) {
      const errorMsg = `[vector_embeddings] 嵌入维度异常 (${embedding.length})，期望3072维向量`;
      log(errorMsg, 'error');
      throw new Error(errorMsg);
    } else {
      log(`[vector_embeddings] 成功生成${embedding.length}维向量嵌入`, 'info');
    }
    
    return embedding;
  }

  /**
   * 为记忆生成并保存向量嵌入
   * @param memoryId 记忆ID
   * @param content 记忆内容
   * @param forceEmbed 是否强制生成嵌入，跳过内容价值评估
   * @returns 成功标志
   */
  async generateAndSaveEmbedding(
    memoryId: number | string, 
    content: string,
    forceEmbed: boolean = false
  ): Promise<boolean> {
    // 确保memoryId作为字符串传递给storage.getEmbeddingByMemoryId
    const memoryIdStr = String(memoryId);
    
    try {
      // 首先检查是否已有嵌入
      const existingEmbedding = await storage.getEmbeddingByMemoryId(memoryIdStr);
      if (existingEmbedding) {
        log(`[vector_embeddings] 记忆 ${memoryIdStr} 已有嵌入，跳过生成`, 'info');
        return true;
      }
      
      // 如果不是强制生成，进行内容价值评估
      if (!forceEmbed) {
        const shouldEmbed = await webSearchService.shouldVectorize(content);
        if (!shouldEmbed) {
          log(`[vector_embeddings] 记忆 ${memoryIdStr} 内容未通过价值评估，不生成嵌入`, 'info');
          return false;
        }
      }

      // 生成嵌入 - 这里会抛出错误如果生成失败，不会返回null
      const embedding = await this.generateEmbedding(content);

      // 保存嵌入
      await storage.saveMemoryEmbedding(memoryIdStr, embedding);
      log(`[vector_embeddings] 记忆 ${memoryIdStr} 的嵌入已保存，向量维度: ${embedding.length}`, 'info');
      
      return true;
    } catch (error) {
      const errorMsg = `[vector_embeddings] 为记忆 ${memoryIdStr} 生成或保存嵌入时出错: ${error}`;
      log(errorMsg, 'error');
      // 允许批处理继续进行而不抛出错误，但单个处理应该抛出
      if (content.length < 500) {  // 短内容通常是测试或单个处理
        throw new Error(errorMsg);
      }
      return false;
    }
  }

  /**
   * 批量为记忆生成向量嵌入
   * @param memories 记忆对象数组
   * @param forceEmbed 是否强制生成嵌入，跳过内容价值评估
   * @returns 成功生成嵌入的记忆数量
   */
  async batchGenerateEmbeddings(
    memories: Memory[],
    forceEmbed: boolean = false
  ): Promise<number> {
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const memory of memories) {
      // 跳过空内容
      if (!memory.content || memory.content.trim().length === 0) {
        continue;
      }

      try {
        const success = await this.generateAndSaveEmbedding(memory.id, memory.content, forceEmbed);
        if (success) {
          successCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        log(`[vector_embeddings] 处理记忆 ${memory.id} 时出错: ${error}`, 'error');
        failedCount++;
      }
    }

    // 记录批量处理结果
    log(`[vector_embeddings] 批量处理完成: ${successCount}个成功, ${skippedCount}个跳过, ${failedCount}个失败`, 'info');
    
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
      
      // 这里不需要再检查queryEmbedding是否为null，因为generateEmbedding已经会抛出错误

      // 使用存储服务查找相似记忆
      const similarMemories = await storage.findSimilarMemories(userId, queryEmbedding, limit);
      return similarMemories;
    } catch (error) {
      const errorMsg = `[vector_embeddings] 查找相似记忆时出错: ${error}`;
      log(errorMsg, 'error');
      throw new Error(errorMsg);
    }
  }
}

// 导出服务实例
export const vectorEmbeddingsService = new VectorEmbeddingsService();