/**
 * 优化的向量嵌入服务
 * 集成内容价值分析，减少不必要的嵌入生成
 */

import { log } from "../../vite";
import { vectorEmbeddingsService } from "./vector_embeddings";
import { contentValueAnalyzer } from "../content-value-analyzer";
import { Memory } from "@shared/schema";
import { storage } from "../../storage";

/**
 * 嵌入缓存条目接口
 */
interface EmbeddingCacheEntry {
  content: string;   // 原始内容 
  embedding: number[];  // 向量嵌入
  timestamp: number;    // 缓存时间戳
}

/**
 * 优化的向量嵌入服务
 * 具有内容价值预筛选和嵌入缓存功能
 */
export class OptimizedEmbeddingsService {
  private cacheEnabled: boolean = true;
  private contentPrefilteringEnabled: boolean = true;
  private valueThreshold: number = 0.4; // 内容价值阈值
  
  // 嵌入缓存
  private embeddingCache: Map<string, EmbeddingCacheEntry> = new Map();
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 缓存有效期7天
  private readonly MAX_CACHE_SIZE = 500; // 最大缓存条目数
  
  constructor() {
    // 检查内容预筛选是否启用
    this.contentPrefilteringEnabled = process.env.ENABLE_CONTENT_PRESCREENING === '1';
    
    log(`[OptimizedEmbeddings] 初始化, 缓存=${this.cacheEnabled}, 内容预筛选=${this.contentPrefilteringEnabled}, 价值阈值=${this.valueThreshold}`);
  }
  
