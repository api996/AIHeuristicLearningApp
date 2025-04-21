/**
 * 优化的嵌入服务
 * 使用Anthropic服务预筛选内容价值，只为有价值的内容生成嵌入
 */

import { anthropicService } from './anthropic-service';
import { getGenAI } from '../utils/genai';
import { EmbeddingCache } from '../utils/embedding-cache';

// 缓存实例
const embeddingCache = new EmbeddingCache();

/**
 * 优化的嵌入服务类
 */
export class OptimizedEmbeddingService {
  private valueThreshold = 0.4; // 内容价值阈值，低于此值不生成嵌入
  private minimumContentLength = 15; // 最小内容长度
  private initialized = false;
  private genAI: any = null;
  
  constructor() {
    this.init();
  }
  
  /**
   * 初始化服务
   */
  private async init() {
    try {
      this.genAI = await getGenAI();
      this.initialized = true;
      console.log('[OptimizedEmbeddingService] 服务初始化成功');
    } catch (error) {
      console.error('[OptimizedEmbeddingService] 初始化错误:', error);
    }
  }
  
  /**
   * 生成文本内容的向量嵌入
   * 包含内容价值预筛选和嵌入缓存
   * @param content 文本内容
   * @param forceEmbed 是否强制生成嵌入，忽略价值评估
   * @returns 向量嵌入数组或null
   */
  public async generateEmbedding(content: string, forceEmbed = false): Promise<number[] | null> {
    // 检查初始化状态
    if (!this.initialized) {
      console.warn('[OptimizedEmbeddingService] 服务未初始化');
      return null;
    }
    
    // 检查内容长度
    if (content.trim().length < this.minimumContentLength) {
      console.log(`[OptimizedEmbeddingService] 内容长度(${content.trim().length})太短，不生成嵌入`);
      return null;
    }
    
    // 检查缓存
    const cachedEmbedding = embeddingCache.get(content);
    if (cachedEmbedding) {
      console.log('[OptimizedEmbeddingService] 使用缓存的嵌入向量');
      return cachedEmbedding;
    }
    
    // 如果不强制嵌入，则先进行内容价值评估
    if (!forceEmbed && anthropicService.isAvailable()) {
      try {
        console.log('[OptimizedEmbeddingService] 分析内容价值');
        const valueAnalysis = await anthropicService.analyzeContentValue(content);
        
        if (!valueAnalysis.isValuable || valueAnalysis.score < this.valueThreshold) {
          console.log(`[OptimizedEmbeddingService] 内容价值不足，评分: ${valueAnalysis.score}, 原因: ${valueAnalysis.reason}`);
          return null;
        }
        
        console.log(`[OptimizedEmbeddingService] 内容有价值，评分: ${valueAnalysis.score}, 继续生成嵌入`);
      } catch (error) {
        // 如果价值评估失败，为安全起见继续生成嵌入
        console.warn('[OptimizedEmbeddingService] 内容价值评估失败，继续生成嵌入:', error);
      }
    }
    
    // 生成嵌入
    try {
      console.log('[OptimizedEmbeddingService] 生成嵌入向量');
      
      // 使用Gemini生成嵌入
      const embeddingResult = await this.genAI.embedContent({
        content: { text: content },
        // 使用gemini-embedding-exp模型
        model: 'models/gemini-embedding-exp-03-07'
      });
      
      const embedding = embeddingResult.embedding.values;
      
      // 添加到缓存
      embeddingCache.set(content, embedding);
      
      console.log(`[OptimizedEmbeddingService] 成功生成嵌入向量，维度: ${embedding.length}`);
      return embedding;
    } catch (error) {
      console.error('[OptimizedEmbeddingService] 生成嵌入错误:', error);
      return null;
    }
  }
  
  /**
   * 为多条内容批量生成嵌入向量
   * @param contents 内容数组
   * @param forceEmbed 是否强制生成嵌入
   * @returns 嵌入向量数组
   */
  public async batchGenerateEmbeddings(
    contents: string[], 
    forceEmbed = false
  ): Promise<(number[] | null)[]> {
    const results: (number[] | null)[] = [];
    
    // 串行处理，避免API限流
    for (const content of contents) {
      const embedding = await this.generateEmbedding(content, forceEmbed);
      results.push(embedding);
    }
    
    return results;
  }
  
  /**
   * 计算两个向量之间的余弦相似度
   * @param vecA 向量A
   * @param vecB 向量B
   * @returns 相似度(0-1之间)
   */
  public calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('向量维度不匹配');
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
  }
}

// 导出服务单例
export const optimizedEmbeddingService = new OptimizedEmbeddingService();