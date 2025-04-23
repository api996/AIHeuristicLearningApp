/**
 * 聚类缓存服务
 * 管理聚类结果的缓存，确保系统只在必要时执行聚类操作
 */

import { log } from "../../vite";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";
import { memoryService } from "./memory_service";
import { pythonClusteringService } from "./python_clustering";
import { genAiService } from "../genai/genai_service";

/**
 * 聚类缓存服务类
 * 提供聚类缓存管理和有效性判断等功能
 */
export class ClusterCacheService {
  // 向量变化阈值，当新向量数超过此值时重新聚类
  private vectorCountThreshold: number = 10;

  // 缓存有效期（小时）
  private cacheExpiryHours: number = 48;

  /**
   * 获取用户的记忆聚类结果
   * - 优先使用缓存
   * - 只在必要时执行新的聚类
   * 
   * @param userId 用户ID
   * @param forceRefresh 是否强制刷新
   * @returns 聚类结果
   */
  async getUserClusterResults(userId: number, forceRefresh: boolean = false): Promise<any> {
    try {
      // 如果强制刷新，直接跳过缓存检查
      if (!forceRefresh) {
        // 尝试从缓存获取
        const cachedResult = await storage.getClusterResultCache(userId);
        if (cachedResult) {
          // 检查是否需要更新缓存
          const shouldRefresh = await this.shouldRefreshCache(userId, cachedResult);
          
          if (!shouldRefresh) {
            log(`[ClusterCache] 使用缓存的聚类结果，用户ID=${userId}，包含${cachedResult.clusterCount}个聚类`);
            return cachedResult.clusterData;
          }
          
          log(`[ClusterCache] 用户${userId}的聚类结果需要更新，将重新计算`);
        } else {
          log(`[ClusterCache] 未找到用户${userId}的聚类结果缓存，将执行聚类`);
        }
      } else {
        log(`[ClusterCache] 强制刷新用户${userId}的聚类结果`);
      }
      
      // 执行聚类并缓存结果
      return await this.performClusteringAndCache(userId);
      
    } catch (error) {
      log(`[ClusterCache] 获取聚类结果出错: ${error}`, "error");
      throw error;
    }
  }
  
  /**
   * It should be determined to refresh the cache
   * 检查是否应该更新聚类缓存
   * 
   * @param userId 用户ID
   * @param cachedResult 缓存的聚类结果
   * @returns 是否需要更新
   */
  private async shouldRefreshCache(userId: number, cachedResult: any): Promise<boolean> {
    try {
      // 获取当前记忆数据
      const memories = await storage.getMemoriesByUserId(userId);
      
      // 获取有嵌入向量的记忆数量
      const memoriesWithEmbeddings = await this.countMemoriesWithEmbeddings(userId, memories);
      
      // 如果记忆总数小于5，不需要更新聚类
      if (memories.length < 5 || memoriesWithEmbeddings < 5) {
        log(`[ClusterCache] 记忆数量不足(总数=${memories.length}, 有向量=${memoriesWithEmbeddings})，不更新聚类`);
        return false;
      }
      
      // 比较向量数量变化
      const vectorCountDifference = memoriesWithEmbeddings - cachedResult.vectorCount;
      
      // 如果向量数量增加超过阈值，需要更新聚类
      if (vectorCountDifference >= this.vectorCountThreshold) {
        log(`[ClusterCache] 向量数量增加了${vectorCountDifference}个，超过阈值(${this.vectorCountThreshold})，需要更新聚类`);
        return true;
      }
      
      // 检查记忆ID是否有变化
      const hasSignificantChanges = await this.detectSignificantMemoryChanges(userId, cachedResult);
      if (hasSignificantChanges) {
        log(`[ClusterCache] 记忆数据有显著变化，需要更新聚类`);
        return true;
      }
      
      log(`[ClusterCache] 记忆数据变化不大，继续使用缓存的聚类结果`);
      return false;
    } catch (error) {
      log(`[ClusterCache] 检查缓存更新需求时出错: ${error}`, "warn");
      // 出错时保守处理，返回true以执行新的聚类
      return true;
    }
  }
  
