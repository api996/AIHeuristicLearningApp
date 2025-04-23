/**
 * 基于聚类的记忆检索服务
 * 用于从聚类结果中高效检索相关记忆
 */

import { log } from "../../vite";
import { vectorEmbeddingsService } from "./vector_embeddings";
import { clusterAnalyzer, ClusterTopic } from "./cluster_analyzer";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";
import { ClusterResult } from "./cluster_types";

export class ClusterMemoryRetrievalService {
  // 上次聚类结果缓存
  private clusterCache: Map<number, {
    topics: ClusterTopic[];
    timestamp: number;
  }> = new Map();
  
  // 缓存过期时间（2小时）
  private CACHE_EXPIRY = 2 * 60 * 60 * 1000;
  
  constructor() {
    log('[ClusterMemoryRetrieval] 初始化基于聚类的记忆检索服务');
  }
  
  /**
   * 获取用户的记忆聚类结果
   * 优先使用缓存，减少计算开销
   * 
   * @param userId 用户ID
   * @returns 聚类主题数组
   */
  async getUserClusterTopics(userId: number): Promise<ClusterTopic[]> {
    try {
      // 检查缓存
      const cachedData = this.clusterCache.get(userId);
      const now = Date.now();
      
      // 如果缓存有效且未过期，直接返回
      if (cachedData && (now - cachedData.timestamp) < this.CACHE_EXPIRY) {
        log(`[ClusterMemoryRetrieval] 使用缓存的聚类结果，用户ID=${userId}`);
        return cachedData.topics;
      }
      
      // 缓存无效或已过期，重新计算
      log(`[ClusterMemoryRetrieval] 重新计算聚类结果，用户ID=${userId}`);
      
      // 获取用户所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      
      if (!memories || memories.length < 5) {
        log(`[ClusterMemoryRetrieval] 用户记忆数量不足，无法执行聚类，用户ID=${userId}`);
        return [];
      }
      
      // 获取记忆的向量嵌入
      const embeddings: number[][] = [];
      
      for (const memory of memories) {
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        if (embedding && Array.isArray(embedding.vectorData)) {
          embeddings.push(embedding.vectorData);
        }
      }
      
      if (embeddings.length < 5 || embeddings.length !== memories.length) {
        log(`[ClusterMemoryRetrieval] 向量数量不足或与记忆不匹配，用户ID=${userId}`);
        return [];
      }
      
      // 执行聚类分析
      const { topics } = await clusterAnalyzer.analyzeMemoryClusters(memories, embeddings);
      
      // 更新缓存
      this.clusterCache.set(userId, {
        topics,
        timestamp: now
      });
      
      return topics;
    } catch (error) {
      log(`[ClusterMemoryRetrieval] 获取用户聚类主题出错: ${error}`);
      return [];
    }
  }
  
  /**
   * 清除用户的聚类缓存
   * 当用户添加新记忆后调用此方法
   * 
   * @param userId 用户ID
   */
  async clearUserClusterCache(userId: number): Promise<void> {
    try {
      // 直接清除数据库中的缓存
      await storage.clearClusterResultCache(userId);
      log(`[ClusterMemoryRetrieval] 已清除用户${userId}的聚类缓存`);
    } catch (error) {
      log(`[ClusterMemoryRetrieval] 清除聚类缓存出错: ${error}`, "error");
    }
  }
  
