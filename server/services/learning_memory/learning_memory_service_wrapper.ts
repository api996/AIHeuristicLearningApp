/**
 * Python记忆服务封装器
 * 提供对Python聚类服务的TypeScript封装
 */

import { spawn } from 'child_process';
import { log } from '../../vite';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Learning Memory Service 封装类
 * 提供对Python记忆服务的调用
 */
class LearningMemoryServiceWrapper {
  /**
   * 分析记忆聚类
   * 调用Python服务进行聚类分析
   * 
   * @param memoriesData 记忆数据
   * @returns 聚类结果
   */
  async analyze_memory_clusters_sync(memoriesData: any[]): Promise<any> {
    try {
      log(`[LearningMemoryServiceWrapper] 开始分析${memoriesData.length}条记忆的聚类`);
      
      // 创建临时文件存储记忆数据
      const tempId = uuidv4();
      const tempDir = path.join(process.cwd(), 'tmp');
      
      // 确保临时目录存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const inputFilePath = path.join(tempDir, `memories_${tempId}.json`);
      const outputFilePath = path.join(tempDir, `clusters_${tempId}.json`);
      
      // 将记忆数据写入临时文件
      fs.writeFileSync(inputFilePath, JSON.stringify(memoriesData));
      
      // 执行Python脚本
      const result = await this.executePythonScript(inputFilePath, outputFilePath);
      
      // 清理临时文件
      this.cleanupTempFiles(inputFilePath, outputFilePath);
      
      return result;
    } catch (error) {
      log(`[LearningMemoryServiceWrapper] 分析记忆聚类出错: ${error}`, "error");
      throw error;
    }
  }
  
  /**
   * 执行Python聚类脚本
   * @param inputFilePath 输入文件路径
   * @param outputFilePath 输出文件路径
   * @returns 聚类结果
   */
  private async executePythonScript(inputFilePath: string, outputFilePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // 构造Python代码
      const pythonCode = `
import sys
import os
import json
import asyncio
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.append("${process.cwd()}")

# 导入记忆聚类服务
from server.services.learning_memory import learning_memory_service

async def main():
    try:
        # 读取输入文件
        with open("${inputFilePath}", "r") as f:
            memories_data = json.load(f)
        
        # 调用聚类分析函数
        clusters = await learning_memory_service.analyze_memory_clusters(memories_data)
        
        # 将结果写入输出文件
        with open("${outputFilePath}", "w") as f:
            json.dump(clusters, f)
        
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        # 创建空结果
        with open("${outputFilePath}", "w") as f:
            json.dump({}, f)
        sys.exit(1)

# 执行主函数
asyncio.run(main())
      `;
      
      // 执行Python代码
      const pythonProcess = spawn('python', ['-c', pythonCode]);
      
      let stdoutData = '';
      let stderrData = '';
      
      // 收集标准输出
      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      // 收集标准错误
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        log(`[LearningMemoryServiceWrapper] Python错误: ${data.toString()}`, "warn");
      });
      
      // 处理进程退出
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`[LearningMemoryServiceWrapper] Python进程异常退出(${code}): ${stderrData}`, "error");
          // 即使出错也尝试读取输出文件
        }
        
        try {
          // 读取输出文件
          if (fs.existsSync(outputFilePath)) {
            const outputData = fs.readFileSync(outputFilePath, 'utf8');
            try {
              const result = JSON.parse(outputData);
              resolve(result);
            } catch (parseError) {
              log(`[LearningMemoryServiceWrapper] 解析JSON输出失败: ${parseError}`, "error");
              reject(parseError);
            }
          } else {
            log(`[LearningMemoryServiceWrapper] 输出文件不存在: ${outputFilePath}`, "error");
            reject(new Error(`Output file does not exist: ${outputFilePath}`));
          }
        } catch (readError) {
          log(`[LearningMemoryServiceWrapper] 读取输出文件失败: ${readError}`, "error");
          reject(readError);
        }
      });
      
      // 处理进程错误
      pythonProcess.on('error', (error) => {
        log(`[LearningMemoryServiceWrapper] 启动Python进程失败: ${error}`, "error");
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
      log(`[LearningMemoryServiceWrapper] 清理临时文件失败: ${error}`, "warn");
    }
  }
}

export const learning_memory_service = new LearningMemoryServiceWrapper();