  /**
   * 检测记忆数据是否有显著变化
   * @param userId 用户ID
   * @param cachedResult 缓存的聚类结果
   * @returns 是否有显著变化
   */
  private async detectSignificantMemoryChanges(userId: number, cachedResult: any): Promise<boolean> {
    try {
      // 获取缓存中的聚类数据
      const cachedClusters = cachedResult.clusterData;
      
      // 如果缓存中没有聚类，需要重新聚类
      if (!cachedClusters || Object.keys(cachedClusters).length === 0) {
        return true;
      }
      
      // 从缓存中获取记忆ID集合
      const cachedMemoryIds = new Set<string>();
      for (const cluster of Object.values(cachedClusters) as any[]) {
        if (cluster.memory_ids && Array.isArray(cluster.memory_ids)) {
          cluster.memory_ids.forEach((id: string) => cachedMemoryIds.add(id));
        }
      }
      
      // 获取当前记忆ID集合
      const memories = await storage.getMemoriesByUserId(userId);
      const currentMemoryIds = new Set(memories.map(m => m.id));
      
      // 计算记忆ID变化
      let addedCount = 0;
      let removedCount = 0;
      
      // 计算新增的记忆
      for (const id of currentMemoryIds) {
        if (!cachedMemoryIds.has(id)) {
          addedCount++;
        }
      }
      
      // 计算删除的记忆
      for (const id of cachedMemoryIds) {
        if (!currentMemoryIds.has(id)) {
          removedCount++;
        }
      }
      
      // 计算变化百分比
      const totalCachedCount = cachedMemoryIds.size;
      const changePercentage = (addedCount + removedCount) / totalCachedCount;
      
      // 如果变化百分比超过20%，认为有显著变化
      return changePercentage > 0.2;
    } catch (error) {
      log(`[ClusterCache] 检测记忆变化时出错: ${error}`, "warn");
      // 出错时保守处理，返回true以执行新的聚类
      return true;
    }
  }
  
  /**
   * 计算有嵌入向量的记忆数量
   * @param userId 用户ID
   * @param memories 记忆列表
   * @returns 有向量的记忆数量
   */
  private async countMemoriesWithEmbeddings(userId: number, memories: Memory[]): Promise<number> {
    try {
      let count = 0;
      
      // 获取所有记忆的ID
      const memoryIds = memories.map(m => m.id);
      
      // 批量获取记忆的嵌入向量
      const embeddings = await storage.getEmbeddingsByMemoryIds(memoryIds);
      
      // 统计有向量的记忆数量
      count = Object.keys(embeddings).length;
      
      return count;
    } catch (error) {
      log(`[ClusterCache] 计算有向量记忆数量时出错: ${error}`, "warn");
      return 0;
    }
  }
  
  /**
   * 执行聚类并缓存结果
   * @param userId 用户ID
   * @returns 聚类结果
   */
  private async performClusteringAndCache(userId: number): Promise<any> {
    try {
      // 获取用户的所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      
      // 如果记忆数量不足，返回空结果
      if (memories.length < 5) {
        log(`[ClusterCache] 用户${userId}的记忆数量不足(${memories.length})，返回空聚类结果`);
        return {};
      }
      
      // 获取所有记忆的ID
      const memoryIds = memories.map(m => m.id);
      
      // 批量获取记忆的嵌入向量
      const embeddingsMap = await storage.getEmbeddingsByMemoryIds(memoryIds);
      
      // 过滤出有向量的记忆
      const memoriesWithEmbeddings = memories.filter(m => embeddingsMap[m.id]);
      
      // 如果有向量的记忆数量不足，返回空结果
      if (memoriesWithEmbeddings.length < 5) {
        log(`[ClusterCache] 用户${userId}有向量的记忆数量不足(${memoriesWithEmbeddings.length})，返回空聚类结果`);
        return {};
      }
      
      // 准备传递给Python聚类服务的数据
      const memoriesData = memoriesWithEmbeddings.map(memory => {
        const embedding = embeddingsMap[memory.id]?.vectorData;
        return {
          id: memory.id,
          content: memory.content,
          summary: memory.summary || "",
          timestamp: memory.timestamp || new Date(),
          embedding: embedding || []
        };
      });
      
      // 使用Python服务执行聚类
      log(`[ClusterCache] 为用户${userId}执行Python聚类，记忆数量=${memoriesData.length}`);
      const result = await this.executePythonClustering(memoriesData);
      
      // 聚类结果增强：为每个聚类生成主题
      const enhancedResult = await this.enhanceClusterResults(result, memoriesData);
      
      // 缓存聚类结果
      await this.cacheClusterResult(userId, enhancedResult, memoriesData.length);
      
      // 返回增强后的聚类结果
      return enhancedResult;
    } catch (error) {
      log(`[ClusterCache] 执行聚类出错: ${error}`, "error");
      throw error;
    }
  }
  