  /**
   * 获取用户的完整聚类结果
   * 供知识图谱和学习路径生成使用
   * 使用数据库缓存提高性能
   * 
   * @param userId 用户ID
   * @param forceRefresh 是否强制刷新缓存
   * @returns 聚类结果对象
   */
  async getUserClusters(userId: number, forceRefresh: boolean = false): Promise<ClusterResult | null> {
    try {
      log(`[trajectory] 获取用户${userId}的聚类数据，强制刷新=${forceRefresh}`);
      
      // 使用缓存为知识图谱加速 - 如果已有聚类结果且不强制刷新，直接返回
      const clusterResultCacheKey = `cluster_${userId}`;

      // 强制刷新时打印日志但不立即清除缓存，先检查缓存是否实际存在
      if (forceRefresh) {
        log(`[trajectory] 请求强制刷新用户${userId}的聚类缓存`);
      }

      // 无论是否强制刷新，都先检查是否有缓存
      const cachedResult = await this.getFromLocalCache(clusterResultCacheKey);
      
      // 如果有缓存且不是强制刷新，直接使用
      if (cachedResult && !forceRefresh) {
        const clusterCount = cachedResult.centroids?.length || 0;
        log(`[trajectory] 使用数据库缓存的聚类数据: ${clusterCount} 个聚类`);
        return cachedResult;
      } 
      
      // 如果有缓存但是强制刷新，清除缓存
      if (cachedResult && forceRefresh) {
        await storage.clearClusterResultCache(userId);
        log(`[trajectory] 已清除用户${userId}的有效聚类缓存（强制刷新模式）`);
      }
      
      log(`[trajectory] ${cachedResult ? '强制刷新缓存' : '缓存未命中或已过期'}，开始计算聚类数据`);
      
      // 获取用户所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      
      if (!memories || memories.length < 5) {
        log(`[trajectory] 用户记忆数量不足，无法执行聚类，用户ID=${userId}`);
        return null;
      }
      
      // 获取记忆的向量嵌入 - 使用批量查询
      const memoryIds = memories.map(m => m.id);
      const embeddings = await storage.getEmbeddingsByMemoryIds(memoryIds);
      
      if (!embeddings || Object.keys(embeddings).length === 0) {
        log(`[trajectory] 未找到任何向量嵌入数据`);
        return null;
      }
      
      // 构建向量数据
      const memoryVectors: { id: string; vector: number[] }[] = [];
      
      for (const memory of memories) {
        const embedding = embeddings[memory.id];
        if (embedding && Array.isArray(embedding.vectorData)) {
          memoryVectors.push({
            id: String(memory.id), // 确保ID为字符串类型
            vector: embedding.vectorData
          });
        }
      }
      
      if (memoryVectors.length < 5) {
        log(`[trajectory] 向量数量不足，用户ID=${userId}`);
        return null;
      }
      
      log(`[trajectory] 找到 ${memories.length} 条记忆数据，其中 ${memoryVectors.length} 条有有效向量嵌入`);
      
      // 检查向量维度并筛选维度一致的向量
      const dimensionCounts = new Map<number, number>();
      memoryVectors.forEach(vec => {
        const dim = vec.vector.length;
        dimensionCounts.set(dim, (dimensionCounts.get(dim) || 0) + 1);
      });
      
      // 选择最常见的维度
      let primaryDimension = 0;
      let maxCount = 0;
      
      dimensionCounts.forEach((count, dimension) => {
        if (count > maxCount) {
          maxCount = count;
          primaryDimension = dimension;
        }
      });
      
      const filteredVectors = memoryVectors.filter(vec => vec.vector.length === primaryDimension);
      
      if (filteredVectors.length < 5) {
        log(`[trajectory] 筛选后的向量数量不足`);
        return null;
      }
      
      log(`[MemoryService] 记忆聚类分析: 用户ID=${userId}, 记忆数量=${filteredVectors.length}, 向量维度=${primaryDimension}`);
      
      // 从python_clustering导入pythonClusteringService
      const { pythonClusteringService } = await import('./python_clustering');
      const { VectorData } = await import('./python_clustering');
      
      // 确保向量ID是字符串类型 - 使用VectorData类型进行类型安全的转换
      const typedVectors: VectorData[] = filteredVectors.map(vec => ({
        id: String(vec.id),
        vector: vec.vector
      }));
      
      // 执行聚类
      const clusterResult = await pythonClusteringService.clusterVectors(typedVectors);
      
      if (!clusterResult || !clusterResult.centroids || clusterResult.centroids.length === 0) {
        log(`[trajectory] 聚类失败，未找到任何聚类`);
        return null;
      }
      
      log(`[trajectory] 成功计算聚类数据: ${clusterResult.centroids.length} 个聚类`);
      
      // 缓存结果
      this.saveToLocalCache(clusterResultCacheKey, clusterResult);
      
      return clusterResult;
    } catch (error) {
      log(`[trajectory] 获取用户聚类数据出错: ${error}`);
      return null;
    }
  }
  
