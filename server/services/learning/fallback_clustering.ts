/**
 * 备用聚类处理服务
 * 当Python聚类服务不可用时，在Node.js中直接处理聚类
 */

import { log } from './utils';

/**
 * K-Means聚类算法的简化实现
 * 专为高维向量设计
 * @param vectors 向量数组
 * @param k 聚类数量
 * @param iterations 最大迭代次数
 * @returns 聚类结果
 */
export function kMeansClustering(
  memoryIds: string[],
  vectors: number[][],
  k: number = Math.min(5, Math.max(2, Math.floor(vectors.length / 3))),
  iterations: number = 10
): { clusters: number[], centroids: number[][] } {
  const n = vectors.length;
  const dimensions = vectors[0].length;
  
  // 如果向量数量太少，无法进行聚类
  if (n < k) {
    log(`[fallback_clustering] 向量数量(${n})小于聚类数量(${k})，无法进行聚类`, 'warn');
    
    // 每个向量分配到单独的聚类
    const clusters = Array.from({ length: n }, (_, i) => i);
    
    // 每个聚类的中心就是对应的向量
    const centroids = [...vectors];
    
    return { clusters, centroids };
  }
  
  log(`[fallback_clustering] 开始K-Means聚类，${n}条数据，向量维度: ${dimensions}，聚类数量: ${k}`, 'info');
  
  // 随机初始化聚类中心
  const centroids: number[][] = [];
  const used: Set<number> = new Set();
  
  for (let i = 0; i < k; i++) {
    // 确保不重复选择向量作为中心
    let randIndex;
    do {
      randIndex = Math.floor(Math.random() * n);
    } while (used.has(randIndex));
    
    used.add(randIndex);
    centroids.push([...vectors[randIndex]]);
  }
  
  // 记录每个点属于哪个聚类
  let clusters = new Array(n).fill(0);
  let hasChanged = true;
  let iteration = 0;
  
  // 如果还有变化且未超过最大迭代次数则继续
  while (hasChanged && iteration < iterations) {
    hasChanged = false;
    iteration++;
    
    // 为每个点找到最近的中心
    for (let i = 0; i < n; i++) {
      const vector = vectors[i];
      let minDistance = Infinity;
      let closestCluster = 0;
      
      // 计算到各中心的距离
      for (let j = 0; j < k; j++) {
        const distance = euclideanDistance(vector, centroids[j]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = j;
        }
      }
      
      // 如果聚类发生变化，标记有变化
      if (clusters[i] !== closestCluster) {
        clusters[i] = closestCluster;
        hasChanged = true;
      }
    }
    
    // 如果没有变化，提前结束
    if (!hasChanged) break;
    
    // 重新计算聚类中心
    const newCentroids: number[][] = Array.from({ length: k }, () => 
      new Array(dimensions).fill(0)
    );
    
    const counts = new Array(k).fill(0);
    
    // 累加每个聚类中的向量
    for (let i = 0; i < n; i++) {
      const cluster = clusters[i];
      const vector = vectors[i];
      
      for (let d = 0; d < dimensions; d++) {
        newCentroids[cluster][d] += vector[d];
      }
      
      counts[cluster]++;
    }
    
    // 计算平均值，更新中心点
    for (let j = 0; j < k; j++) {
      // 避免除以零
      if (counts[j] === 0) continue;
      
      for (let d = 0; d < dimensions; d++) {
        newCentroids[j][d] /= counts[j];
      }
    }
    
    // 更新中心点
    for (let j = 0; j < k; j++) {
      // 如果这个聚类没有点，保持原样
      if (counts[j] > 0) {
        centroids[j] = newCentroids[j];
      }
    }
  }
  
  log(`[fallback_clustering] K-Means聚类完成，迭代${iteration}次`, 'info');
  
  // 为了与Python API输出兼容，进行格式转换
  return {
    clusters,
    centroids
  };
}

/**
 * 计算欧几里得距离
 * @param a 向量A
 * @param b 向量B
 * @returns 距离值
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * 处理记忆向量聚类
 * @param memoryIds 记忆ID数组
 * @param vectors 向量数组
 * @returns 聚类结果对象，格式与Python API兼容
 */
export async function processClustering(memoryIds: string[], vectors: number[][]): Promise<any> {
  try {
    // 根据向量数量动态确定聚类数量
    const clusterCount = Math.min(5, Math.max(2, Math.floor(vectors.length / 3)));
    log(`[fallback_clustering] 使用备用聚类方法处理${vectors.length}个向量，聚类数: ${clusterCount}`, 'info');
    
    // 应用K-Means聚类
    const { clusters, centroids } = kMeansClustering(memoryIds, vectors, clusterCount);
    
    // 分析聚类结果，计算每个聚类的大小
    const clusterSizes = new Array(clusterCount).fill(0);
    for (const cluster of clusters) {
      clusterSizes[cluster]++;
    }
    
    // 创建聚类标题
    const clusterTopics = centroids.map((_, i) => `主题${i + 1}`);
    
    // 构建API兼容的结果对象
    const result = {
      clusters: clusters,
      centroids: centroids,
      memoryIds: memoryIds,
      clusterTopics: clusterTopics,
      clusterSizes: clusterSizes,
      clusterCount: clusterCount
    };
    
    log(`[fallback_clustering] 聚类结果: ${clusterCount}个聚类`, 'info');
    return result;
  } catch (error) {
    log(`[fallback_clustering] 聚类处理出错: ${error}`, 'error');
    throw error;
  }
}

export default {
  processClustering
};