  /**
   * 使用Python执行聚类
   * @param memoriesData 记忆数据
   * @returns 聚类结果
   */
  private async executePythonClustering(memoriesData: any[]): Promise<any> {
    try {
      // 调用Python聚类服务
      return await this.executeClusteringService(memoriesData);
    } catch (error) {
      log(`[ClusterCache] Python聚类失败: ${error}`, "error");
      // 失败时返回空结果
      return {};
    }
  }
  
  /**
   * 调用Python聚类服务
   * @param memoriesData 记忆数据
   * @returns 聚类结果
   */
  private async executeClusteringService(memoriesData: any[]): Promise<any> {
    try {
      // 导入Python聚类服务
      const { learning_memory_service } = await import("../learning_memory/learning_memory_service_wrapper");
      
      // 执行聚类
      return await learning_memory_service.analyze_memory_clusters_sync(memoriesData);
    } catch (error) {
      log(`[ClusterCache] 调用Python聚类服务失败: ${error}`, "error");
      // 遇到错误时尝试使用备用聚类方法
      try {
        return await this.executeFallbackClustering(memoriesData);
      } catch (fallbackError) {
        log(`[ClusterCache] 备用聚类也失败: ${fallbackError}`, "error");
        return {};
      }
    }
  }
  
  /**
   * 备用聚类方法
   * @param memoriesData 记忆数据
   * @returns 聚类结果
   */
  private async executeFallbackClustering(memoriesData: any[]): Promise<any> {
    try {
      // 使用TypeScript聚类服务作为备用
      const vectors = memoriesData.map(m => ({
        id: m.id,
        vector: m.embedding
      }));
      
      // 使用Python聚类服务模块
      return await pythonClusteringService.clusterVectors(vectors);
    } catch (error) {
      log(`[ClusterCache] 备用聚类失败: ${error}`, "error");
      throw error;
    }
  }
  
  /**
   * 增强聚类结果
   * 为每个聚类添加主题、关键词等
   * 
   * @param clusterResult 原始聚类结果
   * @param memoriesData 记忆数据
   * @returns 增强后的聚类结果
   */
  private async enhanceClusterResults(clusterResult: any, memoriesData: any[]): Promise<any> {
    try {
      // 如果聚类结果为空，返回空对象
      if (!clusterResult || Object.keys(clusterResult).length === 0) {
        return {};
      }
      
      // 记忆ID映射表，用于快速查找记忆内容
      const memoryMap = new Map(memoriesData.map(m => [m.id, m]));
      
      // 处理每个聚类
      for (const [clusterId, cluster] of Object.entries(clusterResult)) {
        const clusterData = cluster as any;
        
        // 收集聚类中的记忆内容
        const clusterMemories = (clusterData.memory_ids || [])
          .map((id: string) => memoryMap.get(id))
          .filter(Boolean)
          .map((memory: any) => memory.summary || memory.content);
        
        // 如果聚类中有记忆内容，生成主题和摘要
        if (clusterMemories.length > 0) {
          // 使用Gemini生成主题
          if (!clusterData.topic || clusterData.topic === `主题 ${clusterId}`) {
            const topic = await this.generateTopicForCluster(clusterMemories);
            if (topic) {
              clusterData.topic = topic;
            }
          }
          
          // 生成摘要
          if (!clusterData.summary && clusterMemories.length > 0) {
            const summary = await this.generateSummaryForCluster(clusterMemories);
            if (summary) {
              clusterData.summary = summary;
            }
          }
          
          // 提取关键词
          if (!clusterData.keywords || clusterData.keywords.length === 0) {
            const keywords = await this.extractKeywordsFromCluster(clusterMemories);
            if (keywords && keywords.length > 0) {
              clusterData.keywords = keywords;
            }
          }
        }
      }
      
      return clusterResult;
    } catch (error) {
      log(`[ClusterCache] 增强聚类结果时出错: ${error}`, "warn");
      // 出错时返回原始聚类结果
      return clusterResult;
    }
  }
  