  // 缓存方法 - 使用数据库而非内存
  private async saveToLocalCache(key: string, data: any): Promise<void> {
    // 提取用户ID - 期望key格式为 "cluster_userId"
    const userId = this.extractUserIdFromKey(key);
    if (!userId) return;
    
    try {
      // 获取聚类数量和向量数量
      const clusterCount = data?.centroids?.length || 0;
      const vectorCount = data?.vectors?.length || data?.points?.length || 0;
      
      // 如果聚类数据有效，保存到数据库, 有效期24小时
      await storage.saveClusterResultCache(
        userId,
        data,
        clusterCount,
        vectorCount,
        24 // 24小时过期
      );
      
      log(`[ClusterMemoryRetrieval] 成功将聚类结果缓存到数据库，用户ID=${userId}，聚类数=${clusterCount}`);
    } catch (error) {
      log(`[ClusterMemoryRetrieval] 缓存聚类结果出错: ${error}`, "error");
    }
  }
  
  private async getFromLocalCache(key: string): Promise<any | null> {
    // 提取用户ID
    const userId = this.extractUserIdFromKey(key);
    if (!userId) return null;
    
    try {
      // 从数据库获取缓存
      const cache = await storage.getClusterResultCache(userId);
      
      if (cache) {
        log(`[ClusterMemoryRetrieval] 从数据库加载聚类结果缓存，用户ID=${userId}，聚类数=${cache.clusterCount}`);
        return cache.clusterData;
      }
      
      return null;
    } catch (error) {
      log(`[ClusterMemoryRetrieval] 获取缓存聚类结果出错: ${error}`, "error");
      return null;
    }
  }
  
  // 从键中提取用户ID
  private extractUserIdFromKey(key: string): number | null {
    if (!key.startsWith('cluster_')) return null;
    
    // 解析用户ID
    const userIdStr = key.substring('cluster_'.length);
    const userId = parseInt(userIdStr, 10);
    
    return isNaN(userId) ? null : userId;
  }
  
  /**
   * 基于聚类主题检索相关记忆
   * 更高效、更有组织性地检索记忆
   * 
   * @param userId 用户ID
   * @param query 查询文本
   * @param limit 返回最大记忆数量
   * @returns 相关记忆数组
   */
  async retrieveClusterMemories(
    userId: number,
    query: string,
    limit: number = 5
  ): Promise<Memory[]> {
    try {
      // 获取用户的聚类主题
      const clusterTopics = await this.getUserClusterTopics(userId);
      
      if (!clusterTopics || clusterTopics.length === 0) {
        log(`[ClusterMemoryRetrieval] 未找到用户聚类主题，回退到标准检索方法`);
        // 回退到标准向量检索
        return vectorEmbeddingsService.findSimilarMemories(userId, query, limit);
      }
      
      // 为查询生成向量嵌入
      const queryEmbedding = await vectorEmbeddingsService.generateEmbedding(query);
      
      if (!queryEmbedding) {
        log(`[ClusterMemoryRetrieval] 无法为查询生成嵌入，回退到标准检索方法`);
        return vectorEmbeddingsService.findSimilarMemories(userId, query, limit);
      }
      
      // 找到最相关的聚类主题
      const relevantTopics = await this.findRelevantClusterTopics(
        clusterTopics,
        queryEmbedding,
        userId,
        Math.min(3, clusterTopics.length) // 最多选择3个相关主题
      );
      
      if (!relevantTopics || relevantTopics.length === 0) {
        log(`[ClusterMemoryRetrieval] 未找到相关聚类主题，回退到标准检索方法`);
        return vectorEmbeddingsService.findSimilarMemories(userId, query, limit);
      }
      
      // 从相关主题中提取记忆
      const selectedMemories: Memory[] = [];
      
      // 首先获取每个主题的代表性记忆
      for (const topic of relevantTopics) {
        if (topic.representativeMemory) {
          selectedMemories.push(topic.representativeMemory);
        }
      }
      
      // 如果记忆数量不足，从主题中随机选择更多记忆补充
      if (selectedMemories.length < limit && relevantTopics[0]?.memoryIds?.length) {
        const additionalNeeded = limit - selectedMemories.length;
        
        // 从第一个（最相关）主题中获取更多记忆
        const additionalMemories = await this.getRandomMemoriesFromTopic(
          relevantTopics[0],
          userId,
          additionalNeeded
        );
        
        // 添加到结果集中
        selectedMemories.push(...additionalMemories);
      }
      
      // 如果仍然不足，使用直接向量检索补充
      if (selectedMemories.length < limit) {
        const directMemories = await vectorEmbeddingsService.findSimilarMemories(
          userId, 
          query, 
          limit - selectedMemories.length
        );
        
        // 避免重复
        const existingIds = new Set(selectedMemories.map(m => m.id));
        const uniqueDirectMemories = directMemories.filter(m => !existingIds.has(m.id));
        
        selectedMemories.push(...uniqueDirectMemories);
      }
      
      log(`[ClusterMemoryRetrieval] 检索到${selectedMemories.length}条基于聚类的相关记忆`);
      return selectedMemories;
    } catch (error) {
      log(`[ClusterMemoryRetrieval] 基于聚类检索记忆时出错: ${error}`);
      // 出错时回退到标准检索
      return vectorEmbeddingsService.findSimilarMemories(userId, query, limit);
    }
  }
  
