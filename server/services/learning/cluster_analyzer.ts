/**
 * 聚类分析服务
 * 对记忆向量进行聚类分析，识别主题和学习模式
 */

import { log } from "../../vite";
import { genAiService } from "../genai/genai_service";
import { vectorEmbeddingsService } from "./vector_embeddings";
import { v4 as uuidv4 } from "uuid";
import { Memory } from "@shared/schema";

export interface ClusterTopic {
  id: string;
  topic: string;
  count: number;
  percentage: number;
  // 该聚类中的记忆ID
  memoryIds?: number[];
  // 该主题的代表性记忆
  representativeMemory?: Memory;
}

export interface ClusterResult {
  topics: ClusterTopic[];
  error?: string;
}

export class ClusterAnalyzerService {
  /**
   * 使用简单聚类算法分析记忆向量
   * 
   * 该方法会根据向量相似度将记忆分组，并尝试为每个组生成主题标签
   * 
   * @param memories 记忆对象数组
   * @param memoryEmbeddings 记忆向量数组
   * @param minClusterSize 最小聚类大小
   * @returns 聚类结果
   */
  async analyzeMemoryClusters(
    memories: { 
      id: string; 
      userId: number; 
      content: string; 
      type: string; 
      timestamp: Date | null; 
      summary: string | null; 
      createdAt: Date | null; 
    }[],
    memoryEmbeddings: number[][],
    minClusterSize: number = 3
  ): Promise<ClusterResult> {
    try {
      if (memories.length < 5 || memoryEmbeddings.length < 5) {
        return { 
          topics: [],
          error: "Not enough memories for clustering"
        };
      }
      
      if (memories.length !== memoryEmbeddings.length) {
        log("[cluster_analyzer] 记忆数量与向量数量不匹配", "error");
        return {
          topics: [],
          error: "Memory and embedding count mismatch"
        };
      }
      
      // 将记忆和向量配对
      const memoriesWithEmbeddings = memories.map((memory, index) => ({
        memory,
        embedding: memoryEmbeddings[index]
      }));
      
      // 执行层次聚类
      const similarityThreshold = 0.7; // 相似度阈值，调整此值可以改变聚类粒度
      const clusters = await this.performHierarchicalClustering(
        memoriesWithEmbeddings,
        similarityThreshold,
        minClusterSize
      );
      
      // 如果聚类失败，生成默认主题
      if (clusters.length === 0) {
        log("[cluster_analyzer] 聚类失败，生成默认主题", "warn");
        return {
          topics: this.generateDefaultTopics(memories),
          error: "Clustering resulted in no valid clusters"
        };
      }
      
      // 为每个聚类生成主题
      const topics = await this.generateTopicsForClusters(clusters);
      
      return { topics };
      
    } catch (error) {
      log(`[cluster_analyzer] 记忆聚类分析出错: ${error}`, "error");
      return {
        topics: this.generateDefaultTopics(memories),
        error: "Clustering analysis failed"
      };
    }
  }
  
  /**
   * 执行层次聚类算法
   * 将相似的记忆分组在一起
   * 
   * @param memoriesWithEmbeddings 记忆和向量对的数组
   * @param similarityThreshold 相似度阈值
   * @param minClusterSize 最小聚类大小
   * @returns 聚类结果数组
   */
  private async performHierarchicalClustering(
    memoriesWithEmbeddings: { memory: Memory, embedding: number[] }[],
    similarityThreshold: number,
    minClusterSize: number
  ): Promise<Memory[][]> {
    // 计算所有记忆对之间的相似度
    const similarities: { i: number, j: number, similarity: number }[] = [];
    for (let i = 0; i < memoriesWithEmbeddings.length; i++) {
      for (let j = i + 1; j < memoriesWithEmbeddings.length; j++) {
        const similarity = this.cosineSimilarity(
          memoriesWithEmbeddings[i].embedding,
          memoriesWithEmbeddings[j].embedding
        );
        similarities.push({ i, j, similarity });
      }
    }
    
    // 按相似度降序排序
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // 初始化每个记忆为单独的聚类
    const clusters: number[][] = memoriesWithEmbeddings.map((_, index) => [index]);
    
    // 合并相似的聚类
    for (const { i, j, similarity } of similarities) {
      if (similarity < similarityThreshold) {
        break; // 跳过相似度低于阈值的记忆对
      }
      
      // 查找i和j所在的聚类
      const clusterI = clusters.findIndex(cluster => cluster.includes(i));
      const clusterJ = clusters.findIndex(cluster => cluster.includes(j));
      
      // 如果它们不在同一个聚类中，合并这两个聚类
      if (clusterI !== -1 && clusterJ !== -1 && clusterI !== clusterJ) {
        clusters[clusterI] = [...clusters[clusterI], ...clusters[clusterJ]];
        clusters.splice(clusterJ, 1);
      }
    }
    
    // 过滤出符合最小大小要求的聚类
    const validClusters = clusters.filter(cluster => cluster.length >= minClusterSize);
    
    // 将索引转换回记忆对象
    return validClusters.map(cluster => 
      cluster.map(index => memoriesWithEmbeddings[index].memory)
    );
  }
  
