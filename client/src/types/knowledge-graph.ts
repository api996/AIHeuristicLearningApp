/**
 * 知识图谱数据类型定义
 */

// 知识图谱节点类型
export interface GraphNode {
  id: string;
  label: string;
  size: number;
  category?: 'cluster' | 'keyword' | 'memory' | string;
  color?: string;
  x?: number;
  y?: number;
}

// 知识图谱连接类型
export interface GraphLink {
  source: string;
  target: string;
  value?: number;
  color?: string;
  strokeWidth?: number;
}

// 知识图谱数据结构
export interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  version?: number;
}

// 知识图谱缓存项
export interface KnowledgeGraphCacheItem {
  data: KnowledgeGraphData;
  timestamp: number;
  isLoading: boolean;
  loadPromise: Promise<KnowledgeGraphData> | null;
}