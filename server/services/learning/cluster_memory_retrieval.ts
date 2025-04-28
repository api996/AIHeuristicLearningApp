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
      
      // 首先尝试从数据库缓存获取主题
      try {
        const cache = await storage.getClusterResultCache(userId);
        if (cache && cache.clusterData && cache.clusterData.topics) {
          log(`[ClusterMemoryRetrieval] 从数据库缓存获取到聚类主题，用户ID=${userId}`);
          return cache.clusterData.topics;
        }
      } catch (cacheError) {
        log(`[ClusterMemoryRetrieval] 从数据库缓存获取聚类主题失败: ${cacheError}`, "warn");
      }
      
      // 如果没有缓存，获取用户聚类数据
      log(`[ClusterMemoryRetrieval] 获取用户聚类数据，包括主题信息，用户ID=${userId}`);
      const clusterResult = await this.getUserClusters(userId, true);
      
      if (clusterResult && clusterResult.topics) {
        log(`[ClusterMemoryRetrieval] 成功获取到聚类主题，用户ID=${userId}, 主题数=${clusterResult.topics.length}`);
        
        // 更新内存缓存
        this.clusterCache.set(userId, {
          topics: clusterResult.topics,
          timestamp: now
        });
        
        return clusterResult.topics;
      }
      
      // 如果使用getUserClusters方法未能获取主题，则使用原始方法重新计算
      log(`[ClusterMemoryRetrieval] 未能从getUserClusters获取主题，回退到原始计算方法`);
      
      // 获取用户所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      
      if (!memories || memories.length < 5) {
        log(`[ClusterMemoryRetrieval] 用户记忆数量不足，无法执行聚类，用户ID=${userId}`);
        return [];
      }
      
      // 获取记忆的向量嵌入 - 使用批量查询
      const memoryIds = memories.map(m => m.id);
      const embeddingsMap = await storage.getEmbeddingsByMemoryIds(memoryIds);
      
      if (!embeddingsMap || Object.keys(embeddingsMap).length === 0) {
        log(`[ClusterMemoryRetrieval] 未找到任何向量嵌入数据，用户ID=${userId}`);
        return [];
      }
      
      // 构建向量数组，确保与记忆数组顺序一致
      const embeddings: number[][] = [];
      
      for (const memory of memories) {
        const embedding = embeddingsMap[memory.id];
        if (embedding && Array.isArray(embedding.vectorData)) {
          embeddings.push(embedding.vectorData);
        }
      }
      
      if (embeddings.length < 5) {
        log(`[ClusterMemoryRetrieval] 向量数量不足，用户ID=${userId}, 只有${embeddings.length}个有效向量`);
        return [];
      }
      
      log(`[ClusterMemoryRetrieval] 找到${memories.length}条记忆，其中${embeddings.length}条有有效向量`);
      
      // 执行聚类分析
      const { topics } = await clusterAnalyzer.analyzeMemoryClusters(memories, embeddings);
      
      if (topics && topics.length > 0) {
        log(`[ClusterMemoryRetrieval] 成功生成${topics.length}个聚类主题`);
        
        // 更新缓存
        this.clusterCache.set(userId, {
          topics,
          timestamp: now
        });
        
        return topics;
      } else {
        log(`[ClusterMemoryRetrieval] 聚类分析未产生任何主题`);
        return [];
      }
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
      
      log(`[trajectory] 成功计算聚类数据: ${clusterResult.centroids ? clusterResult.centroids.length : 0} 个聚类`);
      
      // 数据验证和转换
      if (clusterResult && clusterResult.centroids && clusterResult.centroids.length > 0) {
        // 确保topics字段存在并包含必要的数据
        if (!clusterResult.topics || !Array.isArray(clusterResult.topics) || clusterResult.topics.length === 0) {
          log(`[ClusterMemoryRetrieval] 聚类结果缺少topics字段，从centroids生成`, "warn");
          
          // 从centroids创建topics
          clusterResult.topics = clusterResult.centroids.map((centroid, index) => {
            return {
              id: centroid.id || `topic_${index}`,
              topic: centroid.label || `主题 ${index+1}`,
              percentage: centroid.weight || 0.1,
              count: centroid.memoryIds?.length || 0,
              memories: centroid.memoryIds || []
            };
          });
          
          log(`[ClusterMemoryRetrieval] 从centroids自动生成了 ${clusterResult.topics.length} 个topics`);
        }
      } else {
        log(`[ClusterMemoryRetrieval] 警告：聚类结果没有有效的centroids数据`, "warn");
      }
      
      // 缓存结果 - 使用try-catch确保即使缓存失败也不会影响主流程
      try {
        await this.saveToLocalCache(clusterResultCacheKey, clusterResult);
        log(`[ClusterMemoryRetrieval] 成功将聚类结果缓存到数据库，用户ID=${userId}`);
      } catch (cacheError) {
        log(`[ClusterMemoryRetrieval] 缓存聚类结果时出错: ${cacheError}`, "error");
        // 错误不会中断主流程
      }
      
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
      // 检查数据结构，确保数据包含必要的字段
      if (!data) {
        log(`[ClusterMemoryRetrieval] 警告：尝试缓存null/undefined数据`, "warn");
        return;
      }
      
      // 准备一个规范化的数据结构，以确保存储兼容性
      let normalizedData: any = {
        version: 1,
        timestamp: new Date().toISOString()
      };
      
      // 复制centroids数据，如果存在
      if (Array.isArray(data.centroids)) {
        normalizedData.centroids = data.centroids.map((centroid: any, index: number) => {
          // 确保每个centroid都有必要的字段
          return {
            id: centroid.id || `centroid_${index}`,
            label: centroid.label || `聚类 ${index+1}`,
            weight: centroid.weight || 0.1,
            memoryIds: Array.isArray(centroid.memoryIds) ? centroid.memoryIds : [],
            keywords: Array.isArray(centroid.keywords) ? centroid.keywords : []
          };
        });
      } else {
        normalizedData.centroids = [];
      }
      
      // 确保topics数据存在，必要时从centroids生成
      if (Array.isArray(data.topics) && data.topics.length > 0) {
        normalizedData.topics = data.topics.map((topic: any, index: number) => {
          return {
            id: topic.id || `topic_${index}`,
            topic: topic.topic || topic.name || `主题 ${index+1}`,
            percentage: topic.percentage || topic.weight || 0.1,
            count: topic.count || (Array.isArray(topic.memories) ? topic.memories.length : 0) || 1,
            keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
            memories: Array.isArray(topic.memories) ? topic.memories :
                     Array.isArray(topic.memoryIds) ? topic.memoryIds : []
          };
        });
      } else if (Array.isArray(normalizedData.centroids) && normalizedData.centroids.length > 0) {
        // 从centroids生成topics
        log(`[ClusterMemoryRetrieval] 修复数据结构：从centroids生成topics`, "warn");
        normalizedData.topics = normalizedData.centroids.map((centroid: any, index: number) => {
          return {
            id: `topic_${index}`,
            topic: centroid.label || `主题 ${index+1}`,
            percentage: centroid.weight || 0.1,
            count: Array.isArray(centroid.memoryIds) ? centroid.memoryIds.length : 1,
            keywords: Array.isArray(centroid.keywords) ? centroid.keywords : [],
            memories: Array.isArray(centroid.memoryIds) ? centroid.memoryIds : []
          };
        });
        log(`[ClusterMemoryRetrieval] 已从centroids创建 ${normalizedData.topics.length} 个topics`);
      } else {
        normalizedData.topics = [];
        log(`[ClusterMemoryRetrieval] 警告：无法创建topics，数据可能不完整`, "warn");
      }
      
      // 复制其他有用的字段
      if (Array.isArray(data.vectors)) {
        normalizedData.vectors = data.vectors;
      } else if (Array.isArray(data.points)) {
        normalizedData.vectors = data.points;
      }
      
      // 获取聚类数量和向量数量
      const clusterCount = normalizedData.topics.length;
      const vectorCount = Array.isArray(normalizedData.vectors) ? normalizedData.vectors.length : 0;
      
      // 进行数据完整性验证和修复
      if (clusterCount === 0) {
        log(`[ClusterMemoryRetrieval] 警告：聚类数量为0，跳过缓存`, "warn");
        return;
      }
      
      log(`[ClusterMemoryRetrieval] 正在保存用户 ${userId} 的聚类数据，聚类数：${clusterCount}，向量数：${vectorCount}`);
      
      // 验证数据是否可序列化
      try {
        JSON.stringify(normalizedData);
      } catch (serializeError) {
        log(`[ClusterMemoryRetrieval] 警告：数据无法序列化: ${serializeError}，使用简化数据`, "error");
        // 创建超简化版本
        normalizedData = {
          version: 1,
          timestamp: new Date().toISOString(),
          centroids: [],
          topics: normalizedData.topics.map((t: any) => ({
            id: t.id,
            topic: t.topic,
            percentage: t.percentage,
            count: t.count,
            keywords: [],
            memories: []
          }))
        };
      }
      
      // 如果聚类数据有效，保存到数据库, 有效期7天 (之前是24小时)
      await storage.saveClusterResultCache(
        userId,
        normalizedData,
        clusterCount,
        vectorCount,
        168 // 7天过期 (7*24=168小时)
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