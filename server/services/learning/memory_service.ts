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
   * @param userId 用户ID
   * @param query 查询文本
   * @param limit 最大结果数
   * @returns 相似记忆
   */
  async findSimilarMemories(userId: number, query: string, limit: number = 5): Promise<Memory[]> {
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
   * @param memories 记忆对象数组（ID必须为字符串类型）
   * @param embeddings 记忆向量数组
   * @returns 聚类结果
   */
  async analyzeMemoryClusters(userId: number, memories: { 
    id: string; 
    userId: number; 
    content: string; 
    type: string; 
    timestamp: Date | null; 
    summary: string | null; 
    createdAt: Date | null; 
  }[], embeddings: number[][]): Promise<any> {
    try {
      // 记录向量维度信息，用于调试
      if (embeddings && embeddings.length > 0) {
        const vectorDimensions = embeddings[0].length;
        log(`[MemoryService] 记忆聚类分析: 用户ID=${userId}, 记忆数量=${memories.length}, 向量维度=${vectorDimensions}`);
        
        // 记录第一个向量的前5个值，以便调试
        if (embeddings[0] && embeddings[0].length > 5) {
          const sample = embeddings[0].slice(0, 5).map(v => v.toFixed(4)).join(', ');
          log(`[MemoryService] 向量样本 [${sample}...]`);
        }
        
        // 检查向量是否为高维向量(3072维)
        if (vectorDimensions >= 3000) {
          log(`[MemoryService] 检测到高维向量(${vectorDimensions}维)，将使用优化的Python聚类服务`);
        } else {
          log(`[MemoryService] 警告: 检测到低维向量(${vectorDimensions}维)，可能导致聚类效果不佳`, "warn");
        }
      }
      
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
      const result = await clusterAnalyzer.analyzeMemoryClusters(filteredMemories, embeddings);
      
      // 记录分析结果
      if (result && result.topics) {
        log(`[MemoryService] 聚类分析成功: 发现 ${result.topics.length} 个主题聚类`);
      }
      
      return result;
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
      
      // 如果修复了记忆，清除聚类缓存
      if (repairedCount > 0) {
        clusterMemoryRetrieval.clearUserClusterCache(userId);
      }
      
      return repairedCount;
    } catch (error) {
      log(`[MemoryService] 修复用户记忆时出错: ${error}`, "error");
      return 0;
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
  
  /**
   * 测试Python聚类服务
   * 使用随机生成的高维向量验证聚类功能
   */
  async testPythonClustering(): Promise<boolean> {
    try {
      log(`[MemoryService] 开始测试Python聚类服务...`);
      
      // 创建测试向量数据
      const testVectors = this.generateTestVectors(10, 3072);
      log(`[MemoryService] 已生成 ${testVectors.length} 个测试向量，每个维度为 3072`);
      
      // 从cluster_analyzer导入pythonClusteringService
      const { pythonClusteringService } = await import('./python_clustering');
      
      // 直接调用Python聚类服务
      const result = await pythonClusteringService.clusterVectors(testVectors);
      
      if (result && result.centroids && result.centroids.length > 0) {
        log(`[MemoryService] Python聚类服务测试成功，生成 ${result.centroids.length} 个聚类`);
        return true;
      } else {
        log(`[MemoryService] Python聚类服务测试失败: 未能生成有效聚类`, "error");
        return false;
      }
    } catch (error) {
      log(`[MemoryService] Python聚类服务测试出错: ${error}`, "error");
      return false;
    }
  }
  
  /**
   * 生成测试用高维向量
   * @param count 向量数量
   * @param dimension 向量维度
   */
  private generateTestVectors(count: number, dimension: number): {id: string, vector: number[]}[] {
    const vectors = [];
    
    for (let i = 0; i < count; i++) {
      const vector = Array.from({ length: dimension }, () => Math.random() - 0.5);
      vectors.push({
        id: `test_${i}`,
        vector
      });
    }
    
    return vectors;
  }
}

// 创建并导出MemoryService实例
export const memoryService = new MemoryService();
