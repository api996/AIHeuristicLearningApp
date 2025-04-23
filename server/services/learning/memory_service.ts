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
import { clusterCacheService } from "./cluster_cache_service";

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
      await clusterMemoryRetrieval.clearUserClusterCache(userId);
      
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
   * @param options 可选参数
   * @returns 相似记忆
   */
  async findSimilarMemories(query: string, userId: number, options: { limit?: number } = {}): Promise<Memory[]> {
    try {
      const limit = options.limit || 5;
      
      // 根据设置决定使用聚类检索还是直接向量检索
      if (this.useClusterRetrieval) {
        // 使用基于聚类的检索方法
        log(`[MemoryService] 使用聚类记忆检索，用户ID=${userId}，查询="${query.substring(0, 30)}..."`);
        return clusterMemoryRetrieval.retrieveClusterMemories(userId, query, options.limit || 5);
      } else {
        // 使用标准向量检索方法
        log(`[MemoryService] 使用标准向量记忆检索，用户ID=${userId}，查询="${query.substring(0, 30)}..."`);
        return vectorEmbeddingsService.findSimilarMemories(userId, query, options.limit || 5);
      }
    } catch (error) {
      log(`[MemoryService] 找不到相似记忆，回退到标准检索: ${error}`, "warn");
      return vectorEmbeddingsService.findSimilarMemories(userId, query, options.limit || 5);
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
          // 只在真正需要调试时记录向量样本数据
          if (process.env.DEBUG_VECTORS === 'true') {
            const sample = embeddings[0].slice(0, 5).map(v => v.toFixed(4)).join(', ');
            log(`[MemoryService] 向量样本 [${sample}...]`);
          }
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
        await clusterMemoryRetrieval.clearUserClusterCache(userId);
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
   * 获取用户的聚类数据
   * @param userId 用户ID
   * @param forceRefresh 是否强制刷新缓存
   * @returns 聚类结果和聚类数量
   */
  async getUserClusters(userId: number, forceRefresh: boolean = false): Promise<{ clusterResult: any, clusterCount: number }> {
    try {
      // 优先使用新的聚类缓存服务
      try {
        // 使用聚类缓存服务获取聚类结果
        const cachedResult = await clusterCacheService.getUserClusterResults(userId, forceRefresh);
        if (cachedResult && Object.keys(cachedResult).length > 0) {
          const clusterCount = Object.keys(cachedResult).length;
          
          log(`[MemoryService] 使用缓存服务获取用户${userId}的聚类数据: ${clusterCount}个聚类`);
          
          return {
            clusterResult: {
              centroids: Object.values(cachedResult).map((c: any) => ({
                points: c.memory_ids.map((id: string) => ({ id })),
                center: c.centroid
              }))
            },
            clusterCount: clusterCount
          };
        }
      } catch (cacheError) {
        log(`[MemoryService] 使用缓存服务获取聚类数据失败，回退到旧方法: ${cacheError}`, "warn");
      }
      
      // 如果缓存服务失败，回退到旧方法
      const result = await clusterMemoryRetrieval.getUserClusters(userId, forceRefresh);
      const clusterCount = result?.centroids?.length || 0;
      
      log(`[MemoryService] 使用旧方法获取用户${userId}的聚类数据: ${clusterCount}个聚类, 强制刷新=${forceRefresh}`);
      
      return {
        clusterResult: result,
        clusterCount: clusterCount
      };
    } catch (error) {
      log(`[MemoryService] 获取用户聚类数据出错: ${error}`, "error");
      return {
        clusterResult: null,
        clusterCount: 0
      };
    }
  }
  
  /**
   * 按条件获取用户的记忆
   * @param userId 用户ID
   * @param filter 过滤条件
   * @returns 符合条件的记忆数组
   */
  async getMemoriesByFilter(userId: number, filter: {
    type?: string,
    startDate?: string,
    endDate?: string,
    keywords?: string[]
  } = {}): Promise<Memory[]> {
    try {
      // 获取用户的所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      
      // 如果没有过滤条件，直接返回所有记忆
      if (!filter.type && !filter.startDate && !filter.endDate && (!filter.keywords || filter.keywords.length === 0)) {
        return memories;
      }
      
      // 应用过滤条件
      return memories.filter(memory => {
        // 类型过滤
        if (filter.type && memory.type !== filter.type) {
          return false;
        }
        
        // 时间范围过滤
        if (filter.startDate || filter.endDate) {
          const memoryDate = memory.timestamp ? new Date(memory.timestamp) : new Date();
          
          if (filter.startDate) {
            const startDate = new Date(filter.startDate);
            if (memoryDate < startDate) {
              return false;
            }
          }
          
          if (filter.endDate) {
            const endDate = new Date(filter.endDate);
            if (memoryDate > endDate) {
              return false;
            }
          }
        }
        
        // 关键词过滤
        if (filter.keywords && filter.keywords.length > 0) {
          // 需要加载每个记忆的关键词
          // 由于这里不能使用异步操作，我们暂时跳过关键词过滤
          // 实际使用中应该改为存储过程或单独的API
          return true;
        }
        
        return true;
      });
    } catch (error) {
      log(`[MemoryService] 按条件获取记忆出错: ${error}`, "error");
      return [];
    }
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
      
      // 使用直接Python服务
      const { directPythonService } = await import('./direct_python_service');
      
      // 直接调用Python聚类服务
      const result = await directPythonService.clusterVectors(testVectors);
      
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