  /**
   * 为聚类生成主题
   * @param clusterMemories 聚类中的记忆内容
   * @returns 生成的主题
   */
  private async generateTopicForCluster(clusterMemories: string[]): Promise<string | null> {
    try {
      // 合并记忆内容，限制长度
      const combinedContent = clusterMemories
        .slice(0, 5) // 最多使用5条记忆
        .join("\n---\n")
        .substring(0, 3000); // 限制长度
      
      // 使用Gemini生成主题
      return await genAiService.generateTopicForMemories([combinedContent]);
    } catch (error) {
      log(`[ClusterCache] 生成聚类主题时出错: ${error}`, "warn");
      return null;
    }
  }
  
  /**
   * 为聚类生成摘要
   * @param clusterMemories 聚类中的记忆内容
   * @returns 生成的摘要
   */
  private async generateSummaryForCluster(clusterMemories: string[]): Promise<string | null> {
    try {
      // 合并记忆内容，限制长度
      const combinedContent = clusterMemories
        .slice(0, 3) // 最多使用3条记忆
        .join("\n---\n")
        .substring(0, 2000); // 限制长度
      
      // 使用Gemini生成摘要
      return await genAiService.summarizeText(combinedContent);
    } catch (error) {
      log(`[ClusterCache] 生成聚类摘要时出错: ${error}`, "warn");
      return null;
    }
  }
  
  /**
   * 从聚类提取关键词
   * @param clusterMemories 聚类中的记忆内容
   * @returns 提取的关键词
   */
  private async extractKeywordsFromCluster(clusterMemories: string[]): Promise<string[] | null> {
    try {
      // 合并记忆内容，限制长度
      const combinedContent = clusterMemories
        .slice(0, 3) // 最多使用3条记忆
        .join("\n---\n")
        .substring(0, 2000); // 限制长度
      
      // 使用Gemini提取关键词
      return await genAiService.extractKeywords(combinedContent);
    } catch (error) {
      log(`[ClusterCache] 提取聚类关键词时出错: ${error}`, "warn");
      return null;
    }
  }
  
  /**
   * 缓存聚类结果
   * @param userId 用户ID
   * @param clusterResult 聚类结果
   * @param vectorCount 向量数量
   */
  private async cacheClusterResult(userId: number, clusterResult: any, vectorCount: number): Promise<void> {
    try {
      // 计算聚类数量
      const clusterCount = Object.keys(clusterResult).length;
      
      // 保存到缓存
      await storage.saveClusterResultCache(
        userId,
        clusterResult,
        clusterCount,
        vectorCount,
        this.cacheExpiryHours
      );
      
      log(`[ClusterCache] 成功缓存用户${userId}的聚类结果，包含${clusterCount}个聚类，${vectorCount}个向量，有效期${this.cacheExpiryHours}小时`);
    } catch (error) {
      log(`[ClusterCache] 缓存聚类结果时出错: ${error}`, "error");
      // 出错时不抛出异常，因为这只是缓存操作
    }
  }
}

// 导出单例
export const clusterCacheService = new ClusterCacheService();