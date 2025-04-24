/**
 * 直接Python服务接口
 * 提供TypeScript直接调用独立Python脚本的能力
 */

import { log } from "../../vite";
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { ClusterResult } from './cluster_types';

// 确保VectorData的id属性只允许字符串
export interface VectorData {
  id: string;
  vector: number[];
}

/**
 * 直接Python服务
 * 通过子进程直接调用Python脚本
 */
class DirectPythonService {
  /**
   * 聚类向量数据
   * @param vectors 向量数据数组
   * @returns 聚类结果
   */
  async clusterVectors(vectors: VectorData[]): Promise<ClusterResult> {
    try {
      if (!vectors || vectors.length === 0) {
        log(`[DirectPythonService] 无法对空向量数组进行聚类`, "warn");
        return { centroids: [] };
      }
      
      // 获取向量维度
      const vectorDimension = vectors[0].vector.length;
      log(`[DirectPythonService] 开始聚类分析，向量数量=${vectors.length}，维度=${vectorDimension}`);
      
      // 创建临时文件
      const tempId = uuidv4();
      const tempDir = path.join(process.cwd(), 'tmp');
      
      // 确保临时目录存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const inputFilePath = path.join(tempDir, `vectors_${tempId}.json`);
      const outputFilePath = path.join(tempDir, `clusters_${tempId}.json`);
      
      // 将向量数据写入临时文件
      fs.writeFileSync(inputFilePath, JSON.stringify(vectors));
      
      // 执行Python聚类
      const result = await this.executePythonScript(inputFilePath, outputFilePath);
      
      // 清理临时文件
      this.cleanupTempFiles(inputFilePath, outputFilePath);
      
      return result;
    } catch (error) {
      log(`[DirectPythonService] 聚类分析出错: ${error}`, "error");
      return { centroids: [] };
    }
  }
  
  /**
   * 执行Python脚本
   * @param inputFilePath 输入文件路径
   * @param outputFilePath 输出文件路径
   * @returns 聚类结果
   */
  private async executePythonScript(
    inputFilePath: string, 
    outputFilePath: string
  ): Promise<ClusterResult> {
    return new Promise((resolve, reject) => {
      // 获取脚本路径
      const scriptPath = path.join(process.cwd(), 'server', 'services', 'learning_memory', 'python_direct_clustering.py');
      
      // 确保脚本存在
      if (!fs.existsSync(scriptPath)) {
        log(`[DirectPythonService] Python脚本不存在: ${scriptPath}`, "error");
        reject(new Error(`Python script does not exist: ${scriptPath}`));
        return;
      }
      
      // 执行Python脚本 - 在Replit环境中使用python3命令
      const pythonProcess = spawn('python3', [scriptPath, inputFilePath, outputFilePath]);
      
      let stdoutData = '';
      let stderrData = '';
      
      // 收集标准输出
      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        log(`[DirectPythonService] ${data.toString().trim()}`, "info");
      });
      
      // 收集标准错误
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        log(`[DirectPythonService] Python错误: ${data.toString().trim()}`, "warn");
      });
      
      // 处理进程退出
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`[DirectPythonService] Python进程异常退出(${code}): ${stderrData}`, "error");
        }
        
        try {
          // 读取输出文件
          if (fs.existsSync(outputFilePath)) {
            const outputData = fs.readFileSync(outputFilePath, 'utf8');
            
            try {
              const result = JSON.parse(outputData);
              
              // 检查结果格式
              if (!result.centroids || result.centroids.length === 0) {
                resolve({ centroids: [] });
              } else {
                resolve(result);
              }
            } catch (parseError) {
              log(`[DirectPythonService] 解析JSON输出失败: ${parseError}`, "error");
              reject(parseError);
            }
          } else {
            log(`[DirectPythonService] 输出文件不存在: ${outputFilePath}`, "error");
            reject(new Error(`Output file does not exist: ${outputFilePath}`));
          }
        } catch (readError) {
          log(`[DirectPythonService] 读取输出文件失败: ${readError}`, "error");
          reject(readError);
        }
      });
      
      // 处理进程错误
      pythonProcess.on('error', (error) => {
        log(`[DirectPythonService] 启动Python进程失败: ${error}`, "error");
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
      log(`[DirectPythonService] 清理临时文件失败: ${error}`, "warn");
    }
  }
}

export const directPythonService = new DirectPythonService();