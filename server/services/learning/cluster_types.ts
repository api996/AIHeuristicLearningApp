/**
 * 聚类服务接口类型定义
 * 为确保Python聚类和JavaScript服务之间类型一致
 */

/**
 * 聚类结果接口
 * 此接口兼容Python聚类服务返回的结果
 */
export interface ClusterResult {
  // 聚类中心数组
  centroids: {
    // 聚类中心向量
    center: number[];
    // 属于该聚类的点
    points: { id: string }[];
  }[];
  // 可选的主题名称数组
  topics?: string[];
}

/**
 * 聚类点接口
 * 用于表示输入的向量数据点
 */
export interface ClusterPoint {
  id: string | number;  // 数据点ID
  vector: number[];     // 向量数据
}

/**
 * 聚类数据结果（扩展格式）
 * 用于在缓存中存储更丰富的信息
 */
export interface ClusterData {
  // 聚类中心
  centroids: {
    centroid: number[];            // 聚类中心向量
    memory_ids: string[];          // 聚类中的记忆ID
    topic: string;                 // 聚类主题
    cluster_id: string;            // 聚类ID
  }[];
  // 聚类数量
  clusterCount: number;
}