  /**
   * 查找与查询相关的聚类主题
   * 
   * @param topics 聚类主题数组
   * @param queryEmbedding 查询向量嵌入
   * @param userId 用户ID
   * @param topN 返回的主题数量
   * @returns 相关主题数组
   */
  private async findRelevantClusterTopics(
    topics: ClusterTopic[],
    queryEmbedding: number[],
    userId: number,
    topN: number = 3
  ): Promise<ClusterTopic[]> {
    const topicScores: { topic: ClusterTopic; score: number }[] = [];
    
    for (const topic of topics) {
      try {
        // 如果主题没有代表性记忆，跳过
        if (!topic.representativeMemory) continue;
        
        // 获取代表性记忆的嵌入向量
        const embedding = await storage.getEmbeddingByMemoryId(topic.representativeMemory.id);
        
        if (!embedding) continue;
        
        // 计算与查询的相似度
        if (Array.isArray(embedding.vectorData)) {
          const similarity = this.cosineSimilarity(queryEmbedding, embedding.vectorData);
          
          topicScores.push({
            topic,
            score: similarity
          });
        }
      } catch (error) {
        continue; // 跳过出错的主题
      }
    }
    
    // 按相似度降序排序
    topicScores.sort((a, b) => b.score - a.score);
    
    // 返回得分最高的N个主题
    return topicScores.slice(0, topN).map(item => item.topic);
  }
  
  /**
   * 从主题中随机选择记忆
   * 
   * @param topic 主题对象
   * @param userId 用户ID
   * @param count 需要的记忆数量
   * @returns 记忆数组
   */
  private async getRandomMemoriesFromTopic(
    topic: ClusterTopic,
    userId: number,
    count: number
  ): Promise<Memory[]> {
    if (!topic.memoryIds || topic.memoryIds.length === 0) {
      return [];
    }
    
    // 随机打乱memoryIds
    const shuffledIds = [...topic.memoryIds].sort(() => Math.random() - 0.5);
    
    // 选择需要的数量（不超过可用数量）
    const selectedIds = shuffledIds.slice(0, count);
    
    // 获取记忆对象
    const memories: Memory[] = [];
    
    for (const id of selectedIds) {
      try {
        const memory = await storage.getMemoryById(id);
        if (memory && memory.userId === userId) {
          memories.push(memory);
        }
      } catch (error) {
        continue; // 跳过出错的记忆
      }
    }
    
    return memories;
  }
  
  /**
   * 计算两个向量的余弦相似度
   * 
   * @param vec1 向量1
   * @param vec2 向量2
   * @returns 相似度值（0-1之间）
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    // 避免除以零
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

// 导出服务实例
export const clusterMemoryRetrieval = new ClusterMemoryRetrievalService();