  /**
   * 为每个聚类生成主题标签
   * @param clusters 聚类数组
   * @returns 主题对象数组
   */
  private async generateTopicsForClusters(clusters: Memory[][]): Promise<ClusterTopic[]> {
    const totalMemories = clusters.reduce((sum, cluster) => sum + cluster.length, 0);
    const topics: ClusterTopic[] = [];
    
    for (const cluster of clusters) {
      try {
        // 选取聚类中的内容进行主题生成
        const contentSamples = cluster.map(memory => memory.content).slice(0, 5);
        const topic = await this.generateTopicForMemories(cluster);
        
        // 计算该聚类在所有记忆中的占比
        const percentage = Math.round((cluster.length / totalMemories) * 100);
        
        // 找出最有代表性的记忆（这里简单地选择第一个）
        const representativeMemory = cluster[0];
        
        // 获取聚类中所有记忆的ID
        const memoryIds = cluster.map(memory => memory.id);
        
        topics.push({
          id: uuidv4(),
          topic: topic || "未分类主题",
          count: cluster.length,
          percentage,
          memoryIds,
          representativeMemory
        });
      } catch (error) {
        log(`[cluster_analyzer] 为聚类生成主题时出错: ${error}`, "error");
      }
    }
    
    return topics;
  }
  
