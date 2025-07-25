/**
 * Python聚类服务接口
 * 提供TypeScript对Python聚类服务的调用
 */

import { log } from "../../vite";
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { ClusterPoint, ClusterResult } from './cluster_types';

// 确保VectorData的id属性只允许字符串
export interface VectorData {
  id: string;
  vector: number[];
}

/**
 * Python聚类服务
 * 通过子进程调用Python脚本执行向量聚类
 */
class PythonClusteringService {
  /**
   * 聚类向量数据
   * @param vectors 向量数据数组
   * @returns 聚类结果
   */
  async clusterVectors(vectors: VectorData[]): Promise<ClusterResult> {
    try {
      if (!vectors || vectors.length === 0) {
        log(`[PythonClustering] 无法对空向量数组进行聚类`, "warn");
        return { centroids: [] };
      }
      
      // 获取向量维度
      const vectorDimension = vectors[0].vector.length;
      log(`[PythonClustering] 开始聚类分析，向量数量=${vectors.length}，维度=${vectorDimension}`);
      
      // 创建临时文件
      const tempId = uuidv4();
      const tempDir = path.join(process.cwd(), 'tmp');
      
      // 确保临时目录存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        // 设置权限确保可写
        try {
          fs.chmodSync(tempDir, 0o777);
        } catch (err) {
          log(`[PythonClustering] 设置tmp目录权限失败: ${err}`, "warn");
        }
      }
      
      const inputFilePath = path.join(tempDir, `vectors_${tempId}.json`);
      const outputFilePath = path.join(tempDir, `clusters_${tempId}.json`);
      
      // 将向量数据写入临时文件
      fs.writeFileSync(inputFilePath, JSON.stringify(vectors));
      
      // 确保文件权限正确
      try {
        fs.chmodSync(inputFilePath, 0o666);
      } catch (err) {
        log(`[PythonClustering] 设置输入文件权限失败: ${err}`, "warn");
      }
      
      // 执行Python聚类
      const result = await this.executePythonClustering(inputFilePath, outputFilePath, vectors.length);
      
      // 清理临时文件
      this.cleanupTempFiles(inputFilePath, outputFilePath);
      
      return result;
    } catch (error) {
      log(`[PythonClustering] 聚类分析出错: ${error}`, "error");
      return { centroids: [] };
    }
  }
  
  /**
   * 执行Python聚类脚本
   * @param inputFilePath 输入文件路径
   * @param outputFilePath 输出文件路径
   * @param vectorCount 向量数量
   * @returns 聚类结果
   */
  private async executePythonClustering(
    inputFilePath: string, 
    outputFilePath: string,
    vectorCount: number
  ): Promise<ClusterResult> {
    return new Promise((resolve, reject) => {
      // 构造Python代码
      const pythonCode = `
import sys
import json
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from pathlib import Path

def determine_optimal_clusters(vectors, max_clusters=40):
    """根据向量数量动态调整聚类中心数量，确保产生多样化的结果"""
    n_samples = len(vectors)
    
    # 如果样本数量太少，确保至少有最小聚类数
    if n_samples < 10:
        return min(3, n_samples)
    
    # 强制至少使用25个聚类中心（测试用，可以在实际情况中移除这个硬编码值）
    # 如果向量数量足够多
    if n_samples >= 100:
        forced_min_clusters = 25
        print(f"强制使用至少 {forced_min_clusters} 个聚类中心")
        
        # 在高向量数量情况下，进一步增加聚类中心数
        # 根据数据量大小，聚类中心数量设置在总数的1/8到1/5之间
        if n_samples > 200:
            dynamic_clusters = n_samples // 8
        else:
            dynamic_clusters = n_samples // 10
            
        # 取强制最小值和动态计算值的较大者
        initial_clusters = max(forced_min_clusters, dynamic_clusters)
    else:
        # 小数据集情况
        initial_clusters = max(8, n_samples // 5)
    
    # 确保聚类数不超过样本数的一半
    initial_clusters = min(initial_clusters, n_samples // 2)
    
    # 记录决策过程
    print(f"样本数量: {n_samples}, 计算得到的聚类数: {initial_clusters}")
    
    # 设置绝对最小聚类数阈值，确保图谱不会太稀疏
    absolute_min_clusters = 15
    if initial_clusters < absolute_min_clusters and n_samples >= absolute_min_clusters * 2:
        print(f"将聚类数从 {initial_clusters} 调整到最小值 {absolute_min_clusters}")
        initial_clusters = absolute_min_clusters
    
    # 返回计算得到的聚类数
    return initial_clusters

def main():
    try:
        # 加载向量数据
        with open("${inputFilePath}", "r") as f:
            vector_data = json.load(f)
        
        if not vector_data or len(vector_data) < 2:
            # 数据不足，返回空结果
            with open("${outputFilePath}", "w") as f:
                json.dump({"centroids": []}, f)
            return
        
        # 提取向量和ID
        ids = [item["id"] for item in vector_data]
        vectors = np.array([item["vector"] for item in vector_data])
        
        # 确定最佳聚类数量
        n_clusters = determine_optimal_clusters(vectors, max_clusters=min(40, len(vectors) // 2))
        print(f"使用最佳聚类数量: {n_clusters}")
        
        # 执行KMeans聚类
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(vectors)
        centers = kmeans.cluster_centers_
        
        # 构建结果
        result = {"centroids": []}
        
        for i in range(n_clusters):
            # 找出属于该聚类的所有向量
            cluster_indices = np.where(labels == i)[0]
            cluster_ids = [ids[idx] for idx in cluster_indices]
            
            # 添加到结果中
            result["centroids"].append({
                "center": centers[i].tolist(),
                "points": [{"id": id} for id in cluster_ids],
                "cluster_id": str(i)
            })
        
        # 将结果转换为与API兼容的格式
        formatted_result = {}
        for i, centroid in enumerate(result["centroids"]):
            formatted_result[str(i)] = {
                "centroid": centroid["center"], 
                "memory_ids": [point["id"] for point in centroid["points"]],
                "topic": f"主题 {i}",
                "cluster_id": centroid.get("cluster_id", str(i))
            }
            print(f"聚类 {i}: {len(formatted_result[str(i)]['memory_ids'])} 个记忆")
        
        # 打印结果结构
        print(f"输出格式化结果，包含 {len(formatted_result)} 个聚类")
        
        # 保存格式化后的结果
        with open("${outputFilePath}", "w") as f:
            json.dump(formatted_result, f)
        
    except Exception as e:
        print(f"聚类分析出错: {str(e)}", file=sys.stderr)
        # 创建空结果
        with open("${outputFilePath}", "w") as f:
            json.dump({"centroids": []}, f)

if __name__ == "__main__":
    main()
      `;
      
      // 执行Python代码 - 使用python3确保在Replit环境中正确执行
      const pythonProcess = spawn('python3', ['-c', pythonCode]);
      
      let stdoutData = '';
      let stderrData = '';
      
      // 收集标准输出
      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      // 收集标准错误
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        log(`[PythonClustering] Python错误: ${data.toString()}`, "warn");
      });
      
      // 处理进程退出
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`[PythonClustering] Python进程异常退出(${code}): ${stderrData}`, "error");
        }
        
        try {
          // 读取输出文件
          if (fs.existsSync(outputFilePath)) {
            const outputData = fs.readFileSync(outputFilePath, 'utf8');
            
            try {
              const result = JSON.parse(outputData);
              
              // 检查结果格式
              if (Object.keys(result).length === 0) {
                resolve({ centroids: [] });
              } else {
                // 将对象格式转换为数组格式
                const centroids = Object.entries(result).map(([clusterId, data]: [string, any]) => {
                  return {
                    center: data.centroid || [],
                    points: (data.memory_ids || []).map((id: string) => ({ id }))
                  };
                });
                
                resolve({ 
                  centroids,
                  topics: Object.values(result).map((c: any) => c.topic || `未命名主题`)
                });
              }
            } catch (parseError) {
              log(`[PythonClustering] 解析JSON输出失败: ${parseError}`, "error");
              reject(parseError);
            }
          } else {
            log(`[PythonClustering] 输出文件不存在: ${outputFilePath}`, "error");
            reject(new Error(`Output file does not exist: ${outputFilePath}`));
          }
        } catch (readError) {
          log(`[PythonClustering] 读取输出文件失败: ${readError}`, "error");
          reject(readError);
        }
      });
      
      // 处理进程错误
      pythonProcess.on('error', (error) => {
        log(`[PythonClustering] 启动Python进程失败: ${error}`, "error");
        reject(error);
      });
    });
  }
  
  /**
   * 清理临时文件
   * @param inputFilePath 输入文件路径
   * @param outputFilePath 输出文件路径
   */
  private cleanupTempFiles(inputFilePath: string, outputFilePath: string): void {
    try {
      // 删除输入文件
      if (fs.existsSync(inputFilePath)) {
        fs.unlinkSync(inputFilePath);
      }
      
      // 删除输出文件
      if (fs.existsSync(outputFilePath)) {
        fs.unlinkSync(outputFilePath);
      }
    } catch (error) {
      log(`[PythonClustering] 清理临时文件失败: ${error}`, "warn");
    }
  }
}

export const pythonClusteringService = new PythonClusteringService();