  /**
   * 生成文本的向量嵌入
   * 包含内容价值预筛选和缓存机制
   * @param content 文本内容
   * @param forceEmbed 是否强制生成嵌入，忽略价值评估
   * @returns 向量嵌入或null
   */
  public async generateEmbedding(
    content: string,
    forceEmbed: boolean = false
  ): Promise<number[] | null> {
    try {
      // 检查内容是否为空
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        log('[OptimizedEmbeddings] 无法为空文本生成嵌入', 'warn');
        return null;
      }
      
      // 清理文本
      const cleanedContent = content
        .replace(/\s+/g, ' ')
        .trim();
      
      // 检查缓存
      if (this.cacheEnabled) {
        const cachedEmbedding = this.getCachedEmbedding(cleanedContent);
        if (cachedEmbedding) {
          log('[OptimizedEmbeddings] 使用缓存的嵌入向量');
          return cachedEmbedding;
        }
      }
      
      // 如果启用了内容预筛选且不是强制嵌入，先评估内容价值
      if (this.contentPrefilteringEnabled && !forceEmbed) {
        const shouldEmbed = await contentValueAnalyzer.shouldGenerateEmbedding(cleanedContent);
        if (!shouldEmbed) {
          log('[OptimizedEmbeddings] 内容未通过价值评估，跳过嵌入生成');
          return null;
        }
      }
      
      // 生成嵌入
      const embedding = await vectorEmbeddingsService.generateEmbedding(cleanedContent);
      
      // 如果成功生成，添加到缓存
      if (embedding && this.cacheEnabled) {
        this.cacheEmbedding(cleanedContent, embedding);
      }
      
      return embedding;
    } catch (error) {
      log(`[OptimizedEmbeddings] 生成嵌入错误: ${error}`, 'error');
      return null;
    }
  }
  
  /**
   * 批量生成嵌入向量
   * 使用价值分析服务预筛选内容
   * @param contents 内容数组
   * @param forceEmbed 是否强制生成嵌入
   * @returns 嵌入向量数组(可能包含null)
   */
  public async batchGenerateEmbeddings(
    contents: string[],
    forceEmbed: boolean = false
  ): Promise<(number[] | null)[]> {
    try {
      const results: (number[] | null)[] = [];
      
      // 顺序处理每个内容，避免API限流
      for (const content of contents) {
        const embedding = await this.generateEmbedding(content, forceEmbed);
        results.push(embedding);
      }
      
      log(`[OptimizedEmbeddings] 批量生成完成，成功率: ${results.filter(e => e !== null).length}/${contents.length}`);
      return results;
    } catch (error) {
      log(`[OptimizedEmbeddings] 批量生成嵌入错误: ${error}`, 'error');
      return contents.map(() => null);
    }
  }
  
  /**
   * 为记忆生成并保存嵌入向量
   * 包含内容价值预筛选
   * @param memoryId 记忆ID
   * @param content 记忆内容
   * @param forceEmbed 是否强制生成嵌入
   * @returns 是否成功
   */
  public async generateAndSaveEmbedding(
    memoryId: string | number,
    content: string,
    forceEmbed: boolean = false
  ): Promise<boolean> {
    try {
      // 确保memoryId是字符串
      const memoryIdStr = String(memoryId);
      
      // 检查是否已有嵌入
      const existingEmbedding = await storage.getEmbeddingByMemoryId(memoryIdStr);
      if (existingEmbedding) {
        log(`[OptimizedEmbeddings] 记忆 ${memoryIdStr} 已有嵌入，跳过生成`, 'info');
        return true;
      }
      
      // 生成优化的嵌入
      const embedding = await this.generateEmbedding(content, forceEmbed);
      if (!embedding) {
        if (this.contentPrefilteringEnabled && !forceEmbed) {
          log(`[OptimizedEmbeddings] 记忆 ${memoryIdStr} 内容未通过价值评估，不生成嵌入`, 'info');
        } else {
          log(`[OptimizedEmbeddings] 记忆 ${memoryIdStr} 嵌入生成失败`, 'warn');
        }
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
   * 批量为记忆生成嵌入向量
   * @param memories 记忆数组
   * @param forceEmbed 是否强制生成嵌入
   * @returns 成功生成的数量
   */
  public async batchProcessMemories(
    memories: Memory[],
    forceEmbed: boolean = false
  ): Promise<number> {
    let successCount = 0;
    
    for (const memory of memories) {
      // 跳过空内容
      if (!memory.content || memory.content.trim().length === 0) {
        continue;
      }
      
      try {
        const success = await this.generateAndSaveEmbedding(memory.id, memory.content, forceEmbed);
        if (success) {
          successCount++;
        }
      } catch (error) {
        log(`[OptimizedEmbeddings] 处理记忆 ${memory.id} 时出错: ${error}`, 'error');
      }
    }
    
    return successCount;
  }
  
  /**
   * 查找与文本语义相似的记忆
   * @param userId 用户ID
   * @param text 查询文本
   * @param limit 最大结果数
   * @returns 相似记忆
   */
  public async findSimilarMemories(
    userId: number,
    text: string,
    limit: number = 5
  ): Promise<Memory[]> {
    // 直接使用原始服务，不进行内容价值筛选
    return await vectorEmbeddingsService.findSimilarMemories(userId, text, limit);
  }
  
  /**
   * 计算两个向量的余弦相似度
   * @param vecA 向量A
   * @param vecB 向量B
   * @returns 相似度 (0-1)
   */
  public calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    try {
      if (vecA.length !== vecB.length) {
        log(`[OptimizedEmbeddings] 向量维度不匹配: ${vecA.length} vs ${vecB.length}`, 'warn');
        return 0;
      }
      
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
      }
      
      normA = Math.sqrt(normA);
      normB = Math.sqrt(normB);
      
      if (normA === 0 || normB === 0) {
        return 0;
      }
      
      return dotProduct / (normA * normB);
    } catch (error) {
      log(`[OptimizedEmbeddings] 计算相似度错误: ${error}`, 'error');
      return 0;
    }
  }
  
  /**
   * 生成缓存键
   * @param content 内容文本
   * @returns 缓存键
   */
  private generateCacheKey(content: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return `emb_${hash.toString(16)}`;
  }
  
  /**
   * 从缓存获取嵌入向量
   * @param content 内容文本
   * @returns 缓存的嵌入向量或null
   */
  private getCachedEmbedding(content: string): number[] | null {
    const cacheKey = this.generateCacheKey(content);
    const entry = this.embeddingCache.get(cacheKey);
    
    if (entry && (Date.now() - entry.timestamp) < this.CACHE_TTL) {
      return entry.embedding;
    }
    
    // 删除过期缓存
    if (entry) {
      this.embeddingCache.delete(cacheKey);
    }
    
    return null;
  }
  
  /**
   * 缓存嵌入向量
   * @param content 内容文本
   * @param embedding 嵌入向量
   */
  private cacheEmbedding(content: string, embedding: number[]): void {
    const cacheKey = this.generateCacheKey(content);
    
    // 如果缓存已满，删除最旧的条目
    if (this.embeddingCache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey = '';
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.embeddingCache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.embeddingCache.delete(oldestKey);
      }
    }
    
    // 添加到缓存
    this.embeddingCache.set(cacheKey, {
      content,
      embedding,
      timestamp: Date.now()
    });
  }
  
  /**
   * 设置缓存状态
   * @param enabled 是否启用缓存
   */
  public setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    log(`[OptimizedEmbeddings] 缓存已${enabled ? '启用' : '禁用'}`);
  }
  
  /**
   * 设置内容预筛选状态
   * @param enabled 是否启用内容预筛选
   */
  public setContentPrefilteringEnabled(enabled: boolean): void {
    this.contentPrefilteringEnabled = enabled;
    log(`[OptimizedEmbeddings] 内容预筛选已${enabled ? '启用' : '禁用'}`);
  }
  
  /**
   * 设置价值阈值
   * @param threshold 阈值 (0-1)
   */
  public setValueThreshold(threshold: number): void {
    this.valueThreshold = Math.max(0, Math.min(1, threshold));
    log(`[OptimizedEmbeddings] 价值阈值已设置为 ${this.valueThreshold}`);
    
    // 同步更新内容分析器的阈值
    contentValueAnalyzer.setThreshold(this.valueThreshold);
  }
  
  /**
   * 清空嵌入缓存
   */
  public clearCache(): void {
    this.embeddingCache.clear();
    log('[OptimizedEmbeddings] 缓存已清空');
  }
}

// 导出服务实例
export const optimizedEmbeddingsService = new OptimizedEmbeddingsService();