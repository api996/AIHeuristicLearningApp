/**
 * 轻量级K-means聚类算法实现
 * 用于记忆向量的高效聚类分析
 */

import { log } from "../../vite";

/**
 * 向量类型定义
 */
type Vector = number[];

/**
 * 聚类结果的数据点
 */
interface ClusterPoint {
  id: string | number;   // 数据点ID
  vector: Vector;        // 向量数据
  clusterId: number;     // 所属聚类ID
  distance?: number;     // 到聚类中心的距离
}

/**
 * 聚类中心
 */
interface Centroid {
  id: number;            // 聚类ID
  vector: Vector;        // 聚类中心向量
  points: ClusterPoint[]; // 属于该聚类的点
}

/**
 * 聚类结果
 */
export interface ClusterResult {
  centroids: Centroid[];    // 聚类中心
  points: ClusterPoint[];   // 所有数据点
  iterations: number;       // 迭代次数
  k: number;                // 聚类数量
}

/**
 * 计算两个向量之间的余弦相似度
 * @param a 向量A
 * @param b 向量B
 * @returns 余弦相似度值 (-1到1之间，1表示完全相似)
 */
function cosineSimilarity(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error("向量维度不匹配");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0; // 避免除以零
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 计算两个向量之间的欧几里得距离
 * @param a 向量A
 * @param b 向量B
 * @returns 欧几里得距离值
 */
function euclideanDistance(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error("向量维度不匹配");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * 计算向量的均值
 * @param vectors 向量数组
 * @returns 均值向量
 */
function calculateMean(vectors: Vector[]): Vector {
  if (vectors.length === 0) {
    throw new Error("无法计算空数组的均值");
  }

  const dimension = vectors[0].length;
  const mean = new Array(dimension).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimension; i++) {
      mean[i] += vector[i];
    }
  }

  for (let i = 0; i < dimension; i++) {
    mean[i] /= vectors.length;
  }

  return mean;
}

/**
 * 检查是否收敛(聚类中心变化很小)
 * @param oldCentroids 旧聚类中心
 * @param newCentroids 新聚类中心
 * @param threshold 收敛阈值
 * @returns 是否已收敛
 */
function hasConverged(oldCentroids: Centroid[], newCentroids: Centroid[], threshold: number = 0.001): boolean {
  for (let i = 0; i < oldCentroids.length; i++) {
    const distance = euclideanDistance(oldCentroids[i].vector, newCentroids[i].vector);
    if (distance > threshold) {
      return false;
    }
  }
  return true;
}

/**
 * 使用K-means++算法选择初始聚类中心
 * @param points 数据点
 * @param k 聚类数量
 * @returns 初始聚类中心
 */
function initializeCentroids(points: ClusterPoint[], k: number): Centroid[] {
  // 防止k大于数据点数量
  k = Math.min(k, points.length);

  // 随机选择第一个中心点
  const centroids: Centroid[] = [];
  const firstCentroidIndex = Math.floor(Math.random() * points.length);
  
  centroids.push({
    id: 0,
    vector: [...points[firstCentroidIndex].vector],
    points: []
  });

  // 选择剩余的中心点
  for (let i = 1; i < k; i++) {
    // 计算每个点到最近中心的距离
    const distances: number[] = [];
    let totalDistance = 0;

    for (const point of points) {
      // 找到该点到任意已有中心的最小距离
      let minDistance = Infinity;
      for (const centroid of centroids) {
        const distance = euclideanDistance(point.vector, centroid.vector);
        minDistance = Math.min(minDistance, distance);
      }
      distances.push(minDistance * minDistance); // 平方距离
      totalDistance += minDistance * minDistance;
    }

    // 按距离概率选择下一个中心
    let random = Math.random() * totalDistance;
    let nextCentroidIndex = 0;
    
    for (let j = 0; j < points.length; j++) {
      random -= distances[j];
      if (random <= 0) {
        nextCentroidIndex = j;
        break;
      }
    }

    centroids.push({
      id: i,
      vector: [...points[nextCentroidIndex].vector],
      points: []
    });
  }

  return centroids;
}

/**
 * K-means聚类算法
 * @param data 要聚类的数据，包含id和向量
 * @param k 聚类数量
 * @param maxIterations 最大迭代次数
 * @param distanceMetric 距离度量方法，默认欧几里得距离
 * @returns 聚类结果
 */
