/**
 * Python聚类服务包装器
 * 负责与Python的scikit-learn实现通信，处理高维向量的聚类
 */

import { log } from "../../vite";
import { execFile } from "child_process";
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { ClusterResult } from "./kmeans_clustering";

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

export class PythonClusteringService {
  private readonly scriptPath: string;
  private readonly tmpDir: string;

  constructor() {
    // 设置脚本路径和临时目录
    this.scriptPath = path.join("server", "scripts", "run_clustering.py");
    this.tmpDir = path.join("tmp");
    
    // 确保临时目录存在
    this.ensureTmpDir();
  }

  /**
   * 确保临时目录存在
   */
  private async ensureTmpDir(): Promise<void> {
    try {
      if (!fs.existsSync(this.tmpDir)) {
        await mkdirAsync(this.tmpDir, { recursive: true });
        log(`[python_clustering] 已创建临时目录: ${this.tmpDir}`);
      }
    } catch (error) {
      log(`[python_clustering] 创建临时目录失败: ${error}`, 'error');
    }
  }

  /**
   * 使用Python的scikit-learn进行高效聚类
   * @param memoryVectors 向量数据，包含id和vector
   * @returns 聚类结果，与TypeScript实现兼容的格式
   */
  async clusterVectors(memoryVectors: { id: string | number; vector: number[] }[]): Promise<ClusterResult> {
    if (!memoryVectors || memoryVectors.length < 2) {
      log('[python_clustering] 向量数量不足，无法进行聚类', 'warn');
      return this.createEmptyClusterResult();
    }

    log(`[python_clustering] 准备进行Python聚类，处理${memoryVectors.length}条向量，维度=${memoryVectors[0]?.vector?.length || '未知'}`);
    
    // 创建唯一的临时文件名
    const inputFilePath = path.join(this.tmpDir, `vectors_${uuidv4()}.json`);
    const outputFilePath = path.join(this.tmpDir, `result_${uuidv4()}.json`);
    
    try {
      // 将向量数据写入临时JSON文件
      await writeFileAsync(inputFilePath, JSON.stringify(memoryVectors), 'utf-8');
      log(`[python_clustering] 已将向量数据写入: ${inputFilePath}`);
      
      // 执行Python聚类脚本
      const result = await this.executePythonScript(inputFilePath, outputFilePath);
      
      // 清理临时文件
      await this.cleanupTempFiles(inputFilePath, outputFilePath);
      
      // 处理结果
      if (!result || result.error) {
        log(`[python_clustering] Python聚类失败: ${result?.error || '未知错误'}`, 'error');
        return this.createEmptyClusterResult();
      }
      
      // 将Python结果转换为TypeScript格式
      return this.convertToTsFormat(result, memoryVectors);
      
    } catch (error) {
      log(`[python_clustering] 聚类处理错误: ${error}`, 'error');
      
      // 尝试清理临时文件
      await this.cleanupTempFiles(inputFilePath, outputFilePath);
      
      return this.createEmptyClusterResult();
    }
  }
  
  /**
   * 执行Python聚类脚本
   * @param inputFilePath 输入文件路径
   * @param outputFilePath 输出文件路径
   * @returns 聚类结果
   */
  private async executePythonScript(inputFilePath: string, outputFilePath: string): Promise<any> {
    return new Promise((resolve) => {
      log(`[python_clustering] 执行Python聚类脚本: ${this.scriptPath}`);
      
      const pythonProcess = execFile('python', [
        this.scriptPath,
        inputFilePath,
        outputFilePath
      ], {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      let scriptOutput = '';
      let errorOutput = '';
      
      // 收集标准输出
      pythonProcess.stdout?.on('data', (data: Buffer) => {
        scriptOutput += data.toString();
        log(`[python_clustering] 脚本输出: ${data.toString().trim()}`);
      });
      
      // 收集标准错误
      pythonProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
        log(`[python_clustering] 脚本错误: ${data.toString().trim()}`, 'error');
      });
      
      // 进程结束处理
      pythonProcess.on('close', async (code: number | null) => {
        if (code !== 0) {
          log(`[python_clustering] Python进程异常退出，代码: ${code}, 错误: ${errorOutput}`, 'error');
          resolve({ error: errorOutput || "Python进程异常退出" });
          return;
        }
        
        try {
          // 读取输出文件
          if (fs.existsSync(outputFilePath)) {
            const outputData = await readFileAsync(outputFilePath, 'utf8');
            const result = JSON.parse(outputData);
            log(`[python_clustering] 成功读取聚类结果`);
            resolve(result);
          } else {
            log(`[python_clustering] 输出文件未找到: ${outputFilePath}`, 'error');
            resolve({ error: "Python输出文件未找到" });
          }
        } catch (error) {
          log(`[python_clustering] 读取或解析输出失败: ${error}`, 'error');
          resolve({ error: `读取或解析输出失败: ${error}` });
        }
      });
      
      // 处理进程错误
      pythonProcess.on('error', (err: Error) => {
        log(`[python_clustering] 启动Python进程失败: ${err}`, 'error');
        resolve({ error: `启动Python进程失败: ${err.message}` });
      });
    });
  }
  
  /**
   * 清理临时文件
   * @param inputFilePath 输入文件路径
   * @param outputFilePath 输出文件路径
   */
  private async cleanupTempFiles(inputFilePath: string, outputFilePath: string): Promise<void> {
    try {
      // 删除输入文件
      if (fs.existsSync(inputFilePath)) {
        await unlinkAsync(inputFilePath);
        log(`[python_clustering] 已删除临时输入文件: ${inputFilePath}`);
      }
      
      // 删除输出文件
      if (fs.existsSync(outputFilePath)) {
        await unlinkAsync(outputFilePath);
        log(`[python_clustering] 已删除临时输出文件: ${outputFilePath}`);
      }
    } catch (error) {
      log(`[python_clustering] 清理临时文件失败: ${error}`, 'warn');
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
    
    log(`[python_clustering] 成功将Python聚类结果转换为TypeScript格式: ${result.centroids.length}个聚类`);
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