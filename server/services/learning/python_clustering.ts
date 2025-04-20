/**
 * Python聚类服务包装器
 * 负责与Python的scikit-learn实现通信，处理高维向量的聚类
 */

import { log } from "../../vite";
import { exec } from "child_process";
import { ClusterResult } from "./kmeans_clustering";

export class PythonClusteringService {
  /**
   * 使用Python的scikit-learn进行高效聚类
   * @param memoryVectors 向量数据，包含id和vector
   * @returns 聚类结果，与TypeScript实现兼容的格式
   */
  async clusterVectors(memoryVectors: { id: string | number; vector: number[] }[]): Promise<ClusterResult> {
    try {
      log(`[python_clustering] 使用Python聚类服务处理${memoryVectors.length}条向量，维度=${memoryVectors[0]?.vector.length || '未知'}`);
      
      // 确保有足够的数据进行聚类
      if (!memoryVectors || memoryVectors.length < 2) {
        log('[python_clustering] 向量数量不足，无法进行聚类', 'warn');
        return this.createEmptyClusterResult();
      }
      
      // 调用Python脚本执行聚类
      const pythonCode = this.generatePythonClusteringCode(memoryVectors);
      
      // 执行Python代码并获取结果
      const result = await this.executePythonCode(pythonCode);
      
      if (!result || result.error) {
        log(`[python_clustering] Python聚类失败: ${result?.error || '未知错误'}`, 'error');
        // 聚类失败时返回空结果，确保上层服务可以继续工作
        return this.createEmptyClusterResult();
      }
      
      // 将Python结果转换为TypeScript格式
      return this.convertToTsFormat(result, memoryVectors);
      
    } catch (error) {
      log(`[python_clustering] 聚类处理错误: ${error}`, 'error');
      return this.createEmptyClusterResult();
    }
  }
  
  /**
   * 生成Python聚类代码
   * @param vectors 向量数据
   * @returns Python代码字符串
   */
  private generatePythonClusteringCode(vectors: { id: string | number; vector: number[] }[]): string {
    // 安全处理向量数据的JSON表示
    const safeVectorsJson = JSON.stringify(vectors)
      .replace(/"/g, '\\"')  // 避免字符串中的引号导致的语法错误
      .replace(/\n/g, ' ');  // 移除换行符
      
    return `
from services.clustering import clustering_service
import asyncio
import json
import sys

async def cluster_data():
    try:
        # 解析输入向量数据
        vectors = json.loads("""${safeVectorsJson}""")
        
        # 使用聚类服务
        result = await clustering_service.cluster_vectors(vectors, use_cosine_distance=True)
        
        # 输出结果
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))

# 运行异步函数
asyncio.run(cluster_data())
`;
  }
  
  /**
   * 执行Python代码
   * @param pythonCode 要执行的Python代码
   * @returns 执行结果
   */
  private async executePythonCode(pythonCode: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = exec('python -c \'' + pythonCode + '\'', {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      let output = '';
      let errorOutput = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          log(`[python_clustering] Python进程异常退出，代码: ${code}, 错误: ${errorOutput}`, 'error');
          resolve({ error: errorOutput || "Python进程异常退出" });
          return;
        }
        
        try {
          // 解析Python输出的JSON
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (error) {
          log(`[python_clustering] 解析Python输出失败: ${error}, 输出: ${output.substring(0, 200)}...`, 'error');
          resolve({ error: "无法解析Python输出" });
        }
      });
      
      process.on('error', (err) => {
        log(`[python_clustering] 执行Python失败: ${err}`, 'error');
        resolve({ error: err.message });
      });
    });
  }
  
  /**
   * 将Python结果转换为TypeScript兼容格式
   * @param pythonResult Python聚类结果
   * @param originalVectors 原始向量数据
   * @returns TypeScript格式的聚类结果
   */
  private convertToTsFormat(pythonResult: any, originalVectors: { id: string | number; vector: number[] }[]): ClusterResult {
    // 如果没有centroids，返回空结果
    if (!pythonResult.centroids || !Array.isArray(pythonResult.centroids)) {
      return this.createEmptyClusterResult();
    }
    
    // 初始化结果对象
    const result: ClusterResult = {
      centroids: [],
      points: [],
      iterations: pythonResult.iterations || 1,
      k: pythonResult.centroids.length
    };
    
    // 创建所有点的副本，以保持与TS实现的格式兼容
    result.points = originalVectors.map(item => ({
      id: item.id,
      vector: item.vector,
      clusterId: -1, // 默认未分配
      distance: Infinity
    }));
    
    // 处理每个聚类中心
    for (const centroid of pythonResult.centroids) {
      const clusterPoints = [];
      
      // 收集属于这个聚类的点
      for (const point of centroid.points || []) {
        const index = point.index;
        const originalPoint = originalVectors[index];
        
        if (originalPoint) {
          // 创建聚类点对象
          const clusterPoint = {
            id: originalPoint.id,
            vector: originalPoint.vector,
            clusterId: centroid.id,
            distance: 0 // 距离未知，设为0
          };
          
          clusterPoints.push(clusterPoint);
          
          // 更新points数组中的聚类分配
          const pointIndex = result.points.findIndex(p => p.id === originalPoint.id);
          if (pointIndex >= 0) {
            result.points[pointIndex].clusterId = centroid.id;
          }
        }
      }
      
      // 添加聚类中心
      result.centroids.push({
        id: centroid.id,
        vector: centroid.vector,
        points: clusterPoints
      });
    }
    
    return result;
  }
  
  /**
   * 创建空的聚类结果
   * 用于处理错误情况
   */
  private createEmptyClusterResult(): ClusterResult {
    return {
      centroids: [],
      points: [],
      iterations: 0,
      k: 0
    };
  }
}

// 导出服务实例
export const pythonClusteringService = new PythonClusteringService();