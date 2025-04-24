/**
 * 学习轨迹系统核心类型定义
 */

/**
 * 记忆对象接口
 * 代表用户学习过程中的一个记忆单元
 */
export interface Memory {
  id: string;         // 记忆唯一标识符
  content: string;    // 记忆内容
  type: string;       // 记忆类型 (chat, query, etc)
  timestamp: string;  // 记忆创建时间
  embedding?: number[]; // 内容的向量表示
  summary?: string;   // 内容摘要
  keywords?: string[]; // 关键词列表
  userId: number;     // 关联的用户ID
}

/**
 * 摘要选项接口
 */
export interface SummarizerOptions {
  model?: string;      // 使用的模型名称
  maxLength?: number;  // 摘要最大长度
  includeKeywords?: boolean; // 是否包含关键词
}

/**
 * 摘要结果接口
 */
export interface SummaryResult {
  summary: string;     // 生成的摘要
  keywords?: string[]; // 提取的关键词
}

/**
 * 聚类选项接口
 */
export interface ClusterOptions {
  maxClusters?: number;    // 最大聚类数量
  minSimilarity?: number;  // 最小相似度阈值
  algorithm?: 'kmeans' | 'dbscan' | 'hierarchical'; // 聚类算法
}

/**
 * 聚类结果接口
 */
export interface Cluster {
  id: string;           // 聚类唯一标识符
  label: string;        // 聚类标签/名称
  centroid: number[];   // 中心向量
  memoryIds: string[];  // 包含的记忆ID列表
  keywords: string[];   // 关键词列表
  summary?: string;     // 聚类内容摘要
}

/**
 * 记忆过滤器接口
 */
export interface MemoryFilter {
  userId?: number;       // 用户ID
  types?: string[];      // 记忆类型列表
  startDate?: Date;      // 开始日期
  endDate?: Date;        // 结束日期
  keywords?: string[];   // 关键词列表
}

/**
 * 相似度检索选项
 */
export interface SimilarityOptions {
  threshold?: number;    // 相似度阈值
  limit?: number;        // 结果数量限制
}

/**
 * 学习轨迹节点接口
 */
export interface TrajectoryNode {
  id: string;           // 节点唯一标识符
  label: string;        // 节点标签/名称
  size: number;         // 节点大小（表示重要性）
  category?: string;    // 节点类别
  clusterId?: string;   // 关联的聚类ID
}

/**
 * 学习轨迹连接接口
 */
export interface TrajectoryLink {
  source: string;       // 源节点ID
  target: string;       // 目标节点ID
  value: number;        // 连接强度
}

/**
 * 学习进度数据接口
 */
export interface ProgressData {
  category: string;     // 学习类别/主题
  score: number;        // 掌握程度得分
  change?: number;      // 相比上次的变化
}

/**
 * 学习路径分析结果接口
 */
export interface LearningPathResult {
  nodes: TrajectoryNode[];   // 知识图谱节点
  links: TrajectoryLink[];   // 知识图谱连接
  progress: ProgressData[];  // 学习进度数据
  suggestions: string[];     // 学习建议
  topics: Array<{            // 主题分布
    topic: string;
    id: string;
    count: number;
    percentage: number;
  }>;
  version?: number;          // 版本号，用于防止客户端缓存
}