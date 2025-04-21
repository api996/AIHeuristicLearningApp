/**
 * 优化的向量嵌入服务
 * 结合内容价值评估，只为有价值的内容生成嵌入
 * 提高存储效率和查询质量
 */

import { log } from "../../vite";
import { genAiService } from "../genai/genai_service";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";
import { contentValueAnalyzer } from "../content-value-analyzer";

/**
 * 向量相似度搜索结果接口
 */
export interface VectorSearchResult {
  // 记忆ID
  memoryId: string;
  // 相似度分数
  similarity: number;
  // 记忆内容
  content?: string;
}

/**
 * 优化的嵌入处理类
 * 集成内容价值评估的向量嵌入生成服务
 */
export class OptimizedEmbeddingsService {
  private valueThreshold: number = 0.4; // 默认价值阈值
  
  constructor() {
    log('[OptimizedEmbeddings] 初始化优化嵌入服务', 'info');
    // 同步阈值设置
    this.valueThreshold = contentValueAnalyzer.getValueThreshold();
  }
  
  /**
   * 设置内容价值阈值
   * @param threshold 阈值 (0-1)
   */
  setValueThreshold(threshold: number): void {
    this.valueThreshold = Math.max(0, Math.min(1, threshold));
    // 同时更新内容分析器设置
    contentValueAnalyzer.setValueThreshold(this.valueThreshold);
    log(`[OptimizedEmbeddings] 内容价值阈值已设置为 ${this.valueThreshold}`, 'info');
  }

  /**
   * 生成文本的向量嵌入
   * @param text 输入文本
   * @returns 向量嵌入
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    return await genAiService.generateEmbedding(text);
  }

  /**
   * 智能过滤并为记忆生成向量嵌入
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
    try {
      // 首先检查是否已有嵌入
      const memoryIdStr = String(memoryId);
      const existingEmbedding = await storage.getEmbeddingByMemoryId(memoryIdStr);
      if (existingEmbedding) {
        log(`[OptimizedEmbeddings] 记忆 ${memoryIdStr} 已有嵌入，跳过生成`, 'info');
        return true;
      }
      
      // 如果不是强制生成，进行内容价值评估
      if (!forceEmbed) {
        const shouldEmbed = await contentValueAnalyzer.shouldVectorize(content);
        if (!shouldEmbed) {
          log(`[OptimizedEmbeddings] 记忆 ${memoryIdStr} 内容未通过价值评估，不生成嵌入`, 'info');
          return false;
        }
      }

      // 生成嵌入
      const embedding = await this.generateEmbedding(content);
      if (!embedding) {
        log(`[OptimizedEmbeddings] 记忆 ${memoryIdStr} 嵌入生成失败`, 'warn');
        return false;
      }

      // 保存嵌入
      await storage.saveMemoryEmbedding(memoryIdStr, embedding);
      log(`[OptimizedEmbeddings] 记忆 ${memoryIdStr} 的嵌入已保存`, 'info');
      
      return true;
    } catch (error) {
      log(`[OptimizedEmbeddings] 保存记忆嵌入时出错: ${error}`, 'error');
      return false;
    }
  }

  /**
   * 批量智能过滤并为记忆生成嵌入
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
    let notValueCount = 0;
    let failedCount = 0;

    for (const memory of memories) {
      // 跳过空内容
      if (!memory.content || memory.content.trim().length === 0) {
        skippedCount++;
        continue;
      }

      try {
        // 价值评估过滤
        if (!forceEmbed) {
          const shouldEmbed = await contentValueAnalyzer.shouldVectorize(memory.content);
          if (!shouldEmbed) {
            notValueCount++;
            continue;
          }
        }
        
        // 生成嵌入
        const success = await this.generateAndSaveEmbedding(memory.id, memory.content, true);
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        log(`[OptimizedEmbeddings] 处理记忆 ${memory.id} 时出错: ${error}`, 'error');
        failedCount++;
      }
    }

    // 记录批量处理结果
    log(`[OptimizedEmbeddings] 批量处理完成: ${successCount}个成功, ${notValueCount}个无价值跳过, ${skippedCount}个空内容, ${failedCount}个失败`, 'info');
    
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
        log('[OptimizedEmbeddings] 无法为查询生成嵌入', 'error');
        return [];
      }

      // 使用存储服务查找相似记忆
      const similarMemories = await storage.findSimilarMemories(userId, queryEmbedding, limit);
      return similarMemories;
    } catch (error) {
      log(`[OptimizedEmbeddings] 查找相似记忆时出错: ${error}`, 'error');
      return [];
    }
  }
}

// 导出服务实例
export const optimizedEmbeddingsService = new OptimizedEmbeddingsService();