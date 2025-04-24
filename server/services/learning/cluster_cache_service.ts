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
      // 特殊处理管理员用户
      if (userId === 1) {
        log(`[ClusterCache] 跳过管理员用户(ID=1)的聚类处理`);
        return {}; // 返回空结果
      }
      
      // 如果强制刷新，直接跳过缓存检查
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
                  log(`[ClusterCache] 用户${userId}的缓存聚类结果包含有效的主题名称`);
                  return clusterData;
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
      
      // 执行聚类并缓存结果
      const result = await this.performClusteringAndCache(userId);
      
      // 检查聚类结果是否有意义
      if (result && Object.keys(result).length > 0) {
        // 计算有多少有效主题名称
        const validTopics = Object.values(result).filter((cluster: any) => 
          cluster.topic && cluster.topic.length > 0 && !cluster.topic.startsWith('聚类')
        );
        
        const validTopicCount = validTopics.length;
        const totalTopicCount = Object.keys(result).length;
        
        log(`[ClusterCache] 用户${userId}的聚类结果有${validTopicCount}/${totalTopicCount}个有效主题名称`);
      } else {
        log(`[ClusterCache] 用户${userId}的聚类结果为空或无效`, "warn");
      }
      
      return result;
    } catch (error) {
      log(`[ClusterCache] 获取聚类结果出错: ${error}`, "error");
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
          // 强制重新生成所有聚类的主题，确保有有意义的主题标签
          log(`[ClusterCache] 聚类${clusterId}包含${clusterMemories.length}条记忆，正在处理`);
          log(`[ClusterCache] 聚类${clusterId}的现有主题: "${clusterData.topic || '无'}"`);
          
          // 使用GenAI进行智能分析生成聚类主题
          log(`[ClusterCache] 开始为聚类${clusterId}生成智能主题...`);
          
          try {
            // 直接基于实际记忆内容智能生成主题，不依赖任何标识或占位符
            // 只有当已经有了明确非空且有意义的主题时才保留
            if (clusterData.topic && clusterData.topic.length > 2 && 
                !clusterData.topic.startsWith('聚类') && 
                !clusterData.topic.startsWith('主题')) {
              log(`[ClusterCache] 保留聚类${clusterId}的现有主题: "${clusterData.topic}"`);
            } 
            else {
              // 无论是空主题还是通用标识，都使用GenAI进行智能生成
              // 记忆内容示例
              if (clusterMemories.length > 0) {
                const sampleContent = clusterMemories[0].substring(0, 100) + 
                  (clusterMemories[0].length > 100 ? '...' : '');
                log(`[ClusterCache] 聚类${clusterId}内容示例: "${sampleContent}"`);
              }
              
              // 从服务获取genAiService对象进行智能主题分析
              const { genAiService } = await import("../genai/genai_service");
              
              if (clusterMemories.length === 0) {
                log(`[ClusterCache] 警告: 聚类${clusterId}没有记忆内容，无法生成主题`, 'warn');
                clusterData.topic = `主题${clusterId}`;
              } else {
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
                    cluster_id: clusterId,
                    memory_count: clusterMemories.length,
                    memory_types: "对话记忆" // 默认类型
                  } as ClusterInfo
                };
                
                // 尝试提取关键词作为额外元数据
                const keywords = await this.extractKeywordsFromCluster(clusterMemories.slice(0, 3));
                if (keywords && keywords.length > 0) {
                  clusterMetadata.cluster_info.keywords = keywords;
                  log(`[ClusterCache] 为聚类${clusterId}提取了${keywords.length}个关键词: ${keywords.slice(0, 3).join(", ")}...`);
                } else {
                  log(`[ClusterCache] 未能为聚类${clusterId}提取关键词`, "warn");
                }
                
                // 将原始聚类数据传递给元数据，如果存在的话
                if (clusterData.raw_data) {
                  clusterMetadata.cluster_info.raw_data = clusterData.raw_data;
                }
                
                // 使用多个记忆内容示例进行主题生成，同时传递元数据
                const memorySamples = clusterMemories.slice(0, 5); // 最多使用5条记忆
                log(`[ClusterCache] 向GenAI传递${memorySamples.length}条样本和元数据生成主题`);
                
                // 确保genAiService已完全初始化
                let topic = null;
                try {
                  // 导入模块并验证服务是否已初始化
                  let { genAiService } = await import("../genai/genai_service");
                  
                  // 如果genAiService可用，使用它生成主题
                  if (genAiService && typeof genAiService.generateTopicForMemories === 'function') {
                    topic = await genAiService.generateTopicForMemories(memorySamples, clusterMetadata);
                  } else {
                    log(`[ClusterCache] 警告: GenAI服务未完全初始化，使用备用方案`, "warn");
                    // 如果服务不可用，尝试提取关键词作为主题
                    const keywords = await this.extractKeywordsFromCluster(clusterMemories);
                    if (keywords && keywords.length > 0) {
                      topic = keywords[0];
                    }
                  }
                } catch (aiError) {
                  log(`[ClusterCache] 使用GenAI服务生成主题时出错: ${aiError}`, "error");
                  // 出错时继续执行，会在后续条件中处理
                }
                
                if (topic) {
                  log(`[ClusterCache] 成功为聚类${clusterId}生成智能主题: "${topic}"`);
                  clusterData.topic = topic;
                } else {
                  log(`[ClusterCache] 警告: 无法为聚类${clusterId}生成主题，尝试关键词方法`, 'warn');
                  
                  // 尝试从记忆中提取关键词作为主题
                  const keywords = await this.extractKeywordsFromCluster(clusterMemories);
                  if (keywords && keywords.length > 0) {
                    const newTopic = keywords.slice(0, 2).join('与') + '相关内容';
                    log(`[ClusterCache] 使用关键词生成主题: "${newTopic}"`);
                    clusterData.topic = newTopic;
                    clusterData.keywords = keywords;
                  } else {
                    log(`[ClusterCache] 无法通过任何方式生成主题，使用默认值`, 'warn');
                    clusterData.topic = `主题${clusterId}`;
                  }
                }
              }
            }
          } catch (error) {
            log(`[ClusterCache] 生成聚类${clusterId}主题时发生错误: ${error}`, 'error');
            clusterData.topic = `主题${clusterId}`;
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
        // 导入模块并验证服务是否已初始化
        let { genAiService } = await import("../genai/genai_service");
        
        // 如果genAiService可用，使用它生成摘要
        if (genAiService && typeof genAiService.generateSummary === 'function') {
          return await genAiService.generateSummary(combinedContent);
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
        // 导入模块并验证服务是否已初始化
        let { genAiService } = await import("../genai/genai_service");
        
        // 如果genAiService可用，使用它提取关键词
        if (genAiService && typeof genAiService.extractKeywords === 'function') {
          return await genAiService.extractKeywords(combinedContent);
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
      const hasValidTopics = Object.values(clusterResult).some((cluster: any) => 
        cluster.topic && cluster.topic.length > 0 && 
        !cluster.topic.startsWith('聚类') && !cluster.topic.startsWith('集群')
      );
      
      if (!hasValidTopics) {
        log(`[ClusterCache] 聚类结果没有有效主题，可能是主题生成失败，跳过用户${userId}的缓存操作`, "warn");
        return;
      }
      
      // 计算聚类数量
      const clusterCount = Object.keys(clusterResult).length;
      
      // 打印详细日志，帮助诊断问题
      log(`[ClusterCache] 准备缓存用户${userId}的聚类结果，包含${clusterCount}个聚类，${vectorCount}个向量`);
      for (const [clusterId, cluster] of Object.entries(clusterResult)) {
        const c = cluster as any;
        log(`[ClusterCache] - 聚类${clusterId}: 主题="${c.topic || '未知'}", 包含${c.memory_ids?.length || 0}条记忆`);
      }
      
      // 序列化检查，确保JSON能正确保存
      try {
        const serialized = JSON.stringify(clusterResult);
        const deserialized = JSON.parse(serialized);
        log(`[ClusterCache] JSON序列化检查通过，数据大小: ${serialized.length} 字节`);
        
        // 检查反序列化后是否保留了原始结构
        const checkTopics = Object.values(deserialized).some((cluster: any) => 
          cluster.topic && cluster.topic.length > 0 && 
          !cluster.topic.startsWith('聚类') && !cluster.topic.startsWith('集群')
        );
        
        if (!checkTopics) {
          log(`[ClusterCache] 警告：JSON序列化后丢失了topic属性，这可能是数据结构问题`, "warn");
        }
      } catch (serializeError) {
        log(`[ClusterCache] JSON序列化检查失败: ${serializeError}`, "error");
        // 修复或清理问题数据
        for (const [clusterId, cluster] of Object.entries(clusterResult)) {
          const c = cluster as any;
          // 清理潜在的循环引用或无法序列化的属性
          if (c.centroid && c.centroid.length > 0) {
            // 保留前10个元素用于调试，避免存储过大数据
            c.centroid = c.centroid.slice(0, 10);
          }
        }
      }
      
      // 保存到缓存（添加重试逻辑）
      const maxRetries = 2;
      let retries = 0;
      let saved = false;
      
      while (retries <= maxRetries && !saved) {
        try {
          const result = await storage.saveClusterResultCache(
            userId,
            clusterResult,
            clusterCount,
            vectorCount,
            this.cacheExpiryHours
          );
          saved = true;
          log(`[ClusterCache] 成功缓存用户${userId}的聚类结果，ID=${result.id}，包含${clusterCount}个聚类，${vectorCount}个向量，有效期${this.cacheExpiryHours}小时`);
        } catch (saveError) {
          retries++;
          if (retries <= maxRetries) {
            log(`[ClusterCache] 缓存聚类结果失败 (尝试 ${retries}/${maxRetries}): ${saveError}`, "warn");
            await new Promise(resolve => setTimeout(resolve, 500)); // 延迟重试
          } else {
            throw saveError; // 重试用尽，向上抛出错误
          }
        }
      }
    } catch (error) {
      log(`[ClusterCache] 缓存聚类结果时出错: ${error}`, "error");
      // 为了调试目的，将错误向上抛出
      throw new Error(`保存聚类缓存时出错: ${error}`);
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