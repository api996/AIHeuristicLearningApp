/**
 * 记忆服务
 * 负责管理记忆的创建、检索和分析
 */

import { log } from "../../vite";
import { storage } from "../../storage";
import { vectorEmbeddingsService } from "./vector_embeddings";
import { memorySummarizer } from "./memory_summarizer";
import { clusterAnalyzer } from "./cluster_analyzer";
import { Memory } from "@shared/schema";

export class MemoryService {
  private storageMode: "database" | "hybrid" | "file" = "database";

  constructor() {
    // 设置存储模式，默认使用数据库
    this.storageMode = (process.env.MEMORY_STORAGE_MODE || "database") as "database" | "hybrid" | "file";
    log(`[MemoryService] 初始化，存储模式: ${this.storageMode}`, "info");
  }

  /**
   * 创建新记忆并生成必要的元数据
   * @param userId 用户ID
   * @param content 记忆内容
   * @param type 记忆类型
   * @returns 创建的记忆对象
   */
  async createMemory(userId: number, content: string, type: string = "chat"): Promise<Memory> {
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
   * @param userId 用户ID
   * @param query 查询文本
   * @param limit 最大结果数
   * @returns 相似记忆
   */
  async findSimilarMemories(userId: number, query: string, limit: number = 5): Promise<Memory[]> {
    return vectorEmbeddingsService.findSimilarMemories(userId, query, limit);
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
   * @returns 修复的记忆数量
   */
  async repairUserMemories(userId: number): Promise<number> {
    try {
      // 获取用户的所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      let repairedCount = 0;
      
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
          }
        }
        
        // 检查是否有向量嵌入
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        if (!embedding && memory.content) {
          const vectorData = await this.generateEmbedding(memory.content);
          if (vectorData) {
            await storage.saveMemoryEmbedding(memory.id, vectorData);
            needsRepair = true;
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
      
      return repairedCount;
    } catch (error) {
      log(`[MemoryService] 修复用户记忆时出错: ${error}`, "error");
      return 0;
    }
  }
}

// 导出服务实例
export const memoryService = new MemoryService();