export function kMeansClustering(
  data: { id: string | number; vector: number[] }[],
  k: number = 3,
  maxIterations: number = 100,
  distanceMetric: 'euclidean' | 'cosine' = 'euclidean'
): ClusterResult {
  if (data.length === 0) {
    throw new Error("数据集为空");
  }

  if (k <= 0) {
    throw new Error("聚类数量必须大于0");
  }

  // 调整k，不能大于数据点数量
  k = Math.min(k, data.length);
  
  // 初始化数据点
  const points: ClusterPoint[] = data.map(item => ({
    id: item.id,
    vector: item.vector,
    clusterId: -1,
    distance: Infinity
  }));

  // 选择初始聚类中心
  const centroids = initializeCentroids(points, k);
  let oldCentroids: Centroid[] = [];
  let iterations = 0;

  // K-means迭代
  while (iterations < maxIterations) {
    // 保存旧的聚类中心
    oldCentroids = JSON.parse(JSON.stringify(centroids));
    
    // 清空每个聚类的点集合
    for (const centroid of centroids) {
      centroid.points = [];
    }

    // 分配每个点到最近的聚类
    for (const point of points) {
      let minDistance = Infinity;
      let closestCentroidId = 0;

      for (const centroid of centroids) {
        // 根据选择的距离度量计算距离
        let distance;
        if (distanceMetric === 'cosine') {
          // 余弦距离 = 1 - 余弦相似度，距离越小表示越相似
          distance = 1 - cosineSimilarity(point.vector, centroid.vector);
        } else {
          // 默认使用欧几里得距离
          distance = euclideanDistance(point.vector, centroid.vector);
        }

        if (distance < minDistance) {
          minDistance = distance;
          closestCentroidId = centroid.id;
        }
      }

      // 更新点的聚类分配
      point.clusterId = closestCentroidId;
      point.distance = minDistance;

      // 将点添加到对应聚类
      const centroid = centroids.find(c => c.id === closestCentroidId);
      if (centroid) {
        centroid.points.push(point);
      }
    }

    // 更新聚类中心
    for (const centroid of centroids) {
      if (centroid.points.length > 0) {
        // 计算新的中心点
        centroid.vector = calculateMean(centroid.points.map(p => p.vector));
      }
    }

    // 检查是否收敛
    if (hasConverged(oldCentroids, centroids)) {
      log(`K-means已收敛，迭代次数: ${iterations + 1}`);
      break;
    }

    iterations++;
  }

  return {
    centroids,
    points,
    iterations,
    k
  };
}

/**
 * 确定最佳聚类数量
 * 使用肘部法则(Elbow Method)确定合适的k值
 * @param data 要聚类的数据
 * @param maxK 最大聚类数量
 * @returns 建议的聚类数量
 */
export function findOptimalK(
  data: { id: string | number; vector: number[] }[],
  maxK: number = 10
): number {
  if (data.length <= 2) {
    return data.length;
  }
  
  // 调整maxK不超过数据点数量
  maxK = Math.min(maxK, data.length);
  
  // 计算不同k值的簇内距离平方和
  const distortions: number[] = [];
  
  for (let k = 1; k <= maxK; k++) {
    const result = kMeansClustering(data, k, 50);
    
    // 计算总畸变(所有点到其聚类中心的距离平方和)
    let totalDistortion = 0;
    for (const point of result.points) {
      if (point.distance !== undefined) {
        totalDistortion += point.distance * point.distance;
      }
    }
    
    distortions.push(totalDistortion);
    
    // 提前退出情况: 如果畸变减少非常小，说明找到了拐点
    if (k > 1) {
      const improvement = 1 - (distortions[k-1] / distortions[k-2]);
      if (improvement < 0.1) { // 10%的改进阈值
        return k;
      }
    }
  }
  
  // 找到拐点(第一个导数变化最大的点)
  let optimalK = 2; // 默认至少2个聚类
  let maxSecondDerivative = 0;
  
  for (let k = 1; k < maxK - 1; k++) {
    // 计算二阶导数近似值
    const firstDeriv1 = distortions[k-1] - distortions[k];
    const firstDeriv2 = distortions[k] - distortions[k+1];
    const secondDerivative = firstDeriv1 - firstDeriv2;
    
    if (secondDerivative > maxSecondDerivative) {
      maxSecondDerivative = secondDerivative;
      optimalK = k + 1;
    }
  }
  
  return optimalK;
}

/**
 * 为小数据集提供的简化聚类函数
 * 用于处理小型数据，避免复杂计算
 * @param data 要聚类的数据
 * @returns 聚类结果
 */
export function simpleClustering(
  data: { id: string | number; vector: number[] }[]
): ClusterResult {
  if (data.length <= 3) {
    // 数据量很小时，每个点作为一个聚类
    return {
      centroids: data.map((item, index) => ({
        id: index,
        vector: item.vector,
        points: [{
          id: item.id,
          vector: item.vector,
          clusterId: index,
          distance: 0
        }]
      })),
      points: data.map((item, index) => ({
        id: item.id,
        vector: item.vector,
        clusterId: index,
        distance: 0
      })),
      iterations: 1,
      k: data.length
    };
  }
  
  // 尝试确定最佳k值
  const k = Math.min(findOptimalK(data, 5), Math.max(2, Math.floor(data.length / 2)));
  
  // 执行k-means聚类
  return kMeansClustering(data, k, 20);
}

// 导出默认函数
export default {
  kMeansClustering,
  findOptimalK,
  simpleClustering,
  cosineSimilarity,
  euclideanDistance
};