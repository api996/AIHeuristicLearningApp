/**
 * 聚类缓存服务
 * 管理聚类结果的缓存，确保系统只在必要时执行聚类操作
 */

import { log } from "../../vite";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";
import { memoryService } from "./memory_service";
import { directPythonService } from "./direct_python_service";

/**
 * 聚类缓存服务类
 * 提供聚类缓存管理和有效性判断等功能
 */
export class ClusterCacheService {
  // 向量变化阈值，当新向量数超过此值时重新聚类
  private vectorCountThreshold: number = 40; // 增加阈值，显著减少自动刷新频率

  // 缓存有效期（小时）
  private cacheExpiryHours: number = 168; // 一周，保持较长的缓存时间

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
      // 特殊处理管理员用户
      if (userId === 1) {
        log(`[ClusterCache] 跳过管理员用户(ID=1)的聚类处理`);
        return {}; // 返回空结果
      }

      // 记录对聚类服务的请求
      log(`[ClusterCache] 收到用户${userId}的聚类请求，强制刷新=${forceRefresh}`);
      
      // 优先尝试使用缓存，除非强制刷新
      let shouldUseCache = false;
      let cachedData = null;
      
      if (!forceRefresh) {
        try {
          // 尝试从缓存获取
          const cachedResult = await storage.getClusterResultCache(userId);
          
          if (cachedResult && cachedResult.clusterData) {
            // 检查缓存是否有效
            const clusterData = cachedResult.clusterData;
            const hasValidData = clusterData && 
                               typeof clusterData === 'object' && 
                               Object.keys(clusterData).length > 0;
            
            if (hasValidData) {
              // 检查是否需要更新缓存
              const shouldRefresh = await this.shouldRefreshCache(userId, cachedResult);
              
              if (!shouldRefresh) {
                log(`[ClusterCache] 使用缓存的聚类结果，用户ID=${userId}，包含${cachedResult.clusterCount}个聚类`);
                
                // 检查结果是否有合理的主题
                const hasValidTopics = Object.values(clusterData).some((cluster: any) => 
                  cluster.topic && cluster.topic.length > 0 && !cluster.topic.startsWith('聚类')
                );
                
                if (hasValidTopics) {
                  shouldUseCache = true;
                  cachedData = clusterData;
                  log(`[ClusterCache] 用户${userId}的缓存聚类结果包含有效的主题名称`);
                } else {
                  log(`[ClusterCache] 用户${userId}的缓存聚类结果不包含有效的主题名称，将重新生成`, "warn");
                }
              } else {
                log(`[ClusterCache] 用户${userId}的聚类结果需要更新，将重新计算`);
              }
            } else {
              log(`[ClusterCache] 用户${userId}的聚类缓存数据无效，将重新生成`, "warn");
            }
          } else {
            log(`[ClusterCache] 未找到用户${userId}的聚类结果缓存，将执行聚类`);
          }
        } catch (cacheError) {
          log(`[ClusterCache] 获取缓存出错: ${cacheError}，将执行新的聚类`, "warn");
        }
      } else {
        log(`[ClusterCache] 强制刷新用户${userId}的聚类结果`);
      }
      
      // 如果可以使用缓存，直接返回
      if (shouldUseCache && cachedData) {
        return cachedData;
      }
      
      // 如果不能使用缓存，添加执行时间记录
      const startTime = Date.now();
      log(`[ClusterCache] 开始执行用户${userId}的聚类处理，时间：${new Date().toISOString()}`);
      