  /**
   * 为一组记忆生成主题标签
   * @param memories 记忆数组
   * @returns 主题标签
   */
  private async generateTopicForMemories(memories: Memory[]): Promise<string> {
    try {
      // 选取记忆内容样本
      const contentSamples = memories
        .map(memory => memory.content || "")
        .filter(content => content.length > 0)
        .slice(0, 5);
      
      if (contentSamples.length === 0) {
        return "空内容";
      }
      
      // 尝试使用GenAI服务生成主题 - 添加向量数据和聚类元数据
      try {
        // 收集记忆的向量嵌入数据
        const memoryIds = memories.map(memory => memory.id);
        const embeddingsData = await this.getEmbeddingsForMemories(memoryIds);
        
        // 计算聚类中心（简单平均所有向量）
        let clusterCenter = null;
        if (embeddingsData.length > 0) {
          const firstVector = embeddingsData[0];
          if (firstVector && Array.isArray(firstVector)) {
            // 初始化为第一个向量的深拷贝
            clusterCenter = [...firstVector];
            
            // 累加其他向量
            for (let i = 1; i < embeddingsData.length; i++) {
              const vector = embeddingsData[i];
              if (vector && vector.length === clusterCenter.length) {
                for (let j = 0; j < clusterCenter.length; j++) {
                  clusterCenter[j] += vector[j];
                }
              }
            }
            
            // 求平均
            for (let j = 0; j < clusterCenter.length; j++) {
              clusterCenter[j] /= embeddingsData.length;
            }
          }
        }
        
        // 准备聚类元数据
        const clusterMetadata = {
          cluster_info: {
            memory_count: memories.length,
            vector_dimension: clusterCenter ? clusterCenter.length : null,
            center: clusterCenter, // 传递完整向量数据，便于更准确的分析
            memory_types: this.getMemoryTypes(memories),
            keywords: await this.getCommonKeywords(memories, 10),
            raw_data: true // 标记这是原始聚类数据，不是测试数据
          }
        };
        
        // 调用GenAI服务生成主题，传递内容样本和聚类元数据
        const topic = await genAiService.generateTopicForMemories(contentSamples, clusterMetadata);
        if (topic) {
          log(`[cluster_analyzer] AI成功生成主题: ${topic}`);
          return topic;
        }
      } catch (aiError) {
        log(`[cluster_analyzer] AI生成主题失败: ${aiError}`, "warn");
        // AI服务失败，继续使用关键词统计方法
      }
      
      // 后备方案1：使用关键词频率统计生成主题
      log(`[cluster_analyzer] 使用关键词频率统计生成主题`);
      const keywordCounts = new Map<string, number>();
      
      // 收集所有记忆的关键词
      let keywordsFound = false;
      for (const memory of memories) {
        try {
          // 从storage获取关键词
          const keywords = await this.getKeywordsForMemory(memory.id);
          
          if (keywords && keywords.length > 0) {
            keywordsFound = true;
            for (const keyword of keywords) {
              const count = keywordCounts.get(keyword) || 0;
              keywordCounts.set(keyword, count + 1);
            }
          }
        } catch (e) {
          // 忽略单个记忆的关键词获取失败
        }
      }
      
      // 如果找到了关键词，使用最频繁的几个作为主题
      if (keywordCounts.size > 0) {
        // 按频率排序关键词
        const sortedKeywords = Array.from(keywordCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)  // 取前3个最常见的关键词
          .map(entry => entry[0]);
        
        if (sortedKeywords.length > 0) {
          const topicFromKeywords = sortedKeywords.join("、");
          log(`[cluster_analyzer] 从关键词生成主题: ${topicFromKeywords}`);
          return topicFromKeywords;
        }
      }
      
      // 后备方案2：提取内容中的关键短语
      if (!keywordsFound) {
        try {
          // 提取文本中的关键短语，使用简单的文本分析
          const commonWords = new Set(['的', '是', '在', '了', '和', '有', '与', '又', '也', 'the', 'is', 'a', 'an', 'of', 'to', 'in', 'for']);
          const textForAnalysis = contentSamples.join(" ");
          
          // 简单的文本分词 (中文按字符，英文按空格)
          const chineseWords = textForAnalysis.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
          const englishWords = textForAnalysis.match(/[a-zA-Z]{3,15}/g) || [];
          
          // 过滤常见词和过短的词
          const filteredWords = [...chineseWords, ...englishWords]
            .filter(word => !commonWords.has(word.toLowerCase()) && word.length >= 2);
          
          // 计算词频
          const wordFrequency = new Map<string, number>();
          for (const word of filteredWords) {
            const count = wordFrequency.get(word) || 0;
            wordFrequency.set(word, count + 1);
          }
          
          // 取频率最高的2-3个词
          const topWords = Array.from(wordFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(entry => entry[0]);
          
          if (topWords.length > 0) {
            const extractedTopic = topWords.join("、");
            log(`[cluster_analyzer] 从文本内容提取关键短语: ${extractedTopic}`);
            return extractedTopic;
          }
        } catch (e) {
          log(`[cluster_analyzer] 提取关键短语失败: ${e}`, "warn");
        }
      }
      
      // 后备方案3：使用记忆摘要
      for (const memory of memories) {
        if (memory.summary) {
          const summary = memory.summary;
          // 截取摘要的前15个字符作为主题
          const shortSummary = summary.length > 15 ? summary.substring(0, 15) + "..." : summary;
          log(`[cluster_analyzer] 使用记忆摘要生成主题: ${shortSummary}`);
          return shortSummary;
        }
      }
      
      // 最后的后备方案：使用记忆内容的前几个字，但移除特殊字符以获得更好的主题
      const firstContent = contentSamples[0];
      
      // 清理文本，移除常见的特殊标记和控制字符
      let cleanedContent = firstContent
        .replace(/[\n\r\t]/g, " ")      // 把换行和制表符替换为空格
        .replace(/<[^>]*>/g, "")        // 移除HTML标签
        .replace(/["'`„"''«»]/g, "")    // 移除各种引号
        .replace(/[\[\]{}()]/g, "")     // 移除括号
        .replace(/\s+/g, " ")           // 压缩多个空格
        .trim();
      
      // 移除开头的特殊模式，如"1."或数字部分
      cleanedContent = cleanedContent.replace(/^[0-9.\s]+/, "");
      
      // 寻找句子边界，优先用第一个完整句子
      const sentenceMatch = cleanedContent.match(/^[^.!?。！？]+[.!?。！？]/);
      if (sentenceMatch && sentenceMatch[0].length <= 20) {
        log(`[cluster_analyzer] 使用第一个句子作为主题: ${sentenceMatch[0]}`);
        return sentenceMatch[0];
      }
      
      // 截取内容的前15-20个字符作为主题，避免截断词语
      let shortContent = "";
      if (cleanedContent.length > 20) {
        // 找到第20个字符后的第一个空格
        const spaceAfter20 = cleanedContent.indexOf(" ", 20);
        if (spaceAfter20 > 0 && spaceAfter20 < 30) {
          shortContent = cleanedContent.substring(0, spaceAfter20);
        } else {
          shortContent = cleanedContent.substring(0, 20) + "...";
        }
      } else {
        shortContent = cleanedContent;
      }
      
      log(`[cluster_analyzer] 使用清理后的记忆内容生成主题: ${shortContent}`);
      return shortContent;
    } catch (error) {
      log(`[cluster_analyzer] 生成主题时出错: ${error}`, "error");
      return "未分类主题";
    }
  }
  
  /**
   * 获取记忆的关键词
   * @param memoryId 记忆ID（字符串或数字类型）
   * @returns 关键词数组
   */
  private async getKeywordsForMemory(memoryId: string | number): Promise<string[]> {
    try {
      // 从storage导入，确保避免循环引用
      const { storage } = await import('../../storage');
      const keywords = await storage.getKeywordsByMemoryId(memoryId);
      log(`[cluster_analyzer] 成功获取记忆#${memoryId}的关键词: ${keywords.length}个`);
      return keywords.map(k => k.keyword);
    } catch (error) {
      log(`[cluster_analyzer] 获取记忆#${memoryId}的关键词失败: ${error}`, "warn");
      return [];
    }
  }
  
  /**
   * 获取一组记忆的共同关键词
   * @param memories 记忆数组
   * @param maxKeywords 最大关键词数量
   * @returns 共同关键词数组
   */
  private async getCommonKeywords(memories: Memory[], maxKeywords: number = 5): Promise<string[]> {
    try {
      // 收集所有记忆的关键词
      const keywordCounts = new Map<string, number>();
      
      for (const memory of memories) {
        try {
          const keywords = await this.getKeywordsForMemory(memory.id);
          
          if (keywords && keywords.length > 0) {
            for (const keyword of keywords) {
              const count = keywordCounts.get(keyword) || 0;
              keywordCounts.set(keyword, count + 1);
            }
          }
        } catch (e) {
          // 忽略单个记忆的关键词获取失败
        }
      }
      
      // 按频率排序关键词
      const sortedKeywords = Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(entry => entry[0]);
      
      return sortedKeywords;
    } catch (error) {
      log(`[cluster_analyzer] 获取共同关键词失败: ${error}`, "warn");
      return [];
    }
  }
  
  /**
   * 获取记忆向量嵌入数据
   * @param memoryIds 记忆ID数组
   * @returns 向量数组
   */
  private async getEmbeddingsForMemories(memoryIds: string[]): Promise<number[][]> {
    try {
      if (!memoryIds || memoryIds.length === 0) {
        return [];
      }
      
      // 从storage导入，确保避免循环引用
      const { storage } = await import('../../storage');
      
      // 批量获取向量嵌入
      const embeddings = await Promise.all(
        memoryIds.map(async (id) => {
          try {
            const embedding = await storage.getEmbeddingByMemoryId(id);
            if (embedding && embedding.vectorData) {
              return embedding.vectorData;
            }
            return null;
          } catch (e) {
            log(`[cluster_analyzer] 获取记忆#${id}的向量嵌入失败`, "warn");
            return null;
          }
        })
      );
      
      // 过滤掉null值
      return embeddings.filter(e => e !== null) as number[][];
    } catch (error) {
      log(`[cluster_analyzer] 批量获取向量嵌入失败: ${error}`, "warn");
      return [];
    }
  }
  
  /**
   * 获取记忆类型统计信息
   * @param memories 记忆数组
   * @returns 记忆类型描述
   */
  private getMemoryTypes(memories: Memory[]): string {
    try {
      // 统计各类型记忆数量
      const typeCounts = new Map<string, number>();
      
      for (const memory of memories) {
        const type = memory.type || "unknown";
        const count = typeCounts.get(type) || 0;
        typeCounts.set(type, count + 1);
      }
      
      // 按数量排序
      const sortedTypes = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1]);
      
      // 如果只有一种类型，直接返回
      if (sortedTypes.length === 1) {
        return `${sortedTypes[0][0]}类型记忆`;
      }
      
      // 如果有多种类型，返回最多的两种
      const topTypes = sortedTypes.slice(0, 2);
      const typeText = topTypes.map(t => `${t[0]}(${t[1]}个)`).join('和');
      
      if (sortedTypes.length > 2) {
        return `主要包含${typeText}等`;
      } else {
        return `包含${typeText}`;
      }
    } catch (error) {
      log(`[cluster_analyzer] 获取记忆类型统计失败: ${error}`, "warn");
      return "混合类型记忆";
    }
  }
  
  /**
   * 当聚类分析失败时生成默认主题
   * @param memories 所有记忆
   * @returns 默认主题数组
   */
  private generateDefaultTopics(memories: Memory[]): ClusterTopic[] {
    try {
      // 按时间将记忆分为三组
      const sortedMemories = [...memories].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });
      
      const thirds = Math.floor(sortedMemories.length / 3);
      const recentMemories = sortedMemories.slice(-thirds);
      const middleMemories = sortedMemories.slice(thirds, thirds * 2);
      const oldestMemories = sortedMemories.slice(0, thirds);
      
      const totalMemories = memories.length;
      
      const topics: ClusterTopic[] = [];
      
      // 添加最近记忆主题
      if (recentMemories.length > 0) {
        topics.push({
          id: uuidv4(),
          topic: "最近记忆",
          count: recentMemories.length,
          percentage: Math.round((recentMemories.length / totalMemories) * 100),
          memoryIds: recentMemories.map(m => m.id),
          representativeMemory: recentMemories[0]
        });
      }
      
      // 添加中期记忆主题
      if (middleMemories.length > 0) {
        topics.push({
          id: uuidv4(),
          topic: "较早记忆",
          count: middleMemories.length,
          percentage: Math.round((middleMemories.length / totalMemories) * 100),
          memoryIds: middleMemories.map(m => m.id),
          representativeMemory: middleMemories[0]
        });
      }
      
      // 添加最早记忆主题
      if (oldestMemories.length > 0) {
        topics.push({
          id: uuidv4(),
          topic: "最早记忆",
          count: oldestMemories.length,
          percentage: Math.round((oldestMemories.length / totalMemories) * 100),
          memoryIds: oldestMemories.map(m => m.id),
          representativeMemory: oldestMemories[0]
        });
      }
      
      return topics;
    } catch (error) {
      log(`[cluster_analyzer] 生成默认主题时出错: ${error}`, "error");
      
      // 最简单的后备方案
      return [{
        id: uuidv4(),
        topic: "所有记忆",
        count: memories.length,
        percentage: 100,
        memoryIds: memories.map(m => m.id),
        representativeMemory: memories[0]
      }];
    }
  }
  
  /**
   * 计算两个向量的余弦相似度
   * @param vec1 第一个向量
   * @param vec2 第二个向量
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
  
  /**
   * 生成学习轨迹分析
   * 分析用户的学习兴趣变化和主题分布
   * 
   * @param topics 主题聚类结果
   * @param memories 记忆数组
   * @returns 学习轨迹分析结果
   */
  async generateLearningTrajectory(
    topics: ClusterTopic[],
    memories: Memory[]
  ): Promise<any> {
    try {
      if (topics.length === 0 || memories.length === 0) {
        return {
          description: "没有足够的记忆数据来生成学习轨迹",
          timeDistribution: {}
        };
      }
      
      // 按时间顺序排序记忆
      const sortedMemories = [...memories].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });
      
      // 将记忆按时间分段
      const segments = Math.min(5, Math.ceil(sortedMemories.length / 10));
      const timeSegments = this.splitMemoriesByTime(sortedMemories, segments);
      
      // 分析每个时间段内的主题分布
      const timeDistribution: Record<string, any> = {};
      
      for (let i = 0; i < timeSegments.length; i++) {
        const segment = timeSegments[i];
        const startDate = segment[0]?.createdAt ? new Date(segment[0].createdAt) : new Date();
        const endDate = segment[segment.length - 1]?.createdAt ? new Date(segment[segment.length - 1].createdAt) : new Date();
        
        const segmentKey = `segment_${i + 1}`;
        timeDistribution[segmentKey] = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          count: segment.length,
          topicDistribution: {}
        };
        
        // 计算该时间段内各主题的分布
        for (const topic of topics) {
          if (!topic.memoryIds) continue;
          
          const topicMemoriesInSegment = segment.filter(memory => 
            topic.memoryIds?.includes(memory.id)
          );
          
          if (topicMemoriesInSegment.length > 0) {
            const percentage = Math.round((topicMemoriesInSegment.length / segment.length) * 100);
            timeDistribution[segmentKey].topicDistribution[topic.topic] = {
              count: topicMemoriesInSegment.length,
              percentage
            };
          }
        }
      }
      
      // 生成学习轨迹描述
      const description = this.generateTrajectoryDescription(topics, timeDistribution);
      
      return {
        description,
        timeDistribution
      };
      
    } catch (error) {
      log(`[cluster_analyzer] 生成学习轨迹时出错: ${error}`, "error");
      return {
        description: "无法生成学习轨迹分析",
        error: "Learning trajectory analysis failed"
      };
    }
  }
  
  /**
   * 按时间将记忆分段
   * @param memories 按时间排序的记忆数组
   * @param segments 分段数量
   * @returns 分段后的记忆数组
   */
  private splitMemoriesByTime(memories: Memory[], segments: number): Memory[][] {
    const result: Memory[][] = [];
    const segmentSize = Math.ceil(memories.length / segments);
    
    for (let i = 0; i < segments; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, memories.length);
      const segment = memories.slice(start, end);
      
      if (segment.length > 0) {
        result.push(segment);
      }
    }
    
    return result;
  }
  
  /**
   * 生成学习轨迹描述
   * @param topics 主题对象数组
   * @param timeDistribution 时间分布对象
   * @returns 描述文本
   */
  private generateTrajectoryDescription(
    topics: ClusterTopic[],
    timeDistribution: Record<string, any>
  ): string {
    try {
      // 简单描述
      const segments = Object.keys(timeDistribution).length;
      const topTopics = topics
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(t => t.topic);
      
      const topTopicsText = topTopics.length > 0 
        ? `主要关注的主题包括: ${topTopics.join('、')}`
        : '没有明确的主题焦点';
      
      return `学习轨迹分析显示，记忆数据可以分为${segments}个时间段。${topTopicsText}。`;
    } catch (error) {
      log(`[cluster_analyzer] 生成轨迹描述时出错: ${error}`, "error");
      return "无法生成学习轨迹描述";
    }
  }

  /**
   * 为Flask API聚类结果生成主题
   * @param clusterResult Flask API的聚类结果
   * @param memories 记忆数组
   * @returns 格式化的聚类主题结果
   */
  async generateTopicsForClusterResult(clusterResult: any, memories: any[]): Promise<ClusterResult> {
    try {
      if (!clusterResult || !clusterResult.centroids || clusterResult.centroids.length === 0) {
        return { topics: [] };
      }
      
      const totalMemories = memories.length;
      const topics: ClusterTopic[] = [];
      
      // 遍历每个聚类
      for (let i = 0; i < clusterResult.centroids.length; i++) {
        const cluster = clusterResult.centroids[i];
        
        // 过滤出该聚类包含的记忆
        const clusterMemoryIds = cluster.points.map((p: any) => p.id);
        const clusterMemories = memories.filter(memory => 
          clusterMemoryIds.includes(memory.id)
        );
        
        if (clusterMemories.length === 0) {
          continue;
        }
        
        // 为该聚类生成主题
        let topic = '';
        
        // 尝试使用Flask API提供的主题名称
        if (clusterResult.topics && clusterResult.topics[i]) {
          topic = clusterResult.topics[i];
        } else {
          // 如果没有提供主题，生成一个
          topic = await this.generateTopicForMemories(clusterMemories);
        }
        
        // 计算该聚类在所有记忆中的占比
        const percentage = Math.round((clusterMemories.length / totalMemories) * 100);
        
        // 找出最有代表性的记忆（简单选择第一个）
        const representativeMemory = clusterMemories[0];
        
        // 转换记忆ID格式
        const memoryIds = clusterMemoryIds.map(id => {
          // 尝试将ID转换为数字（如果不是数字则保持原样）
          const numericId = Number(id);
          return isNaN(numericId) ? id : numericId;
        });
        
        topics.push({
          id: uuidv4(),
          topic: topic || "未分类主题",
          count: clusterMemories.length,
          percentage,
          memoryIds,
          representativeMemory
        });
      }
      
      return { topics };
    } catch (error) {
      log(`[cluster_analyzer] 为Flask API聚类结果生成主题时出错: ${error}`, "error");
      return { topics: [], error: "Topic generation failed" };
    }
  }
}

// 导出服务实例
export const clusterAnalyzer = new ClusterAnalyzerService();