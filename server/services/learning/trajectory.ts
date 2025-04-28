/**
 * 学习轨迹服务模块
 * 负责学习路径分析和知识图谱生成
 */

import { spawn } from 'child_process';
import { 
  LearningPathResult, 
  ProgressData, 
  TrajectoryLink, 
  TrajectoryNode,
  Memory,
  Cluster
} from './types';
import { log } from '../../vite';
import { getMemoriesByFilter } from './memoryStore';
import { clusterMemories, calculateTopicRelations } from './cluster';
import { db } from '../../db';
import { memories } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../../storage';

/**
 * 将文件系统格式的记忆ID映射到数据库ID
 * @param fileSystemId 文件系统格式的记忆ID (时间戳格式)
 * @returns 与该记忆对应的数据库ID，如果未找到则返回原ID
 */
async function mapMemoryIdToDbId(fileSystemId: string): Promise<string> {
  try {
    // 查找ID为传入值的内存记录
    const result = await db.select({id: memories.id})
      .from(memories)
      .where(eq(memories.id, fileSystemId))
      .limit(1);
    
    // 如果找到匹配记录，返回该记录的ID
    if (result.length > 0) {
      return result[0].id;
    }
    
    // 如果没有直接匹配，此时需要查找整个内存表
    log(`[trajectory] 未找到记忆直接匹配: ${fileSystemId}, 正在搜索所有内存`);
    
    // 查询最后添加的20条记忆
    const recentMemories = await db.select({id: memories.id})
      .from(memories)
      .limit(20);
    
    const memoryIds = recentMemories.map(m => m.id);
    log(`[trajectory] 最近添加的记忆ID: ${memoryIds.join(', ')}`);
    
    // 无法映射，返回原始ID
    return fileSystemId;
  } catch (error) {
    log(`[trajectory] 映射记忆ID时出错: ${error}`);
    return fileSystemId;
  }
}

/**
 * 分析用户的学习轨迹
 * 
 * @param userId 用户ID
 * @param forceRefresh 是否强制刷新分析结果
 * @returns 学习轨迹分析结果
 */
