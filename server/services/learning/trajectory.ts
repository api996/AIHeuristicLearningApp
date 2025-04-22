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
 * @returns 学习轨迹分析结果
 */
export async function analyzeLearningPath(userId: number): Promise<LearningPathResult> {
  try {
    log(`[trajectory] 开始分析用户 ${userId} 的学习轨迹`);
    
    // 直接使用JavaScript实现，不再尝试调用Python服务
    try {
      // 使用备用方法生成学习轨迹
      log(`[trajectory] 直接使用JS生成学习轨迹，不再调用Python服务`);
      const result = await generateLearningPathFromMemories(userId);
      return result;
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
 * @returns 学习建议列表
 */
export async function generateSuggestions(
  userId: number,
  context?: string
): Promise<string[]> {
  try {
    // 获取现有的学习轨迹分析
    const pathAnalysis = await analyzeLearningPath(userId);
    
    // 如果分析结果已包含建议，直接返回
    if (pathAnalysis.suggestions && pathAnalysis.suggestions.length > 0) {
      return pathAnalysis.suggestions;
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
          
          // 记录向量信息用于调试
          if (embedding && Array.isArray(embedding.vectorData) && embedding.vectorData.length > 0) {
            const vectorLength = embedding.vectorData.length;
            const sample = embedding.vectorData.slice(0, 3).map(v => v.toFixed(4)).join(', ');
            log(`[trajectory] 记忆ID ${memoryId} 有有效向量: 长度=${vectorLength}, 样本=[${sample}...]`);
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
        const clusterResults = await memoryService.analyzeMemoryClusters(userId, compatibleMemories, embeddings);
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
      
      // 构建知识图谱节点
      const nodes: TrajectoryNode[] = memorySpaceClusters.map((cluster: any) => {
        // 计算节点大小（基于百分比）
        const size = Math.max(10, Math.min(50, 10 + cluster.percentage * 0.4));
        
        return {
          id: cluster.id,
          label: cluster.topic,
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
 * 基于memory-space聚类生成学习建议
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
  
  // 按百分比排序聚类
  const sortedClusters = [...clusters].sort(
    (a, b) => b.percentage - a.percentage
  );
  
  const suggestions: string[] = [];
  
  // 基于最大聚类的建议
  if (sortedClusters.length > 0) {
    const topCluster = sortedClusters[0];
    suggestions.push(`深入探索"${topCluster.topic}"主题以加强您的知识基础`);
  }
  
  // 第二大聚类的建议
  if (sortedClusters.length > 1) {
    const secondCluster = sortedClusters[1];
    suggestions.push(`继续学习"${secondCluster.topic}"，这是您的重要学习方向之一`);
  }
  
  // 小聚类的建议
  if (sortedClusters.length > 2) {
    const smallCluster = sortedClusters[sortedClusters.length - 1];
    suggestions.push(`拓展"${smallCluster.topic}"方面的知识，这是您较少涉及的领域`);
  }
  
  // 通用建议
  suggestions.push("尝试将不同主题的知识联系起来，建立更完整的知识网络");
  suggestions.push("回顾之前学习过的内容，巩固已有知识");
  
  return suggestions;
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