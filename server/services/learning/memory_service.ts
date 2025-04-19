/**
 * 记忆服务
 * 负责管理记忆的创建、检索和分析
 */

import { log } from "../../vite";
import { storage } from "../../storage";
import { vectorEmbeddingsService } from "./vector_embeddings";
import { memorySummarizer } from "./memory_summarizer";
import { clusterAnalyzer } from "./cluster_analyzer";
import { clusterMemoryRetrieval } from "./cluster_memory_retrieval";
import { Memory } from "@shared/schema";

export class MemoryService {
  private storageMode: "database" | "hybrid" | "file" = "database";
  private useClusterRetrieval: boolean = true; // 是否使用聚类记忆检索

  constructor() {
    // 强制使用数据库存储模式，忽略环境变量设置
    this.storageMode = "database";
    log(`[MemoryService] 初始化，存储模式: ${this.storageMode}，使用聚类检索: ${this.useClusterRetrieval}`, "info");
  }

  /**
   * 保存新记忆（简化方法名，更符合API）
   * @param userId 用户ID
   * @param content 记忆内容
   * @param type 记忆类型
   * @returns 创建的记忆ID
   */
  async saveMemory(userId: number, content: string, type: string = "chat"): Promise<number> {
    const memory = await this.createMemory(userId, content, type);
    return memory.id;
  }