export async function analyzeLearningPath(userId: number, forceRefresh: boolean = false): Promise<LearningPathResult> {
  try {
    log(`[trajectory] 开始分析用户 ${userId} 的学习轨迹${forceRefresh ? '（强制刷新）' : ''}`);
    
    // 首先尝试从数据库获取现有的学习轨迹
    if (!forceRefresh) {
      try {
        const savedLearningPath = await storage.getLearningPath(userId);
        if (savedLearningPath) {
          log(`[trajectory] 从数据库中找到用户 ${userId} 的学习轨迹数据，版本：${savedLearningPath.version}`);
          
          // 构造返回结果
          const result: LearningPathResult = {
            // 必须提供 topics 和 suggestions，否则会使用默认值
            topics: Array.isArray(savedLearningPath.topics) ? savedLearningPath.topics : [],
            suggestions: Array.isArray(savedLearningPath.suggestions) ? savedLearningPath.suggestions : [],
            progress: [], // 进度数据会根据分布重新构建
            nodes: [],
            links: []
          };
          
          // 如果有主题分布数据，转换为进度数据格式
          if (savedLearningPath.distribution && Array.isArray(savedLearningPath.distribution)) {
            result.progress = savedLearningPath.distribution.map((item: any) => ({
              category: item.topic,
              score: item.percentage,
              change: 0 // 暂无变化数据
            }));
          }
          
          // 如果有知识图谱数据，添加到结果中
          if (savedLearningPath.knowledgeGraph && typeof savedLearningPath.knowledgeGraph === 'object') {
            const graph = savedLearningPath.knowledgeGraph as any;
            if (graph.nodes && Array.isArray(graph.nodes)) {
              result.nodes = graph.nodes;
            }
            if (graph.links && Array.isArray(graph.links)) {
              result.links = graph.links;
            }
          }
          
          // 使用分布数据填充结果对象中的distribution字段（向后兼容用）
          if (savedLearningPath.distribution) {
            // @ts-ignore - 添加额外字段以保持后向兼容性
            result.distribution = savedLearningPath.distribution;
          }
          
          log(`[trajectory] 成功加载用户 ${userId} 的学习轨迹，包含 ${result.topics.length} 个主题和 ${result.suggestions.length} 条建议`);
          return result;
        } else {
          log(`[trajectory] 数据库中未找到用户 ${userId} 的学习轨迹数据，将生成新数据`);
        }
      } catch (dbError) {
        log(`[trajectory] 从数据库获取学习轨迹时出错: ${dbError}，将生成新数据`);
      }
    } else {
      log(`[trajectory] 强制刷新模式，将为用户 ${userId} 生成新的学习轨迹数据`);
    }
    
    // 如果没有找到现有数据，或者需要强制刷新，则生成新数据
    try {
      // 获取集群记忆检索服务实例
      const { memoryService } = await import('./memory_service');
      
      // 直接从缓存源获取聚类数据
      log(`[trajectory] 直接从聚类缓存获取用户 ${userId} 的聚类数据`);
      const clusterResult = await memoryService.getUserClusters(userId, forceRefresh);
      
      if (clusterResult && clusterResult.topics && clusterResult.topics.length > 0) {
        log(`[trajectory] 从聚类缓存获取到 ${clusterResult.topics.length} 个主题聚类`);
        
        // 使用聚类数据生成学习轨迹
        log(`[trajectory] 使用聚类数据生成学习轨迹`);
        const result = await generateLearningPathFromClusters(userId, clusterResult);
        
        // 更新节点和连接
        if (clusterResult.centroids && clusterResult.centroids.length > 0) {
          // 构建知识图谱节点
          const nodes: TrajectoryNode[] = clusterResult.topics.map((topic: any, index: number) => {
            const size = Math.max(10, Math.min(50, 10 + (topic.percentage || 0.1) * 40));
            return {
              id: topic.id || `node_${index}`,
              label: topic.topic || topic.label || "未命名主题",
              size,
              category: `group${index}`,
              clusterId: topic.id
            };
          });
          
          // 构建知识图谱连接
          const links: TrajectoryLink[] = [];
          if (nodes.length > 1) {
            // 找出最大的聚类
            const largestCluster = [...clusterResult.topics].sort((a: any, b: any) => 
              (b.percentage || 0) - (a.percentage || 0)
            )[0];
            
            // 将其他聚类连接到最大聚类
            for (const topic of clusterResult.topics) {
              if (topic.id !== largestCluster.id) {
                links.push({
                  source: largestCluster.id,
                  target: topic.id,
                  value: Math.max(1, Math.min(10, (topic.percentage || 0.1) * 10))
                });
              }
            }
          }
          
          // 使用正确的类型结构
          if (!result.knowledge_graph) {
            result.knowledge_graph = {
              nodes: nodes,
              links: links
            };
          } else {
            result.knowledge_graph.nodes = nodes;
            result.knowledge_graph.links = links;
          }
        }
        
        // 将新生成的轨迹数据保存到数据库
        try {
          if (result && result.topics && result.topics.length > 0) {
            // 准备图谱数据
            const knowledgeGraph = result.knowledge_graph || {
              nodes: [],
              links: []
            };
            
            // 保存到数据库
            await storage.saveLearningPath(
              userId,
              result.topics,
              result.distribution || result.topics, // 使用distribution或回退到topics
              result.suggestions,
              knowledgeGraph
            );
            
            log(`[trajectory] 已将用户 ${userId} 的学习轨迹数据保存到数据库，包含 ${result.topics.length} 个主题`);
          } else {
            log(`[trajectory] 用户 ${userId} 的学习轨迹数据不完整，不保存到数据库`);
          }
        } catch (saveError) {
          log(`[trajectory] 保存学习轨迹数据到数据库时出错: ${saveError}`);
          // 保存失败不影响返回结果
        }
        
        // 添加分布数据（向后兼容）
        if (result.topics && result.topics.length > 0) {
          // @ts-ignore - 添加额外字段以保持后向兼容性
          result.distribution = result.topics;
        }
        
        log(`[trajectory] 使用聚类数据生成的学习轨迹共有 ${result.topics.length} 个主题`);
        return result;
      } else {
        log(`[trajectory] 未获取到有效的聚类数据，将使用备用方法`);
        // 备用方法：使用原始的从记忆生成学习轨迹的方法
        const result = await generateLearningPathFromMemories(userId);
        
        // 添加分布数据（向后兼容）
        if (result.topics && result.topics.length > 0) {
          // @ts-ignore - 添加额外字段以保持后向兼容性
          result.distribution = result.topics;
        }
        
        return result;
      }
    } catch (error) {
      log(`[trajectory] 生成学习轨迹失败: ${error}`);
      // 使用备用方法生成学习轨迹
      const fallbackResult = await getDefaultLearningPath(userId);
      return fallbackResult;
    }
  } catch (error) {
    log(`[trajectory] 分析学习轨迹时遇到错误: ${error}`);
    return generateLearningPathFromMemories(userId);
  }
}

/**
 * 生成个性化学习建议
 * 
 * @param userId 用户ID
 * @param context 上下文信息
 * @param forceRefresh 是否强制刷新建议
 * @returns 学习建议列表
 */
export async function generateSuggestions(
  userId: number,
  context?: string,
  forceRefresh: boolean = false
): Promise<string[]> {
  try {
    // 获取现有的学习轨迹分析，使用相同的forceRefresh参数
    const pathAnalysis = await analyzeLearningPath(userId, forceRefresh);
    
    // 如果分析结果已包含建议，直接返回
    if (pathAnalysis.suggestions && pathAnalysis.suggestions.length > 0) {
      return pathAnalysis.suggestions;
    }
    
    // 如果没有生成建议，尝试基于轨迹生成
    if (pathAnalysis.topics && pathAnalysis.topics.length > 0) {
      try {
        // 如果有主题数据但没有建议，尝试生成建议并更新数据库
        const generatedSuggestions = [
          `深入探索${pathAnalysis.topics[0].topic}主题的更多内容`,
          "尝试将已学知识应用到实际问题中去",
          "探索不同主题之间的关联和联系",
          "回顾已学内容，加深理解和记忆",
          "尝试从不同角度理解复杂概念"
        ];
        
        // 更新数据库中的建议数据
        try {
          const savedPath = await storage.getLearningPath(userId);
          if (savedPath) {
            // 更新建议，确保使用正确的类型
            const topics = Array.isArray(savedPath.topics) ? savedPath.topics : [];
            const distribution = Array.isArray(savedPath.distribution) ? savedPath.distribution : [];
            
            // 从现有图谱数据中获取
            const knowledgeGraph = savedPath.knowledgeGraph ? 
              savedPath.knowledgeGraph : 
              (savedPath as any).knowledge_graph || { nodes: [], links: [] };
            
            await storage.saveLearningPath(
              userId,
              topics,
              distribution,
              generatedSuggestions,
              knowledgeGraph
            );
            log(`[trajectory] 已更新用户 ${userId} 的学习建议`);
          }
        } catch (updateError) {
          log(`[trajectory] 更新学习建议时出错: ${updateError}`);
          // 错误不影响返回结果
        }
        
        return generatedSuggestions;
      } catch (genError) {
        log(`[trajectory] 基于主题生成建议时出错: ${genError}`);
      }
    }
    
    // 否则生成默认建议
    return [
      "继续探索您感兴趣的学习主题",
      "尝试深入了解您最近查询较多的话题",
      "回顾之前学习过的内容以加深理解",
      "考虑在不同领域间建立知识联系",
      "尝试用所学知识解决实际问题"
    ];
  } catch (error) {
    log(`[trajectory] 生成学习建议时遇到错误: ${error}`);
    
    // 返回默认建议
    return [
      "继续探索您感兴趣的学习主题",
      "尝试深入了解您最近查询较多的话题",
      "回顾之前学习过的内容以加深理解",
      "考虑在不同领域间建立知识联系",
      "尝试用所学知识解决实际问题"
    ];
  }
}

