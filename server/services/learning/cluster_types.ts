/**
 * 聚类类型定义
 */

// 聚类点
export interface ClusterPoint {
  id: string;
}

// 聚类中心
export interface Centroid {
  center: number[];
  points: ClusterPoint[];
}

// 原始聚类数据（Python脚本返回的格式）
export interface RawClusterData {
  centroid: number[];
  memory_ids: string[];
  topic?: string; 
  cluster_id?: string;
  points?: ClusterPoint[];
  [key: string]: any; // 允许其他属性
}

// 聚类结果
export interface ClusterResult {
  centroids: Centroid[];
  topics?: string[];
  raw_clusters?: Record<string, RawClusterData>; // 添加原始聚类数据
  error?: string;
}