  /**
   * 获取用户记忆（基于过滤条件）
   * @param userId 用户ID
   * @param filter 过滤条件
   * @returns 记忆数组
   */
  async getMemoriesByFilter(userId: number, filter?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    keywords?: string[];
  }): Promise<Memory[]> {
    try {
      // 基础：获取所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      
      // 如果没有过滤条件，直接返回所有记忆
      if (!filter) return memories;
      
      // 应用过滤条件
      return memories.filter(memory => {
        // 过滤类型
        if (filter.type && memory.type !== filter.type) {
          return false;
        }
        
        // 过滤日期（如果指定）
        if (filter.startDate || filter.endDate) {
          const memoryDate = memory.timestamp ? new Date(memory.timestamp) : null;
          if (!memoryDate) return false;
          
          if (filter.startDate) {
            const startDate = new Date(filter.startDate);
            if (memoryDate < startDate) return false;
          }
          
          if (filter.endDate) {
            const endDate = new Date(filter.endDate);
            if (memoryDate > endDate) return false;
          }
        }
        
        // 如果没有关键词过滤，该记忆通过检查
        if (!filter.keywords || filter.keywords.length === 0) {
          return true;
        }
        
        // 由于Memory接口没有keywords属性，需要异步获取关键词，但这里无法使用
        // 现在我们只是返回true，实际需要优化此处以获取和过滤关键词
        // 如果真需要关键词过滤，应该提前获取所有记忆的关键词
        return true;
      });
    } catch (error) {
      log(`[MemoryService] 获取记忆时出错: ${error}`, "error");
      return [];
    }
  }

  /**
   * 创建新记忆并生成必要的元数据（内部方法）
   * @param userId 用户ID
   * @param content 记忆内容
   * @param type 记忆类型
   * @returns 创建的记忆对象
   */
  private async createMemory(userId: number, content: string, type: string = "chat"): Promise<Memory> {
    try {
      // 1. 生成摘要
      const summary = await this.summarizeMemory(content);
      
      // 2. 创建基本记忆
      const memory = await storage.createMemory(userId, content, type, summary || undefined);
      
      // 3. 提取关键词
      const keywords = await this.extractKeywords(content);
      if (keywords && keywords.length > 0) {
        for (const keyword of keywords) {
          await storage.addKeywordToMemory(memory.id, keyword);
        }
      }
      
      // 4. 生成向量嵌入
      const embedding = await this.generateEmbedding(content);
      if (embedding) {
        await storage.saveMemoryEmbedding(memory.id, embedding);
      }
      
      // 5. 清除用户的聚类缓存，因为已添加新记忆
      clusterMemoryRetrieval.clearUserClusterCache(userId);
      
      return memory;
    } catch (error) {
      log(`[MemoryService] 创建记忆时出错: ${error}`, "error");
      throw error;
    }
  }

  /**
   * 生成摘要
   * @param content 内容
   * @returns 摘要
   */
  async summarizeMemory(content: string): Promise<string | null> {
    return memorySummarizer.summarizeText(content);
  }

  /**
   * 提取关键词
   * @param content 内容
   * @returns 关键词数组
   */
  async extractKeywords(content: string): Promise<string[] | null> {
    return memorySummarizer.extractKeywords(content);
  }

  /**
   * 生成嵌入向量
   * @param content 内容
   * @returns 向量嵌入
   */
  async generateEmbedding(content: string): Promise<number[] | null> {
    return vectorEmbeddingsService.generateEmbedding(content);
  }

  /**
   * 查找与查询语义相似的记忆
   * 使用优化的聚类检索方法
   * 
   * @param query 查询文本
   * @param userId 用户ID
   * @param options 查询选项
   * @returns 相似记忆
   */
  async findSimilarMemories(query: string, userId: number, options: { limit?: number } = {}): Promise<Memory[]> {
    const limit = options.limit || 5;
    try {
      // 根据设置决定使用聚类检索还是直接向量检索
      if (this.useClusterRetrieval) {
        // 使用基于聚类的检索方法
        log(`[MemoryService] 使用聚类记忆检索，用户ID=${userId}，查询="${query.substring(0, 30)}..."`);
        return clusterMemoryRetrieval.retrieveClusterMemories(userId, query, limit);
      } else {
        // 使用标准向量检索方法
        log(`[MemoryService] 使用标准向量记忆检索，用户ID=${userId}，查询="${query.substring(0, 30)}..."`);
        return vectorEmbeddingsService.findSimilarMemories(userId, query, limit);
      }
    } catch (error) {
      log(`[MemoryService] 找不到相似记忆，回退到标准检索: ${error}`, "warn");
      return vectorEmbeddingsService.findSimilarMemories(userId, query, limit);
    }
  }

  /**
   * 分析记忆聚类，找出主题和学习模式
   * @param userId 用户ID
   * @param memories 记忆对象数组
   * @param embeddings 记忆向量数组
   * @returns 聚类结果
   */
  async analyzeMemoryClusters(userId: number, memories: Memory[], embeddings: number[][]): Promise<any> {
    try {
      // 确保是同一用户的记忆
      const filteredMemories = memories.filter(memory => memory.userId === userId);
      if (filteredMemories.length !== memories.length) {
        log(`[MemoryService] 警告: 过滤掉了${memories.length - filteredMemories.length}条非用户${userId}的记忆`, "warn");
      }
      
      if (filteredMemories.length < 5) {
        return { topics: [], error: "Not enough memories for clustering" };
      }
      
      // 确保内存向量和记忆数量匹配
      if (filteredMemories.length !== embeddings.length) {
        log(`[MemoryService] 错误: 记忆数量(${filteredMemories.length})与向量数量(${embeddings.length})不匹配`, "error");
        return { topics: [], error: "Memory and embedding count mismatch" };
      }
      
      // 执行聚类分析
      return clusterAnalyzer.analyzeMemoryClusters(filteredMemories, embeddings);
    } catch (error) {
      log(`[MemoryService] 记忆聚类分析出错: ${error}`, "error");
      return { topics: [], error: "Clustering analysis failed" };
    }
  }

  /**
   * 整理记忆数据，添加缺失的摘要、关键词和向量嵌入
   * @param userId 用户ID
   * @returns 修复结果对象
   */
  async repairUserMemories(userId: number): Promise<{
    repaired: number,
    total: number,
    fixedSummaries: number,
    fixedKeywords: number,
    fixedEmbeddings: number
  }> {
    try {
      // 获取用户的所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      let repairedCount = 0;
      let fixedSummariesCount = 0;
      let fixedKeywordsCount = 0;
      let fixedEmbeddingsCount = 0;
      
      log(`[MemoryService] 开始修复用户 ${userId} 的记忆，共有 ${memories.length} 条记忆`);
      
      // 逐个处理每条记忆
      for (const memory of memories) {
        let needsRepair = false;
        let updatedContent = undefined;
        let updatedSummary = undefined;
        
        // 检查并修复内容
        if (!memory.content || memory.content.trim() === '') {
          updatedContent = "此记忆内容为空";
          needsRepair = true;
        }
        
        // 检查并修复摘要
        if (!memory.summary || memory.summary.trim() === '') {
          const summary = await this.summarizeMemory(memory.content || "");
          if (summary) {
            updatedSummary = summary;
            needsRepair = true;
            fixedSummariesCount++;
            log(`[MemoryService] 为记忆 ${memory.id} 生成摘要: "${summary.substring(0, 30)}..."`);
          }
        }
        
        // 检查是否有关键词
        const keywords = await storage.getKeywordsByMemoryId(memory.id);
        if (keywords.length === 0) {
          const extractedKeywords = await this.extractKeywords(memory.content || "");
          if (extractedKeywords && extractedKeywords.length > 0) {
            // 添加新关键词
            for (const keyword of extractedKeywords) {
              await storage.addKeywordToMemory(memory.id, keyword);
            }
            needsRepair = true;
            fixedKeywordsCount++;
            log(`[MemoryService] 为记忆 ${memory.id} 添加关键词: ${extractedKeywords.join(', ')}`);
          }
        }
        
        // 检查是否有向量嵌入
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        if (!embedding && memory.content) {
          const vectorData = await this.generateEmbedding(memory.content);
          if (vectorData) {
            await storage.saveMemoryEmbedding(memory.id, vectorData);
            needsRepair = true;
            fixedEmbeddingsCount++;
            log(`[MemoryService] 为记忆 ${memory.id} 生成向量嵌入，维度=${vectorData.length}`);
          }
        }
        
        // 如果需要修复，更新记忆
        if (needsRepair && (updatedContent || updatedSummary)) {
          await storage.updateMemory(memory.id, updatedContent, updatedSummary);
          repairedCount++;
        } else if (needsRepair) {
          // 只更新了关键词或向量嵌入
          repairedCount++;
        }
      }
      
      // 如果修复了记忆，清除聚类缓存
      if (repairedCount > 0) {
        clusterMemoryRetrieval.clearUserClusterCache(userId);
        log(`[MemoryService] 已清除用户 ${userId} 的聚类缓存，以反映修复的记忆`);
      }
      
      const result = {
        repaired: repairedCount,
        total: memories.length,
        fixedSummaries: fixedSummariesCount,
        fixedKeywords: fixedKeywordsCount,
        fixedEmbeddings: fixedEmbeddingsCount
      };
      
      log(`[MemoryService] 用户 ${userId} 的记忆修复完成: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      log(`[MemoryService] 修复用户记忆时出错: ${error}`, "error");
      return {
        repaired: 0,
        total: 0,
        fixedSummaries: 0,
        fixedKeywords: 0,
        fixedEmbeddings: 0
      };
    }
  }
  
  /**
   * 获取用户的聚类主题
   * @param userId 用户ID
   * @returns 聚类主题数组
   */
  async getUserClusterTopics(userId: number): Promise<any[]> {
    return clusterMemoryRetrieval.getUserClusterTopics(userId);
  }
}

// 导出服务实例
export const memoryService = new MemoryService();