/**
 * 基于用户记忆生成学习轨迹（备用方法）
 * 
 * @param userId 用户ID
 * @returns 学习轨迹分析结果
 */
async function generateLearningPathFromMemories(userId: number): Promise<LearningPathResult> {
  try {
    // 获取用户所有记忆
    const memories = await getMemoriesByFilter({ userId });
    
    if (!memories || memories.length === 0) {
      log(`[trajectory] 用户 ${userId} 没有记忆数据，返回默认学习轨迹`);
      return await getDefaultLearningPath(userId);
    }
    
    log(`[trajectory] 为用户 ${userId} 生成学习轨迹，已找到 ${memories.length} 条记忆`);
    
    // 首先尝试从memory-space API获取聚类结果
    let memorySpaceClusters = null;
    
    try {
      // 导入需要的模块
      const memoryService = (await import('../learning/memory_service')).memoryService;
      const { storage } = await import('../../storage');
      
      // 获取所有记忆
      const memoryObjects = memories;
      
      // 获取记忆的向量嵌入
      const memoriesWithEmbeddings = await Promise.all(
        memoryObjects.map(async (memory) => {
          // 直接使用记忆ID，因为所有记忆ID现在都是统一的时间戳格式字符串
          const memoryId = memory.id;
          
          // 使用记忆ID获取向量嵌入
          const embedding = await storage.getEmbeddingByMemoryId(memoryId);
          
          // 记录向量信息用于调试 - 使用安全日志函数
          if (embedding && Array.isArray(embedding.vectorData) && embedding.vectorData.length > 0) {
            const { utils } = await import('../../utils');
            // 只在调试模式下记录详细的向量信息，减少日志输出
            if (process.env.NODE_ENV === 'development' && Math.random() < 0.2) { // 仅记录20%的向量
              log(`[trajectory] 记忆ID ${memoryId} 有有效向量: 长度=${embedding.vectorData.length}, 样本=[${embedding.vectorData.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
            }
          } else {
            const reason = embedding 
              ? (Array.isArray(embedding.vectorData) 
                 ? "向量数组为空" 
                 : `向量数据类型错误: ${typeof embedding.vectorData}`)
              : "未找到向量记录";
            log(`[trajectory] 记忆ID ${memoryId} 未找到有效向量嵌入: ${reason}`);
            
            // 如果ID不是时间戳格式，尝试运行修复脚本
            if (!memoryId.match(/^\d{20}$/)) {
              log(`[trajectory] 警告：记忆ID ${memoryId} 不是标准的时间戳格式，建议运行修复脚本`);
            }
          }
          
          return {
            memory,
            embedding: embedding?.vectorData || null
          };
        })
      );
      
      // 过滤出有向量嵌入的记忆
      const validMemoriesWithEmbeddings = memoriesWithEmbeddings.filter(
        item => item.embedding !== null && item.embedding !== undefined && Array.isArray(item.embedding) && item.embedding.length > 0
      );
      
      log(`[trajectory] 找到 ${memoriesWithEmbeddings.length} 条记忆数据，其中 ${validMemoriesWithEmbeddings.length} 条有有效向量嵌入`);
      
      if (validMemoriesWithEmbeddings.length >= 5) {
        // 转换为聚类分析服务需要的格式
        const validMemories = validMemoriesWithEmbeddings.map(item => item.memory);
        const embeddings = validMemoriesWithEmbeddings.map(item => item.embedding as number[]);
        
        // 执行聚类分析
        // 由于类型不兼容，转换为memory_service需要的格式
        // 我们先做类型转换，确保ID是数字，并且时间戳是Date对象
        const convertedMemories = validMemories.map(m => {
          // 使用原始ID字符串，避免ID转换问题
          // 记忆ID保持原始字符串格式，以确保数据库查询匹配
          const memoryId = m.id; // 保持原始ID格式
          const userIdNum = typeof m.userId === 'string' ? parseInt(m.userId, 10) : (m.userId as unknown as number);
          
          // 确保timestamp和createdAt是Date对象
          let timestamp: Date | null = null;
          try {
            if (m.timestamp) {
              timestamp = typeof m.timestamp === 'string' ? new Date(m.timestamp) : m.timestamp as unknown as Date;
            }
          } catch (e) {
            log(`[trajectory] 解析timestamp失败: ${e}, 原始值: ${m.timestamp}`);
          }
          
          return {
            id: memoryId,
            userId: userIdNum,
            content: m.content,
            type: m.type,
            timestamp: timestamp,
            summary: m.summary || null,
            createdAt: timestamp // 用timestamp替代createdAt
          };
        });
        // 强制类型转换，解决类型不兼容问题
        // 注意：必须使用字符串类型的ID，避免整数转换导致的ID不匹配问题
        const compatibleMemories = convertedMemories as any as { 
          id: string; // 使用字符串ID，避免整数转换问题
          userId: number; 
          content: string; 
          type: string; 
          timestamp: Date | null; 
          summary: string | null; 
          createdAt: Date | null;
        }[];
        // 使用空数组作为embeddings参数，让服务自己检索向量
        const clusterResults = await memoryService.analyzeMemoryClusters(userId, compatibleMemories, []);
        memorySpaceClusters = clusterResults.topics;
        
        log(`[trajectory] 成功从memory_service获取聚类数据: ${memorySpaceClusters.length} 个聚类`);
      } else {
        log(`[trajectory] 用户 ${userId} 的有效向量记忆不足5条，无法使用memory_service聚类`);
      }
    } catch (error) {
      log(`[trajectory] 尝试从memory_service获取聚类时出错: ${error}`);
    }
    
    // 如果从memory-space获取到了聚类结果，使用这些结果
    if (memorySpaceClusters && memorySpaceClusters.length > 0) {
      log(`[trajectory] 使用memory_service提供的聚类结果生成学习轨迹`);
      
      // 使用实际的聚类标签而非通用名称
      // 打印接收到的聚类数据，帮助调试
      log(`[trajectory-debug] 接收到聚类数据: ${JSON.stringify(memorySpaceClusters.map((c: any) => ({ id: c.id, label: c.label, topic: c.topic, keywords: c.keywords?.slice(0, 2) })))}`);
      
      memorySpaceClusters.forEach((cluster: any, index: number) => {
        // 如果cluster有label属性，优先使用，否则使用关键词生成标签
        if (cluster.label && typeof cluster.label === 'string' && cluster.label.trim().length > 0) {
          // 将label值赋给topic属性，确保使用有意义的标签
          cluster.topic = cluster.label;
          log(`[trajectory] 聚类 ${index} 使用标签: ${cluster.label}`);
        } else if (cluster.keywords && Array.isArray(cluster.keywords) && cluster.keywords.length >= 2) {
          // 使用关键词生成标签
          const keywordsLabel = `${cluster.keywords[0]} 与 ${cluster.keywords[1]}`;
          cluster.topic = keywordsLabel;
          log(`[trajectory] 聚类 ${index} 使用关键词生成标签: ${keywordsLabel}`);
        } else if (!/^(主题|集群|Topic|Cluster)\s*\d+$/.test(cluster.topic || '')) {
          // 如果topic不是通用名称，保留现有值
          if (cluster.topic) {
            log(`[trajectory] 聚类 ${index} 使用现有标签: ${cluster.topic}`);
          } else {
            const defaultLabel = `聚类 ${index}`;
            cluster.topic = defaultLabel;
            log(`[trajectory] 聚类 ${index} 没有topic属性，使用默认标签: ${defaultLabel}`);
          }
        } else {
          // 使用更有意义的默认标签
          const meaningfulLabels = [
            "学习笔记", "知识概览", "技术探索", "概念讨论", 
            "问题分析", "编程技术", "数据科学", "学习资料",
            "框架学习", "算法研究", "系统设计", "工具使用"
          ];
          
          // 选择标签，避免重复
          const labelIndex = index % meaningfulLabels.length;
          let defaultLabel = meaningfulLabels[labelIndex];
          
          // 如果索引超出数组长度，添加编号
          if (index >= meaningfulLabels.length) {
            defaultLabel = `${defaultLabel} ${Math.floor(index / meaningfulLabels.length) + 1}`;
          }
          
          cluster.topic = defaultLabel;
          log(`[trajectory] 聚类 ${index} 使用有意义的默认标签: ${defaultLabel}`);
        }
      });
      
      // 构建知识图谱节点
      const nodes: TrajectoryNode[] = memorySpaceClusters.map((cluster: any) => {
        // 计算节点大小（基于百分比）
        const size = Math.max(10, Math.min(50, 10 + cluster.percentage * 0.4));
        
        return {
          id: cluster.id,
          label: cluster.topic, // 使用更新后的topic名称
          size,
          category: '记忆主题', // 这里可以增加分类逻辑
          clusterId: cluster.id
        };
      });
      
      // 构建知识图谱连接 (简单连接最大的节点与其他节点)
      const links: TrajectoryLink[] = [];
      if (memorySpaceClusters.length > 1) {
        // 找出最大的聚类
        const largestCluster = [...memorySpaceClusters].sort((a, b) => b.percentage - a.percentage)[0];
        
        // 将其他聚类连接到最大聚类
        for (const cluster of memorySpaceClusters) {
          if (cluster.id !== largestCluster.id) {
            links.push({
              source: largestCluster.id,
              target: cluster.id,
              value: Math.max(1, Math.min(10, cluster.percentage / 10)) // 缩放到1-10范围
            });
          }
        }
      }
      
      // 生成进度数据
      const progress: ProgressData[] = memorySpaceClusters.map((cluster: any) => {
        return {
          category: cluster.topic,
          score: cluster.percentage,
          change: 0 // 暂无变化数据
        };
      });
      
      // 直接使用聚类作为主题分布
      const topics = memorySpaceClusters.map((cluster: any) => {
        return {
          topic: cluster.topic,
          id: cluster.id,
          count: cluster.count,
          percentage: cluster.percentage
        };
      });
      
      // 根据聚类生成学习建议
      const suggestions = generateSuggestionsFromMemorySpaceClusters(memorySpaceClusters);
      
      return {
        nodes,
        links,
        progress,
        suggestions,
        topics
      };
    }
    
    // 如果没有获取到memory-space聚类结果，返回默认空结果而不是尝试低效的回退方法
    log(`[trajectory] 无法获取聚类数据，返回默认学习轨迹提示。不再使用低效回退方法。`);
    
    // 直接返回默认的空学习轨迹
    return await getDefaultLearningPath(userId);
  } catch (error) {
    log(`[trajectory] 从记忆生成学习轨迹时遇到错误: ${error}`);
    return await getDefaultLearningPath(userId);
  }
}

/**
 * 获取默认的学习轨迹分析结果
 * 
 * @returns 默认学习轨迹
 */
async function getDefaultLearningPath(userId?: number): Promise<LearningPathResult> {
  try {
    // 如果有用户ID，尝试从聚类API获取实际的聚类标签
    if (userId) {
      try {
        // 导入内存服务
        const memoryService = (await import('./memory_service')).memoryService;
        log(`[trajectory] 尝试从聚类API获取用户 ${userId} 的聚类数据`);
        
        // 获取用户的所有记忆
        const memories = await storage.getMemoriesByUserId(userId);
        
        // 如果有足够的记忆，尝试获取聚类
        if (memories && memories.length >= 5) {
          // 获取聚类结果
          const clusterResult = await memoryService.analyzeMemoryClusters(userId, 
            memories as any, []);
          
          if (clusterResult && clusterResult.topics && clusterResult.topics.length > 0) {
            log(`[trajectory] 成功从聚类API获取到 ${clusterResult.topics.length} 个聚类`);
            
            // 构建知识图谱节点
            const nodes: TrajectoryNode[] = clusterResult.topics.map((cluster: any) => {
              // 计算节点大小（基于百分比或默认值）
              const size = cluster.percentage 
                ? Math.max(10, Math.min(50, 10 + cluster.percentage * 0.4))
                : 15;
              
              return {
                id: cluster.id,
                label: cluster.topic || `主题 ${cluster.id}`,
                size,
                category: '记忆主题',
                clusterId: cluster.id
              };
            });
            
            // 构建知识图谱连接
            const links: TrajectoryLink[] = [];
            if (clusterResult.topics.length > 1) {
              // 找出最大的聚类
              const largestCluster = [...clusterResult.topics].sort((a, b) => 
                (b.percentage || 0) - (a.percentage || 0))[0];
              
              // 将其他聚类连接到最大聚类
              for (const cluster of clusterResult.topics) {
                if (cluster.id !== largestCluster.id) {
                  links.push({
                    source: largestCluster.id,
                    target: cluster.id,
                    value: Math.max(1, Math.min(10, (cluster.percentage || 10) / 10))
                  });
                }
              }
            }
            
            // 使用聚类真实标签生成主题
            const topics = clusterResult.topics.map((cluster: any) => {
              return {
                topic: cluster.label || cluster.topic || `集群 ${cluster.id}`,
                id: cluster.id,
                count: cluster.count || 1,
                percentage: cluster.percentage || 10
              };
            });
            
            // 根据聚类生成学习建议
            const suggestions = generateSuggestionsFromMemorySpaceClusters(clusterResult.topics);
            
            // 返回使用实际聚类标签的结果
            return {
              nodes,
              links,
              progress: [],
              suggestions,
              topics
            };
          }
        }
      } catch (apiError) {
        log(`[trajectory] 从聚类API获取数据失败: ${apiError}`);
      }
    }
    
    // 返回空结果，不尝试从少量记忆生成主题
    log(`[trajectory] 不使用默认主题，返回空学习轨迹结果`);
    
    // 我们不再尝试从少量记忆或关键词中推断主题
    // 只有当有足够数据进行有效聚类时才返回结果
    // 这种方式更准确反映了数据状态，避免误导用户
    
    // 不使用默认模板，而是直接反映实际状态
    return {
      topics: [],
      progress: [],
      suggestions: [
        "继续添加更多学习内容以生成个性化学习轨迹",
        "需要至少5条记忆数据才能进行有效的主题聚类分析"
      ],
      nodes: [],
      links: []
    };
  } catch (error) {
    log(`[trajectory] 生成默认学习轨迹时遇到错误: ${error}`);
    
    // 即使出错时也不返回默认值，而是返回空结果
    // 这样前端将显示数据不足的提示，而不是错误的默认数据
    return {
      topics: [],
      progress: [],
      suggestions: [
        "尚未收集到足够的学习数据",
        "请继续探索感兴趣的主题",
        "随着对话的增加，我们将能更好地理解您的学习偏好"
      ],
      nodes: [],
      links: []
    };
  }
}

/**
 * 根据关键词确定主题类别
 * 
 * @param keywords 关键词列表
 * @returns 类别名称
 */
function getCategoryFromKeywords(keywords: string[]): string {
  if (!keywords || keywords.length === 0) {
    return '其他';
  }
  
  // 简单的类别映射
  const categoryKeywords: {[key: string]: string[]} = {
    '语言': ['英语', '语言', '词汇', '语法', 'English', 'language', 'vocabulary', 'grammar'],
    '技术': ['编程', '代码', '开发', '算法', 'code', 'programming', 'development', 'algorithm'],
    '科学': ['物理', '化学', '生物', '科学', 'physics', 'chemistry', 'biology', 'science'],
    '艺术': ['音乐', '绘画', '设计', '艺术', 'music', 'painting', 'design', 'art'],
    '历史': ['历史', '事件', '年代', '人物', 'history', 'event', 'period', 'figure'],
    '数学': ['数学', '计算', '几何', '代数', 'math', 'calculation', 'geometry', 'algebra']
  };
  
  // 计算每个类别的匹配关键词数
  const categoryScores: {[key: string]: number} = {};
  
  for (const [category, catKeywords] of Object.entries(categoryKeywords)) {
    categoryScores[category] = 0;
    
    for (const keyword of keywords) {
      if (catKeywords.some(k => keyword.toLowerCase().includes(k.toLowerCase()))) {
        categoryScores[category]++;
      }
    }
  }
  
  // 找出得分最高的类别
  let maxScore = 0;
  let bestCategory = '其他';
  
  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }
  
  return bestCategory;
}

/**
 * 基于聚类生成学习建议
 * 
 * @param clusters 聚类列表
 * @param memories 记忆列表
 * @returns 学习建议列表
 */
/**
 * 基于memory-space聚类生成深度学习建议
 * 提供个性化、有深度的学习建议和进展分析
 * 
 * @param clusters memory-space聚类结果
 * @returns 学习建议列表
 */
function generateSuggestionsFromMemorySpaceClusters(clusters: any[]): string[] {
  if (!clusters || clusters.length === 0) {
    return [
      "开始探索您感兴趣的学习主题",
      "尝试向AI提问不同领域的问题",
      "通过持续对话加深特定主题的理解"
    ];
  }
  
  log(`[trajectory] 开始生成深度学习建议，聚类数: ${clusters.length}`);
  
  // 按百分比排序聚类
  const sortedClusters = [...clusters].sort(
    (a, b) => b.percentage - a.percentage
  );
  
  const suggestions: string[] = [];
  
  // 知识结构分析
  try {
    // 分析学习广度 (聚类数量)
    const learningBreadth = analyzeLearningBreadth(clusters.length);
    if (learningBreadth) suggestions.push(learningBreadth);
    
    // 分析学习深度 (主要聚类占比)
    if (sortedClusters.length > 0) {
      const topClusterPercentage = sortedClusters[0].percentage;
      const learningDepth = analyzeLearningDepth(topClusterPercentage);
      if (learningDepth) suggestions.push(learningDepth);
    }
  } catch (error) {
    log(`[trajectory] 生成知识结构分析建议时出错: ${error}`);
  }
  
  // 主题特定建议
  try {
    // 基于最大聚类的深度学习建议
    if (sortedClusters.length > 0) {
      const topCluster = sortedClusters[0];
      const mainTopicSuggestion = generateDeepTopicSuggestion(topCluster.topic, 'primary');
      suggestions.push(mainTopicSuggestion);
    }
    
    // 第二大聚类的建议 (如果存在)
    if (sortedClusters.length > 1) {
      const secondCluster = sortedClusters[1];
      const secondaryTopicSuggestion = generateDeepTopicSuggestion(secondCluster.topic, 'secondary');
      suggestions.push(secondaryTopicSuggestion);
    }
    
    // 小聚类的建议 (拓展建议)
    if (sortedClusters.length > 2) {
      const smallCluster = sortedClusters[sortedClusters.length - 1];
      const expandTopicSuggestion = generateDeepTopicSuggestion(smallCluster.topic, 'expand');
      suggestions.push(expandTopicSuggestion);
    }
  } catch (error) {
    log(`[trajectory] 生成主题特定建议时出错: ${error}`);
    
    // 出错时提供基本建议
    if (sortedClusters.length > 0) {
      const topCluster = sortedClusters[0];
      suggestions.push(`深入探索"${topCluster.topic}"主题以加强您的知识基础`);
    }
  }
  
  // 添加知识联系建议
  if (sortedClusters.length >= 2) {
    try {
      // 生成主题之间的关联建议
      const topTwoTopics = [sortedClusters[0].topic, sortedClusters[1].topic];
      const connectionSuggestion = generateConnectionSuggestion(topTwoTopics);
      suggestions.push(connectionSuggestion);
    } catch (error) {
      log(`[trajectory] 生成知识联系建议时出错: ${error}`);
      // 通用的知识联系建议
      suggestions.push("尝试将不同主题的知识联系起来，建立更完整的知识网络");
    }
  } else {
    suggestions.push("探索更多不同领域的知识，以便建立更广泛的知识网络");
  }
  
  // 添加实用学习策略
  const learningStrategies = generateLearningStrategies(clusters.length);
  suggestions.push(learningStrategies);
  
  // 确保至少有5条建议
  if (suggestions.length < 5) {
    suggestions.push("复习已经学习的内容，通过定期回顾加深记忆");
    suggestions.push("实践所学知识，尝试解决相关领域的实际问题");
  }
  
  // 最多返回5条建议
  return suggestions.slice(0, 5);
}

/**
 * 分析学习广度，给出建议
 * @param clusterCount 聚类数量
 * @returns 广度相关建议
 */
function analyzeLearningBreadth(clusterCount: number): string {
  if (clusterCount <= 2) {
    return "考虑探索更多不同的知识领域，拓宽您的知识面";
  } else if (clusterCount >= 7) {
    return "您的学习范围很广，考虑在几个关键领域深入发展，避免知识过于分散";
  }
  return "";
}

/**
 * 分析学习深度，给出建议
 * @param topClusterPercentage 主要聚类占比
 * @returns 深度相关建议
 */
function analyzeLearningDepth(topClusterPercentage: number): string {
  if (topClusterPercentage > 50) {
    return "您在主要领域已有较深入的学习，可以尝试拓展相关联的知识分支";
  } else if (topClusterPercentage < 25) {
    return "建议选择一个最感兴趣的主题进行深入学习，培养专业知识";
  }
  return "";
}

/**
 * 生成具体主题的深度学习建议
 * @param topic 主题名称
 * @param type 建议类型 (primary-主要, secondary-次要, expand-拓展)
 * @returns 主题学习建议
 */
function generateDeepTopicSuggestion(topic: string, type: 'primary' | 'secondary' | 'expand'): string {
  // 主要主题建议模板
  const primaryTemplates = [
    `深入研究"${topic}"的核心概念和基础理论，这一主题占您记忆分布的较大比例`,
    `在"${topic}"领域寻找进阶资源，提升该主要分布领域的学习深度`,
    `探索"${topic}"的最新发展和前沿研究方向，这是您记忆中分布最广的主题`,
    `尝试将"${topic}"的知识应用到实际项目中，这一主题在您的记忆分布中占比最大`
  ];
  
  // 次要主题建议模板
  const secondaryTemplates = [
    `继续发展"${topic}"领域的知识，这占您记忆分布的次要部分`,
    `加强"${topic}"方面的学习，尝试与您记忆分布最广的领域建立联系`,
    `探索"${topic}"中的更多内容，这一主题在您的记忆分布中占有一定比例`
  ];
  
  // 拓展主题建议模板
  const expandTemplates = [
    `适当了解"${topic}"领域的基础知识，这一主题在您的记忆分布中占比较小`,
    `浏览"${topic}"的入门资料，拓展这一在您记忆中分布较少的领域`,
    `关注"${topic}"领域的实际应用案例，这将丰富您记忆分布中较小的部分`
  ];
  
  // 根据类型选择模板
  let templates;
  switch(type) {
    case 'primary':
      templates = primaryTemplates;
      break;
    case 'secondary':
      templates = secondaryTemplates;
      break;
    case 'expand':
      templates = expandTemplates;
      break;
    default:
      templates = primaryTemplates;
  }
  
  // 随机选择一个模板
  const index = Math.floor(Math.random() * templates.length);
  return templates[index];
}

/**
 * 生成知识联系建议
 * @param topics 需要关联的主题列表
 * @returns 知识联系建议
 */
function generateConnectionSuggestion(topics: string[]): string {
  if (topics.length < 2) {
    return "寻找不同知识领域之间的联系，建立整合性思维";
  }
  
  const connectionTemplates = [
    `探索"${topics[0]}"和"${topics[1]}"之间的交叉领域，寻找知识融合点`,
    `尝试用"${topics[0]}"的概念解决"${topics[1]}"中的问题，促进知识迁移`,
    `比较"${topics[0]}"与"${topics[1]}"的方法论差异，加深对两者的理解`,
    `研究"${topics[0]}"和"${topics[1]}"的结合应用场景，创造新的见解`
  ];
  
  const index = Math.floor(Math.random() * connectionTemplates.length);
  return connectionTemplates[index];
}

/**
 * 生成学习策略建议
 * @param clusterCount 聚类数量
 * @returns 学习策略建议
 */
function generateLearningStrategies(clusterCount: number): string {
  // 学习策略模板
  const strategies = [
    "使用费曼技巧：尝试向他人解释所学概念，找出知识空白",
    "建立知识地图：将相关概念可视化连接，找出知识结构",
    "间隔复习：定期回顾过去学习的内容，强化长期记忆",
    "实践应用：通过解决实际问题验证并加深理论理解",
    "主动提问：遇到概念时思考'为什么'和'如何'，培养批判性思维"
  ];
  
  // 根据聚类数量选择不同策略 (简单示例)
  let index = 0;
  if (clusterCount <= 2) {
    // 对于聚类少的用户，建议使用知识地图或主动提问的策略
    index = Math.floor(Math.random() * 2) + 1; // 返回1或2
  } else if (clusterCount >= 5) {
    // 对于聚类多的用户，建议使用费曼技巧或间隔复习策略
    index = Math.floor(Math.random() * 2) * 2; // 返回0或2
  } else {
    // 其他情况随机选择
    index = Math.floor(Math.random() * strategies.length);
  }
  
  return strategies[index];
}

/**
 * 基于聚类生成学习建议
 * 
 * @param clusters 聚类列表
 * @param memories 记忆列表
 * @returns 学习建议列表
 */
function generateSuggestionsFromClusters(clusters: Cluster[], memories: Memory[]): string[] {
  if (!clusters || clusters.length === 0) {
    return [
      "开始探索您感兴趣的学习主题",
      "尝试向AI提问不同领域的问题",
      "通过持续对话加深特定主题的理解"
    ];
  }
  
  // 按记忆数量排序聚类
  const sortedClusters = [...clusters].sort(
    (a, b) => b.memoryIds.length - a.memoryIds.length
  );
  
  // 查找最近的记忆
  const sortedMemories = [...memories].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  const recentMemories = sortedMemories.slice(0, Math.min(5, sortedMemories.length));
  
  // 查找包含最近记忆的聚类
  let recentCluster: Cluster | undefined;
  for (const memory of recentMemories) {
    const cluster = clusters.find(c => c.memoryIds.includes(memory.id));
    if (cluster) {
      recentCluster = cluster;
      break;
    }
  }
  
  const suggestions: string[] = [];
  
  // 基于最大聚类的建议
  if (sortedClusters.length > 0) {
    const topCluster = sortedClusters[0];
    suggestions.push(`深入探索"${topCluster.label}"主题以加强您的知识基础`);
  }
  
  // 基于最近聚类的建议
  if (recentCluster) {
    suggestions.push(`继续学习"${recentCluster.label}"，您最近正在关注这个主题`);
  }
  
  // 小聚类的建议
  if (sortedClusters.length > 2) {
    const smallCluster = sortedClusters[sortedClusters.length - 1];
    suggestions.push(`拓展"${smallCluster.label}"方面的知识，这是您较少涉及的领域`);
  }
  
  // 通用建议
  suggestions.push("尝试将不同主题的知识联系起来，建立更完整的知识网络");
  suggestions.push("回顾之前学习过的内容，巩固已有知识");
  
  return suggestions;
}

/**
 * 生成学习轨迹建议
 * @param topics 主题数据
 * @returns 学习建议列表
 */
async function generateLearningPathSuggestions(topics: any[]): Promise<string[]> {
  if (!topics || topics.length === 0) {
    return [
      "开始探索您感兴趣的学习主题",
      "尝试向AI提问不同领域的问题",
      "通过持续对话加深特定主题的理解"
    ];
  }
  
  // 按百分比排序主题
  const sortedTopics = [...topics].sort(
    (a, b) => (b.percentage || 0) - (a.percentage || 0)
  );
  
  const suggestions: string[] = [];
  
  // 基于最大主题的建议
  if (sortedTopics.length > 0) {
    const topTopic = sortedTopics[0];
    suggestions.push(`深入探索"${topTopic.topic}"主题以加强您的知识基础`);
  }
  
  // 小主题的建议
  if (sortedTopics.length > 2) {
    const smallTopic = sortedTopics[sortedTopics.length - 1];
    suggestions.push(`拓展"${smallTopic.topic}"方面的知识，这是您较少涉及的领域`);
  }
  
  // 通用建议
  suggestions.push("尝试将不同主题的知识联系起来，建立更完整的知识网络");
  suggestions.push("回顾之前学习过的内容，巩固已有知识");
  
  return suggestions;
}

/**
 * 生成简化的知识图谱
 * @param topics 主题数据
 * @param userId 用户ID
 * @returns 知识图谱数据
 */
async function generateSimplifiedKnowledgeGraph(topics: any[], userId: number): Promise<any> {
  // 如果主题太少，返回空图谱
  if (!topics || topics.length <= 1) {
    return {
      nodes: [],
      links: []
    };
  }
  
  // 创建节点
  const nodes = topics.map((topic, index) => ({
    id: topic.id || `topic_${index}`,
    name: topic.topic || "未命名主题",
    value: topic.percentage || 1,
    group: index % 5 // 简单分组
  }));
  
  // 创建连接 - 简化处理，所有主题都与第一个主题相连
  const links = topics.slice(1).map((topic, index) => ({
    source: topics[0].id || `topic_0`,
    target: topic.id || `topic_${index + 1}`,
    value: 1,
    type: "related"
  }));
  
  // 添加一些额外的连接，使图谱更丰富
  if (topics.length > 2) {
    for (let i = 1; i < topics.length - 1; i++) {
      links.push({
        source: topics[i].id || `topic_${i}`,
        target: topics[i + 1].id || `topic_${i + 1}`,
        value: 0.7,
        type: "related"
      });
    }
  }
  
  // 返回图谱数据
  return {
    nodes,
    links
  };
}

/**
 * 从现有的聚类结果生成学习轨迹
 * 这个特殊函数用于在外部生成聚类后，直接将其应用到学习轨迹中
 */
export async function generateLearningPathFromClusters(userId: number, clusterResult: any): Promise<LearningPathResult> {
  try {
    log(`[trajectory] 正在从现有聚类为用户 ${userId} 生成学习轨迹`);
    
    // 确认数据格式
    if (!clusterResult || !clusterResult.topics || !Array.isArray(clusterResult.topics)) {
      throw new Error("无效的聚类数据格式");
    }
    
    // 准备主题分布数据
    const topics = clusterResult.topics.map((topic: any) => ({
      id: topic.id || `topic_${Math.random().toString(36).slice(2, 7)}`,
      topic: topic.topic || "未命名主题",
      percentage: topic.percentage || 0,
      count: topic.count || 0,
      memories: topic.memories || []
    }));
    
    // 转换为分布格式
    const distribution = topics.map((topic: any) => ({
      id: topic.id,
      name: topic.topic,
      percentage: topic.percentage
    }));
    
    // 生成学习建议
    const suggestions = await generateLearningPathSuggestions(topics);
    
    // 生成知识图谱 - 可选，如果性能有问题可以考虑暂时关闭
    let knowledgeGraph = null;
    try {
      // 基于主题生成简化的知识图谱
      knowledgeGraph = await generateSimplifiedKnowledgeGraph(topics, userId);
    } catch (graphError) {
      log(`[trajectory] 生成知识图谱时出错: ${graphError}`);
    }
    
    // 构建最终结果
    const result: LearningPathResult = {
      topics,
      distribution,
      suggestions,
      knowledge_graph: knowledgeGraph
    };
    
    // 保存到数据库
    await storage.saveLearningPath(
      userId,
      topics,
      distribution,
      suggestions,
      knowledgeGraph
    );
    
    return result;
  } catch (error) {
    log(`[trajectory] 从聚类生成学习轨迹错误: ${error}`);
    throw error;
  }
}