      try {
        // 执行聚类并缓存结果
        const result = await this.performClusteringAndCache(userId);
        
        // 计算执行时间
        const executionTime = (Date.now() - startTime) / 1000;
        log(`[ClusterCache] 完成用户${userId}的聚类处理，耗时：${executionTime.toFixed(2)}秒`);
        
        // 检查聚类结果是否有意义
        if (result && Object.keys(result).length > 0) {
          // 计算有多少有效主题名称
          const validTopics = Object.values(result).filter((cluster: any) => 
            cluster.topic && cluster.topic.length > 0 && !cluster.topic.startsWith('聚类')
          );
          
          const validTopicCount = validTopics.length;
          const totalTopicCount = Object.keys(result).length;
          
          log(`[ClusterCache] 用户${userId}的聚类结果有${validTopicCount}/${totalTopicCount}个有效主题名称`);
          
          // 成功生成结果，返回
          return result;
        } else {
          log(`[ClusterCache] 用户${userId}的聚类结果为空或无效，检查是否有缓存备用`, "warn");
          
          // 如果聚类失败但有缓存数据，尝试使用缓存数据作为备选方案
          if (cachedData) {
            log(`[ClusterCache] 聚类失败但发现有缓存数据，使用缓存作为备选方案`, "warn");
            return cachedData;
          }
          
          // 否则返回空对象
          return {};
        }
      } catch (processingError) {
        log(`[ClusterCache] 处理用户${userId}的聚类时发生错误: ${processingError}`, "error");
        
        // 如果处理过程出错但有缓存，使用缓存
        if (cachedData) {
          log(`[ClusterCache] 使用缓存数据作为错误恢复机制`, "warn");
          return cachedData;
        }
        
        // 处理失败且无缓存，返回空结果
        return {};
      }
    } catch (outerError) {
      log(`[ClusterCache] 获取聚类结果时发生严重错误: ${outerError}`, "error");
      // 返回空结果而不是抛出异常，避免影响后续流程
      return {};
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
      // 检查缓存是否存在且有足够的数据
      if (!cachedResult || !cachedResult.clusterData || Object.keys(cachedResult.clusterData).length === 0) {
        log(`[ClusterCache] 缓存不存在或为空，需要创建新的聚类`);
        return true;
      }
      
      // 检查缓存的过期时间 - 首先检查是否设置了明确的过期时间
      if (cachedResult.expiresAt) {
        const expiresAt = new Date(cachedResult.expiresAt);
        if (expiresAt > new Date()) {
          log(`[ClusterCache] 缓存尚未过期，将于 ${expiresAt.toISOString()} 过期，继续使用缓存`);
          return false;
        } else {
          log(`[ClusterCache] 缓存已过期，需要刷新`);
          return true;
        }
      }
      
      // 如果没有明确的过期时间，检查更新时间
      if (cachedResult.updatedAt) {
        const updatedAt = new Date(cachedResult.updatedAt);
        const ageHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
        
        // 如果缓存非常新（不到12小时），直接使用
        if (ageHours < 12) {
          log(`[ClusterCache] 缓存非常新，仅${ageHours.toFixed(1)}小时前更新，继续使用缓存`);
          return false;
        }
        
        // 如果缓存在有效期内（不到cacheExpiryHours，默认168小时/1周），检查是否有显著变化
        if (ageHours < this.cacheExpiryHours) {
          // 获取当前记忆数据，检查是否有新的记忆
          const memories = await storage.getMemoriesByUserId(userId);
          
          // 获取有嵌入向量的记忆数量
          const memoriesWithEmbeddings = await this.countMemoriesWithEmbeddings(userId, memories);
          
          // 如果记忆总数小于5，不需要更新聚类
          if (memories.length < 5 || memoriesWithEmbeddings < 5) {
            log(`[ClusterCache] 记忆数量不足(总数=${memories.length}, 有向量=${memoriesWithEmbeddings})，不更新聚类`);
            return false;
          }
          
          // 计算向量数量变化
          const vectorCountDifference = memoriesWithEmbeddings - cachedResult.vectorCount;
          
          // 如果没有新的向量，绝对不更新聚类
          if (vectorCountDifference <= 0) {
            log(`[ClusterCache] 没有新的向量数据，不需要更新聚类`);
            return false;
          }
          
          // 只有当向量数量增加超过阈值且增长比例超过30%时，才更新聚类
          const growthPercentage = vectorCountDifference / cachedResult.vectorCount;
          if (vectorCountDifference >= this.vectorCountThreshold && growthPercentage >= 0.3) {
            log(`[ClusterCache] 向量数量增加了${vectorCountDifference}个(${(growthPercentage*100).toFixed(1)}%)，超过阈值，需要更新聚类`);
            return true;
          }
          
          log(`[ClusterCache] 向量数量增加了${vectorCountDifference}个(${(growthPercentage*100).toFixed(1)}%)，未达到刷新阈值，继续使用缓存`);
          return false;
        } else {
          log(`[ClusterCache] 缓存已超过${this.cacheExpiryHours}小时(${ageHours.toFixed(1)}小时)，需要刷新`);
          return true;
        }
      }
      
      // 如果没有更新时间信息，检查是否有足够的聚类
      const clusterCount = Object.keys(cachedResult.clusterData).length;
      if (clusterCount < 3) {
        log(`[ClusterCache] 缓存的聚类数量不足(${clusterCount})，需要重新聚类`);
        return true;
      }
      
      // 如果以上条件都不满足，默认使用缓存
      log(`[ClusterCache] 使用默认策略，继续使用现有缓存结果`);
      return false;
    } catch (error) {
      log(`[ClusterCache] 检查缓存更新需求时出错: ${error}`, "warn");
      // 出错时保守处理，优先使用缓存
      return false;
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
      currentMemoryIds.forEach(id => {
        if (!cachedMemoryIds.has(id)) {
          addedCount++;
        }
      });
      
      // 计算删除的记忆
      cachedMemoryIds.forEach(id => {
        if (!currentMemoryIds.has(id)) {
          removedCount++;
        }
      });
      
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
      
      // 显示详细日志，帮助诊断
      log(`[ClusterCache] 用户${userId}总记忆数量: ${memories.length}`);
      
      // 如果记忆数量不足，返回空结果
      if (memories.length < 5) {
        log(`[ClusterCache] 用户${userId}的记忆数量不足(${memories.length})，返回空聚类结果`);
        return {};
      }
      
      // 获取所有记忆的ID
      const memoryIds = memories.map(m => m.id);
      
      // 批量获取记忆的嵌入向量
      const embeddingsMap = await storage.getEmbeddingsByMemoryIds(memoryIds);
      log(`[ClusterCache] 用户${userId}检索到的嵌入向量数量: ${Object.keys(embeddingsMap).length}`);
      
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
      
      if (!result || Object.keys(result).length === 0) {
        log(`[ClusterCache] 用户${userId}的聚类结果为空，可能是聚类算法没有找到簇`);
        return {};
      }
      
      log(`[ClusterCache] 用户${userId}聚类成功，获得${Object.keys(result).length}个聚类`);
      
      // 聚类结果增强：为每个聚类生成主题
      const enhancedResult = await this.enhanceClusterResults(result, memoriesData);
      
      if (!enhancedResult || Object.keys(enhancedResult).length === 0) {
        log(`[ClusterCache] 用户${userId}的增强结果为空，跳过缓存操作`);
        return result; // 返回原始结果，至少保留一些数据
      }
      
      try {
        // 缓存聚类结果
        await this.cacheClusterResult(userId, enhancedResult, memoriesData.length);
        log(`[ClusterCache] 用户${userId}的聚类结果已成功缓存`);
      } catch (cacheError) {
        // 缓存失败不影响返回结果
        log(`[ClusterCache] 缓存用户${userId}的聚类结果失败: ${cacheError}`, "error");
        log(`[ClusterCache] 继续返回未缓存的聚类结果`);
      }
      
      // 返回增强后的聚类结果
      return enhancedResult;
    } catch (error) {
      log(`[ClusterCache] 执行聚类出错: ${error}`, "error");
      // 返回空结果而不是抛出异常，以避免整个聚类过程失败
      return {};
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
      // 不再静默失败，而是向上抛出错误以便调试
      throw error;
    }
  }
  
  /**
   * 调用Python聚类服务
   * @param memoriesData 记忆数据
   * @returns 聚类结果
   */
  private async executeClusteringService(memoriesData: any[]): Promise<any> {
    // 准备向量数据
    const vectors = memoriesData.map(m => ({
      id: m.id,
      vector: m.embedding
    }));
    
    // 记录向量维度统计
    if (vectors.length > 0 && vectors[0].vector) {
      log(`[ClusterCache] 向量维度: ${vectors[0].vector.length}，向量总数: ${vectors.length}`);
    }
    
    // 执行Python聚类
    const clusterResult = await directPythonService.clusterVectors(vectors);
    
    // 检查结果是否有效
    if (!clusterResult || !clusterResult.centroids || clusterResult.centroids.length === 0) {
      log(`[ClusterCache] Python聚类服务返回了空结果`, "warn");
      return {};
    }
    
    log(`[ClusterCache] Python聚类完成，返回了${clusterResult.centroids.length}个中心点`);
    
    // 首先检查是否有raw_clusters字段，它包含完整的聚类信息
    if (clusterResult.raw_clusters && typeof clusterResult.raw_clusters === 'object' && Object.keys(clusterResult.raw_clusters).length > 0) {
      log(`[ClusterCache] 使用Python返回的raw_clusters数据，包含${Object.keys(clusterResult.raw_clusters).length}个聚类`);
      
      // 转换为应用需要的格式
      const transformedResult: any = {};
      
      // 遍历raw_clusters中的聚类
      const rawClusters = clusterResult.raw_clusters as Record<string, any>;
      for (const [clusterId, cluster] of Object.entries(rawClusters)) {
        const clusterData = cluster as any;
        
        // 使用原始聚类的ID作为键
        transformedResult[`cluster_${clusterId}`] = {
          centroid: clusterData.centroid,       // 保存中心向量
          memory_ids: clusterData.memory_ids,   // 保存记忆ID列表
          topic: clusterData.topic || "",       // 保存主题(如果有)
          cluster_id: `cluster_${clusterId}`,
          raw_data: clusterData               // 保存原始聚类数据，以便在主题生成时使用
        };
        
        log(`[ClusterCache] 处理raw_clusters: 聚类cluster_${clusterId}包含${clusterData.memory_ids?.length || 0}条记忆`);
      }
      
      return transformedResult;
    }
    
    // 如果没有raw_clusters字段，退回到使用centroids字段
    log(`[ClusterCache] 未找到raw_clusters数据，使用centroids字段转换格式`);
    
    // 转换为应用需要的格式 - 从centroids结构转换为clusterId -> {topic, memory_ids, centroid} 映射
    const transformedResult: any = {};
    
    clusterResult.centroids.forEach((centroid, index) => {
      // 提取属于该聚类的记忆ID
      const memoryIds = centroid.points.map(p => p.id);
      
      // 创建聚类对象
      transformedResult[`cluster_${index}`] = {
        centroid: centroid.center,    // 保存中心向量
        memory_ids: memoryIds,        // 保存记忆ID列表
        topic: "",                    // 主题为空，等待后续生成
        cluster_id: `cluster_${index}`
      };
      
      log(`[ClusterCache] 聚类cluster_${index}包含${memoryIds.length}条记忆`);
    });
    
    return transformedResult;
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
      
      // 准备批量处理的数据
      interface ClusterBatchItem {
        clusterId: string;
        clusterData: any;
        clusterMemories: string[];
        needsTopicGeneration: boolean;
        keywords: string[];
      }
      
      // 收集需要主题生成的聚类
      const batchItems: ClusterBatchItem[] = [];
      
      // 第一阶段：准备数据，确定哪些聚类需要生成主题
      for (const [clusterId, cluster] of Object.entries(clusterResult)) {
        const clusterData = cluster as any;
        
        // 收集聚类中的记忆内容
        const clusterMemories = (clusterData.memory_ids || [])
          .map((id: string) => memoryMap.get(id))
          .filter(Boolean)
          .map((memory: any) => memory.summary || memory.content);
        
        log(`[ClusterCache] 聚类${clusterId}包含${clusterMemories.length}条记忆，现有主题: "${clusterData.topic || '无'}"`);
        
        // 检查是否需要生成主题
        const hasValidTopic = clusterData.topic && 
                             clusterData.topic.length > 2 && 
                             !clusterData.topic.startsWith('聚类') && 
                             !clusterData.topic.startsWith('主题');
        
        // 提取关键词，无论是否需要生成主题
        const keywords = await this.extractKeywordsFromCluster(
          clusterMemories.length > 0 ? clusterMemories.slice(0, 3) : []
        );
        
        if (keywords && keywords.length > 0) {
          log(`[ClusterCache] 为聚类${clusterId}提取了${keywords.length}个关键词: ${keywords.slice(0, 3).join(", ")}...`);
          
          // 保存关键词到聚类数据
          clusterData.keywords = keywords;
        }
        
        // 决定是否需要主题生成
        const needsTopicGeneration = !hasValidTopic && clusterMemories.length > 0;
        
        // 如果不需要生成主题，但是没有有效主题，设置一个基于关键词的主题
        if (!needsTopicGeneration && !hasValidTopic) {
          if (keywords && keywords.length > 0) {
            clusterData.topic = keywords.slice(0, 2).join('与') + '相关内容';
            log(`[ClusterCache] 使用关键词创建聚类${clusterId}的主题: "${clusterData.topic}"`);
          } else {
            clusterData.topic = `聚类 ${clusterId.replace('cluster_', '')}`;
            log(`[ClusterCache] 为聚类${clusterId}使用默认主题: "${clusterData.topic}"`, 'warn');
          }
        }
        
        // 生成摘要（这不需要API调用，可以单独处理）
        if (!clusterData.summary && clusterMemories.length > 0) {
          const summary = await this.generateSummaryForCluster(clusterMemories);
          if (summary) {
            clusterData.summary = summary;
          }
        }
        
        // 如果需要生成主题，加入批处理队列
        if (needsTopicGeneration) {
          batchItems.push({
            clusterId,
            clusterData,
            clusterMemories: clusterMemories.slice(0, 5), // 最多使用5条记忆
            needsTopicGeneration,
            keywords: keywords || []
          });
        }
      }
      
      // 如果有需要生成主题的聚类，进行批量处理
      if (batchItems.length > 0) {
        log(`[ClusterCache] 发现${batchItems.length}个聚类需要生成主题，准备批量处理`);
        
        // 批量生成主题，每次最多处理3个聚类以减少API负载
        const BATCH_SIZE = 3;
        for (let i = 0; i < batchItems.length; i += BATCH_SIZE) {
          // 提取当前批次
          const currentBatch = batchItems.slice(i, i + BATCH_SIZE);
          log(`[ClusterCache] 处理批次 ${Math.floor(i/BATCH_SIZE) + 1}，包含${currentBatch.length}个聚类`);
          
          // 处理当前批次的每个聚类
          await this.processBatchTopicGeneration(currentBatch);
          
          // 如果还有更多批次，添加延迟以防止API限制
          if (i + BATCH_SIZE < batchItems.length) {
            log(`[ClusterCache] 批次间延迟 2000ms 以避免API限制`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } else {
        log(`[ClusterCache] 所有聚类都已有有效主题，跳过主题生成`);
      }
      
      return clusterResult;
    } catch (error) {
      log(`[ClusterCache] 增强聚类结果时出错: ${error}`, "error");
      // 即使出错，也要返回原始结果以保证至少有一些数据可用
      return clusterResult;
    }
  }
  
  /**
   * 批量处理聚类主题生成
   * 为一组聚类生成主题，处理错误并应用结果
   * 
   * @param batchItems 需要处理的聚类批次
   */
  private async processBatchTopicGeneration(
    batchItems: { 
      clusterId: string; 
      clusterData: any; 
      clusterMemories: string[]; 
      keywords: string[];
    }[]
  ): Promise<void> {
    try {
      // 从服务获取genAiService对象进行智能主题分析
      let { initializeGenAIService } = await import("../genai/genai_service");
      const genAiService = await initializeGenAIService();
      
      // 为每个聚类单独生成主题 - 一次一个以减少API负载
      // 我们不能合并多个聚类的内容，因为那样会生成一个通用主题而非特定主题
      for (const item of batchItems) {
        try {
          if (item.clusterMemories.length === 0) {
            item.clusterData.topic = `主题${item.clusterId}`;
            log(`[ClusterCache] 警告: 聚类${item.clusterId}没有记忆内容，使用默认主题`, 'warn');
            continue;
          }
          
          // 为当前聚类生成主题
          log(`[ClusterCache] 正在为聚类${item.clusterId}生成主题...`);
          
          // 定义聚类信息类型
          interface ClusterInfo {
            cluster_id: string;
            memory_count: number;
            memory_types: string;
            keywords?: string[];
            raw_data?: any;
          }
          
          // 准备向GenAI传递的元数据
          const clusterMetadata = {
            cluster_info: {
              cluster_id: item.clusterId,
              memory_count: item.clusterMemories.length,
              memory_types: "对话记忆", // 默认类型
              keywords: item.keywords
            } as ClusterInfo
          };
          
          // 将原始聚类数据传递给元数据，如果存在的话
          if (item.clusterData.raw_data) {
            clusterMetadata.cluster_info.raw_data = item.clusterData.raw_data;
          }
          
          try {
            // 使用服务生成主题
            const topic = await genAiService.generateTopicForMemories(
              item.clusterMemories, 
              clusterMetadata
            );
            
            if (topic) {
              log(`[ClusterCache] 成功为聚类${item.clusterId}生成智能主题: "${topic}"`);
              item.clusterData.topic = topic;
            } else {
              // 使用关键词作为备选主题
              this.applyFallbackTopic(item.clusterData, item.clusterId, item.keywords);
            }
          } catch (topicError) {
            log(`[ClusterCache] 生成主题API调用错误: ${topicError}`, "error");
            // API错误时使用关键词作为备选
            this.applyFallbackTopic(item.clusterData, item.clusterId, item.keywords);
          }
          
          // 添加短暂延迟，避免API限制
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (itemError) {
          log(`[ClusterCache] 处理聚类${item.clusterId}的主题时出错: ${itemError}`, "error");
          
          // 确保聚类有主题，即使出错
          if (!item.clusterData.topic || item.clusterData.topic.length === 0) {
            this.applyFallbackTopic(item.clusterData, item.clusterId, item.keywords);
          }
        }
      }
    } catch (batchError) {
      log(`[ClusterCache] 批量处理主题生成时出错: ${batchError}`, "error");
      
      // 确保所有聚类都有主题，即使批处理失败
      for (const item of batchItems) {
        if (!item.clusterData.topic || item.clusterData.topic.length === 0) {
          this.applyFallbackTopic(item.clusterData, item.clusterId, item.keywords);
        }
      }
    }
  }
  
  /**
   * 应用备选主题
   * 当主题生成失败时使用关键词或默认值
   */
  private applyFallbackTopic(clusterData: any, clusterId: string, keywords: string[]): void {
    if (keywords && keywords.length > 0) {
      clusterData.topic = keywords.slice(0, 2).join('与') + '相关内容';
      log(`[ClusterCache] 使用关键词创建聚类${clusterId}的备选主题: "${clusterData.topic}"`);
    } else {
      clusterData.topic = `聚类 ${clusterId.replace('cluster_', '')}`;
      log(`[ClusterCache] 为聚类${clusterId}使用默认备选主题: "${clusterData.topic}"`, 'warn');
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
      
      // 使用memorySummarizer生成主题
      // 导入生成摘要的服务
      const { memorySummarizer } = await import("./memory_summarizer");
      return await memorySummarizer.generateTopic(combinedContent);
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
      
      // 尝试使用GenAI服务生成摘要
      try {
        // 导入模块并初始化服务
        let { initializeGenAIService } = await import("../genai/genai_service");
        
        // 确保服务已初始化
        const genAiService = await initializeGenAIService();
        
        // 使用服务生成摘要
        const summary = await genAiService.generateSummary(combinedContent);
        if (summary) {
          log(`[ClusterCache] 成功使用GenAI生成摘要`, "info");
          return summary;
        }
      } catch (aiError) {
        log(`[ClusterCache] 使用GenAI服务生成摘要时出错: ${aiError}`, "warn");
      }
      
      // 备用方案：使用memorySummarizer
      const { memorySummarizer } = await import("./memory_summarizer");
      return await memorySummarizer.summarizeText(combinedContent);
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
      
      // 尝试使用GenAI服务提取关键词
      try {
        // 导入模块并初始化服务
        let { initializeGenAIService } = await import("../genai/genai_service");
        
        // 确保服务已初始化
        const genAiService = await initializeGenAIService();
        
        // 使用服务提取关键词
        const keywords = await genAiService.extractKeywords(combinedContent);
        if (keywords && keywords.length > 0) {
          log(`[ClusterCache] 成功使用GenAI提取关键词: ${keywords.join(', ')}`, "info");
          return keywords;
        }
      } catch (aiError) {
        log(`[ClusterCache] 使用GenAI服务提取关键词时出错: ${aiError}`, "warn");
      }
      
      // 备用方案：使用memorySummarizer
      const { memorySummarizer } = await import("./memory_summarizer");
      return await memorySummarizer.extractKeywords(combinedContent);
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
      // 如果结果为空或无效，不进行缓存
      if (!clusterResult || Object.keys(clusterResult).length === 0) {
        log(`[ClusterCache] 聚类结果为空，跳过用户${userId}的缓存操作`);
        return;
      }
      
      // 转换数据格式：更新cluster对象中的属性
      // 这个转换很关键，确保cluster.topic字段被正确保存
      for (const [clusterId, cluster] of Object.entries(clusterResult)) {
        const c = cluster as any;
        // 确保每个聚类都有topic属性，必要时从label复制
        if (c.label && (!c.topic || c.topic.startsWith('聚类') || c.topic.startsWith('集群'))) {
          c.topic = c.label;
          log(`[ClusterCache] 聚类${clusterId}: 从label复制主题 "${c.label}"`);
        } else if (c.keywords && Array.isArray(c.keywords) && c.keywords.length >= 2 && 
                (!c.topic || c.topic.startsWith('聚类') || c.topic.startsWith('集群'))) {
          c.topic = `${c.keywords[0]} 与 ${c.keywords[1]}`;
          log(`[ClusterCache] 聚类${clusterId}: 从关键词生成主题 "${c.topic}"`);
        }
      }
      
      // 检查结果是否包含有效数据
      let hasValidTopics = Object.values(clusterResult).some((cluster: any) => 
        cluster.topic && cluster.topic.length > 0 && 
        !cluster.topic.startsWith('聚类') && !cluster.topic.startsWith('集群')
      );
      
      // 即使没有有效主题，我们也尝试保存结果
      // 这是一个关键改变，确保初步聚类结果得到保存
      if (!hasValidTopics) {
        log(`[ClusterCache] 警告：聚类结果没有有效主题，但仍将保存基本聚类结构`, "warn");
        
        // 确保每个聚类至少有一个基本主题
        for (const [clusterId, cluster] of Object.entries(clusterResult)) {
          const c = cluster as any;
          if (!c.topic || c.topic.length === 0) {
            c.topic = `聚类 ${clusterId.replace('cluster_', '')}`;
          }
        }
      }
      
      // 计算聚类数量
      const clusterCount = Object.keys(clusterResult).length;
      
      // 打印详细日志，帮助诊断问题
      log(`[ClusterCache] 准备缓存用户${userId}的聚类结果，包含${clusterCount}个聚类，${vectorCount}个向量`);
      for (const [clusterId, cluster] of Object.entries(clusterResult)) {
        const c = cluster as any;
        log(`[ClusterCache] - 聚类${clusterId}: 主题="${c.topic || '未知'}", 包含${c.memory_ids?.length || 0}条记忆`);
      }
      
      // 序列化并进行深度复制以避免引用问题
      let safeClusterData: any;
      try {
        // 先尝试完整序列化
        const serialized = JSON.stringify(clusterResult);
        safeClusterData = JSON.parse(serialized);
        log(`[ClusterCache] JSON序列化检查通过，数据大小: ${serialized.length} 字节`);
      } catch (serializeError) {
        log(`[ClusterCache] 完整JSON序列化失败: ${serializeError}，将创建简化版本`, "error");
        
        // 创建一个简化版本，只保留必要的字段
        safeClusterData = {};
        try {
          for (const [clusterId, cluster] of Object.entries(clusterResult)) {
            const c = cluster as any;
            
            // 只保存必要的字段，避免无法序列化的复杂对象
            safeClusterData[clusterId] = {
              topic: c.topic || `聚类 ${clusterId.replace('cluster_', '')}`,
              memory_ids: Array.isArray(c.memory_ids) ? c.memory_ids : [],
              keywords: Array.isArray(c.keywords) ? c.keywords.slice(0, 10) : [],
              summary: typeof c.summary === 'string' ? c.summary.substring(0, 1000) : ''
            };
            
            // 如果centroid是数组，保留一部分用于调试
            if (c.centroid && Array.isArray(c.centroid) && c.centroid.length > 0) {
              safeClusterData[clusterId].centroid_sample = c.centroid.slice(0, 5);
            }
          }
          
          // 验证简化数据可以序列化
          JSON.stringify(safeClusterData);
          log(`[ClusterCache] 已创建可序列化的简化聚类数据`);
        } catch (fallbackError) {
          log(`[ClusterCache] 简化数据也无法序列化: ${fallbackError}，使用空对象并附加错误信息`, "error");
          safeClusterData = { 
            error: "无法序列化聚类数据",
            clusterCount,
            vectorCount,
            timestamp: new Date().toISOString()
          };
        }
      }
      
      // 保存到缓存（添加重试逻辑）
      const maxRetries = 3; // 增加重试次数
      let retries = 0;
      let saved = false;
      
      while (retries <= maxRetries && !saved) {
        try {
          const result = await storage.saveClusterResultCache(
            userId,
            safeClusterData, // 使用安全的、可序列化的数据
            clusterCount,
            vectorCount,
            this.cacheExpiryHours
          );
          saved = true;
          log(`[ClusterCache] 成功缓存用户${userId}的聚类结果，ID=${result.id}，包含${clusterCount}个聚类，${vectorCount}个向量，有效期${this.cacheExpiryHours}小时`);
        } catch (saveError) {
          retries++;
          const delay = retries * 1000; // 逐渐增加延迟
          if (retries <= maxRetries) {
            log(`[ClusterCache] 缓存聚类结果失败 (尝试 ${retries}/${maxRetries}): ${saveError}，等待${delay}ms后重试`, "warn");
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            log(`[ClusterCache] 所有重试均失败，无法保存聚类结果: ${saveError}`, "error");
            // 不再抛出错误，只是返回失败，让调用方继续运行
            return;
          }
        }
      }
    } catch (error) {
      log(`[ClusterCache] 缓存聚类结果时出错: ${error}`, "error");
      // 不再抛出错误，只是记录日志并返回，使整个流程更健壮
      // 即使缓存失败，用户仍然可以看到当前请求的聚类结果
    }
  }
  
  /**
   * 清除指定用户的聚类缓存
   * @param userId 用户ID
   * @returns 是否成功清除
   */
  async clearUserClusterCache(userId: number): Promise<boolean> {
    try {
      await storage.clearClusterResultCache(userId);
      log(`[ClusterCache] 已清除用户${userId}的聚类缓存`);
      return true;
    } catch (error) {
      log(`[ClusterCache] 清除用户${userId}的聚类缓存失败: ${error}`, "error");
      return false;
    }
  }
}

// 导出单例
export const clusterCacheService = new ClusterCacheService();