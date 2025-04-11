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
      return getDefaultLearningPath();
    }
    
    // 对记忆进行聚类
    const clusters = await clusterMemories(memories);
    
    if (!clusters || clusters.length === 0) {
      log(`[trajectory] 用户 ${userId} 的记忆无法聚类，返回默认学习轨迹`);
      return getDefaultLearningPath();
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
    return getDefaultLearningPath();
  }
}

/**
 * 获取默认的学习轨迹分析结果
 * 
 * @returns 默认学习轨迹
 */
function getDefaultLearningPath(): LearningPathResult {
  return {
    topics: [
      {topic: "英语学习", id: "topic_english", count: 1, percentage: 30},
      {topic: "编程技术", id: "topic_programming", count: 1, percentage: 20},
      {topic: "科学知识", id: "topic_science", count: 1, percentage: 15}
    ],
    progress: [
      {category: "英语学习", score: 30, change: 0},
      {category: "编程技术", score: 20, change: 0},
      {category: "科学知识", score: 15, change: 0}
    ],
    suggestions: [
      "继续提问感兴趣的学习话题",
      "探索英语学习的不同维度",
      "尝试询问编程或科学方面的问题"
    ],
    nodes: [
      {id: "topic_english", label: "英语学习", size: 30, category: "语言"},
      {id: "topic_programming", label: "编程技术", size: 20, category: "技术"},
      {id: "topic_science", label: "科学知识", size: 15, category: "科学"}
    ],
    links: [
      {source: "topic_english", target: "topic_programming", value: 3},
      {source: "topic_english", target: "topic_science", value: 2},
      {source: "topic_programming", target: "topic_science", value: 5}
    ]
  };
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