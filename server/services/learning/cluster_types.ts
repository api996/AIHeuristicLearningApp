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

// 聚类结果
export interface ClusterResult {
  centroids: Centroid[];
  topics?: string[];
  error?: string;
}