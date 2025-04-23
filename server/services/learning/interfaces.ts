/**
 * 聚类服务接口定义
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
export interface IClusterResult {
  centroids: Centroid[];
  topics: string[];
}

// 聚类服务接口
export interface IClusteringService {
  clusterVectors(memoryIds: string[], vectors: number[][]): Promise<IClusterResult | null>;
  shutdown?(): void;
}