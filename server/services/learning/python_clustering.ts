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
    // 将向量数据写入到临时文件中处理
    return `
import sys
import os
import json
import traceback

# 添加server目录到Python路径
sys.path.append('server')

# 获取命令行参数：输出文件路径
if len(sys.argv) < 2:
    output_file = "tmp/clustering_output.json"
else:
    output_file = sys.argv[1]

# 向量数据直接硬编码到脚本中，避免命令行参数过大问题
vectors_data = ${JSON.stringify(vectors)}

try:
    from services.clustering import clustering_service
    import asyncio
    
    async def cluster_data():
        try:
            # 使用聚类服务处理向量数据
            result = await clustering_service.cluster_vectors(vectors_data, use_cosine_distance=True)
            
            # 将结果写入到输出文件
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f)
                
        except Exception as e:
            # 将错误信息写入到输出文件
            with open(output_file, 'w', encoding='utf-8') as f:
                error_data = {
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }
                json.dump(error_data, f)

    # 运行异步函数
    asyncio.run(cluster_data())
    
except ImportError as e:
    # 将导入错误信息写入到输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        error_data = {
            "error": f"Python模块导入错误: {str(e)}"
        }
        json.dump(error_data, f)
except Exception as e:
    # 将一般错误信息写入到输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        error_data = {
            "error": f"Python执行错误: {str(e)}",
            "traceback": traceback.format_exc()
        }
        json.dump(error_data, f)
`;
  }
  
  /**
   * 执行Python代码
   * @param pythonCode 要执行的Python代码
   * @returns 执行结果
   */
  private async executePythonCode(pythonCode: string): Promise<any> {
    // 引入fs模块以写入临时文件
    import * as fs from 'fs';
    import * as path from 'path';
    import { v4 as uuidv4 } from 'uuid';
    import { promisify } from 'util';
    
    const writeFileAsync = promisify(fs.writeFile);
    const readFileAsync = promisify(fs.readFile);
    
    // 创建唯一的临时文件名
    const tempScriptPath = path.join('tmp', `clustering_script_${uuidv4()}.py`);
    const tempOutputPath = path.join('tmp', `clustering_output_${uuidv4()}.json`);
    
    try {
      // 确保tmp目录存在
      if (!fs.existsSync('tmp')) {
        fs.mkdirSync('tmp', { recursive: true });
      }
      
      // 将Python代码写入临时文件
      await writeFileAsync(tempScriptPath, pythonCode);
      
      // 返回Promise，以便异步执行
      return new Promise((resolve, reject) => {
        // 使用Node.js的child_process执行Python脚本文件，而不是通过命令行参数
        const pythonProcess = exec(`python ${tempScriptPath} ${tempOutputPath}`, {
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        let errorOutput = '';
        
        // 收集标准错误
        pythonProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
        
        // 进程结束处理
        pythonProcess.on('close', async (code: number | null) => {
          try {
            // 清理临时脚本文件
            if (fs.existsSync(tempScriptPath)) {
              fs.unlinkSync(tempScriptPath);
            }
            
            if (code !== 0) {
              log(`[python_clustering] Python进程异常退出，代码: ${code}, 错误: ${errorOutput}`, 'error');
              resolve({ error: errorOutput || "Python进程异常退出" });
              return;
            }
            
            // 读取Python输出的JSON结果文件
            if (fs.existsSync(tempOutputPath)) {
              const outputData = await readFileAsync(tempOutputPath, 'utf8');
              
              // 清理临时输出文件
              fs.unlinkSync(tempOutputPath);
              
              try {
                // 解析JSON结果
                const result = JSON.parse(outputData.trim());
                resolve(result);
              } catch (parseError: any) {
                log(`[python_clustering] 解析Python输出失败: ${parseError}, 输出: ${outputData.substring(0, 200)}...`, 'error');
                resolve({ error: "无法解析Python输出" });
              }
            } else {
              log(`[python_clustering] 输出文件未找到: ${tempOutputPath}`, 'error');
              resolve({ error: "Python输出文件未找到" });
            }
          } catch (fileError: any) {
            log(`[python_clustering] 文件操作错误: ${fileError}`, 'error');
            resolve({ error: `文件操作错误: ${fileError.message}` });
          }
        });
        
        // 处理进程错误
        pythonProcess.on('error', (err: Error) => {
          log(`[python_clustering] 执行Python失败: ${err}`, 'error');
          
          // 清理临时文件
          try {
            if (fs.existsSync(tempScriptPath)) {
              fs.unlinkSync(tempScriptPath);
            }
            if (fs.existsSync(tempOutputPath)) {
              fs.unlinkSync(tempOutputPath);
            }
          } catch (cleanupError) {
            log(`[python_clustering] 清理临时文件失败: ${cleanupError}`, 'error');
          }
          
          resolve({ error: err.message });
        });
      });
    } catch (error: any) {
      log(`[python_clustering] 准备Python执行环境失败: ${error}`, 'error');
      return { error: `准备Python执行环境失败: ${error.message}` };
    }
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