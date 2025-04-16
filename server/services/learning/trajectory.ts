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

/**
 * 分析用户的学习轨迹
 * 
 * @param userId 用户ID
 * @returns 学习轨迹分析结果
 */
export async function analyzeLearningPath(userId: number): Promise<LearningPathResult> {
  try {
    log(`[trajectory] 开始分析用户 ${userId} 的学习轨迹`);
    
    // 调用Python服务分析学习轨迹
    const pythonProcess = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def analyze_path():
    # 分析学习轨迹
    result = await learning_memory_service.analyze_learning_path(${userId})
    # 转换为JSON输出
    print(json.dumps(result, ensure_ascii=False))

asyncio.run(analyze_path())
    `]);
    
    let output = '';
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          log(`[trajectory] 分析学习轨迹失败，Python进程退出码: ${code}`);
          // 使用备用方法生成学习轨迹
          const fallbackResult = await generateLearningPathFromMemories(userId);
          resolve(fallbackResult);
        } else {
          try {
            const result = JSON.parse(output.trim());
            log(`[trajectory] 成功获取学习轨迹分析结果，包含 ${result.topics?.length || 0} 个主题`);
            
            // 转换Python返回的结果为我们的LearningPathResult接口
            const formattedResult: LearningPathResult = {
              nodes: [],
              links: [],
              progress: [],
              suggestions: result.suggestions || [],
              topics: result.topics || []
            };
            
            // 处理进度数据
            if (result.progress) {
              formattedResult.progress = result.progress.map((p: any) => ({
                category: p.topic,
                score: p.percentage,
                change: p.change || 0
              }));
            }
            
            // 处理知识图谱
            if (result.knowledge_graph) {
              formattedResult.nodes = result.knowledge_graph.nodes || [];
              formattedResult.links = result.knowledge_graph.links || [];
            }
            
            resolve(formattedResult);
          } catch (error) {
            log(`[trajectory] 解析学习轨迹结果失败: ${error}`);
            // 使用备用方法生成学习轨迹
            const fallbackResult = await generateLearningPathFromMemories(userId);
            resolve(fallbackResult);
          }
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        log(`[trajectory] Python错误: ${data}`);
      });
      
      pythonProcess.on('error', async (error) => {
        log(`[trajectory] 启动Python进程失败: ${error}`);
        // 使用备用方法生成学习轨迹
        const fallbackResult = await generateLearningPathFromMemories(userId);
        resolve(fallbackResult);
      });
    });
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
      const { memoryService } = await import('../learning/memory_service');
      const { storage } = await import('../../storage');
      
      // 获取所有记忆
      const memoryObjects = memories;
      
      // 获取记忆的向量嵌入
      const memoriesWithEmbeddings = await Promise.all(
        memoryObjects.map(async (memory) => {
          const memoryId = typeof memory.id === 'string' ? parseInt(memory.id, 10) : memory.id;
          const embedding = await storage.getEmbeddingByMemoryId(memoryId);
          return {
            memory,
            embedding: embedding?.vectorData || null
          };
        })
      );
      
      // 过滤出有向量嵌入的记忆
      const validMemoriesWithEmbeddings = memoriesWithEmbeddings.filter(
        item => item.embedding !== null
      );
      
      if (validMemoriesWithEmbeddings.length >= 5) {
        // 转换为聚类分析服务需要的格式
        const validMemories = validMemoriesWithEmbeddings.map(item => item.memory);
        const embeddings = validMemoriesWithEmbeddings.map(item => item.embedding as number[]);
        
        // 执行聚类分析
        // 由于类型不兼容，转换为memory_service需要的格式
        // 我们先做类型转换，确保ID是数字，并且时间戳是Date对象
        const convertedMemories = validMemories.map(m => {
          // 确保ID是数字
          const memoryId = typeof m.id === 'string' ? parseInt(m.id, 10) : (m.id as unknown as number);
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
        const compatibleMemories = convertedMemories as any as { 
          id: number; 
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
    
    // 如果没有获取到memory-space聚类结果，回退到旧方法
    log(`[trajectory] 回退到传统聚类方法生成学习轨迹`);
    
    // 对记忆进行聚类
    const clusters = await clusterMemories(memories);
    
    if (!clusters || clusters.length === 0) {
      log(`[trajectory] 用户 ${userId} 的记忆无法聚类，返回默认学习轨迹`);
      return await getDefaultLearningPath(userId);
    }
    
    // 计算主题之间的关系
    const relations = calculateTopicRelations(clusters);
    
    // 构建知识图谱节点
    const nodes: TrajectoryNode[] = clusters.map((cluster, index) => {
      // 计算节点大小（基于包含的记忆数量）
      const size = Math.max(10, Math.min(50, 10 + cluster.memoryIds.length * 5));
      
      return {
        id: cluster.id,
        label: cluster.label || `主题 ${index + 1}`,
        size,
        category: getCategoryFromKeywords(cluster.keywords),
        clusterId: cluster.id
      };
    });
    
    // 构建知识图谱连接
    const links: TrajectoryLink[] = relations.map(relation => ({
      source: relation.source,
      target: relation.target,
      value: Math.max(1, Math.min(10, relation.strength * 10)) // 缩放到 1-10 的范围
    }));
    
    // 生成进度数据
    const progress: ProgressData[] = clusters.map(cluster => {
      // 计算主题掌握程度（基于记忆数量和时间分布）
      const score = Math.min(100, 20 + cluster.memoryIds.length * 5);
      
      return {
        category: cluster.label || '',
        score,
        change: 0 // 暂无变化数据
      };
    });
    
    // 生成主题分布
    const topics = clusters.map((cluster, index) => {
      const count = cluster.memoryIds.length;
      const totalMemories = memories.length;
      const percentage = Math.round((count / totalMemories) * 100);
      
      return {
        topic: cluster.label || `主题 ${index + 1}`,
        id: cluster.id,
        count,
        percentage
      };
    });
    
    // 生成学习建议
    const suggestions = generateSuggestionsFromClusters(clusters, memories);
    
    return {
      nodes,
      links,
      progress,
      suggestions,
      topics
    };
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