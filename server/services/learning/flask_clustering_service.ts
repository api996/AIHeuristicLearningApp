/**
 * Flask聚类服务接口
 * 提供与Python Flask API通信的TypeScript接口
 */

import * as path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import { ClusterResult } from './cluster_types';

// 服务配置
const DEFAULT_PORT = 5050;
const BASE_URL = `http://localhost:${DEFAULT_PORT}`;
// Use import.meta.url to get the current file's URL in ES modules
const currentDir = new URL('.', import.meta.url).pathname;
const SERVICE_MANAGER_PATH = path.resolve(currentDir, '../../services/api/clustering/service_manager.py');

// 定义内存向量接口
interface MemoryVector {
  id: string;
  vector: number[];
}

// 服务状态
let serviceProcess: any = null;
let isServiceStarting = false;

/**
 * 确保Flask聚类服务正在运行
 * 
 * @returns 服务启动是否成功的Promise
 */
async function ensureServiceRunning(): Promise<boolean> {
  // 如果服务已经在启动中，等待它完成
  if (isServiceStarting) {
    console.log('[FlaskClusteringService] 服务已经在启动中，等待完成...');
    
    // 等待启动过程完成
    return new Promise<boolean>((resolve) => {
      const checkInterval = setInterval(() => {
        if (!isServiceStarting) {
          clearInterval(checkInterval);
          resolve(serviceProcess !== null);
        }
      }, 500);
    });
  }
  
  // 检查服务是否已经在运行
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 1000 });
    if (response.status === 200) {
      console.log('[FlaskClusteringService] 服务已经在运行');
      return true;
    }
  } catch (error) {
    // 服务未运行，需要启动它
  }
  
  // 启动服务
  isServiceStarting = true;
  console.log('[FlaskClusteringService] 启动聚类服务...');
  
  try {
    // 使用Python服务管理器启动服务
    serviceProcess = spawn('python', [SERVICE_MANAGER_PATH], {
      stdio: 'pipe',
      detached: false
    });
    
    // 监听输出和错误
    serviceProcess.stdout.on('data', (data: Buffer) => {
      console.log(`[FlaskClusteringService] ${data.toString().trim()}`);
    });
    
    serviceProcess.stderr.on('data', (data: Buffer) => {
      console.error(`[FlaskClusteringService] 错误: ${data.toString().trim()}`);
    });
    
    // 监听退出
    serviceProcess.on('exit', (code: number) => {
      console.log(`[FlaskClusteringService] 服务已退出，退出码: ${code}`);
      serviceProcess = null;
    });
    
    // 等待服务启动
    return new Promise<boolean>((resolve) => {
      let retries = 0;
      const maxRetries = 30;
      
      const checkHealth = async () => {
        try {
          const response = await axios.get(`${BASE_URL}/health`, { timeout: 1000 });
          if (response.status === 200) {
            isServiceStarting = false;
            console.log('[FlaskClusteringService] 服务启动成功');
            resolve(true);
            return;
          }
        } catch (error) {
          // 继续尝试
        }
        
        retries++;
        if (retries >= maxRetries) {
          isServiceStarting = false;
          console.error('[FlaskClusteringService] 服务启动超时');
          resolve(false);
          return;
        }
        
        setTimeout(checkHealth, 1000);
      };
      
      // 开始健康检查
      setTimeout(checkHealth, 2000);
    });
    
  } catch (error) {
    isServiceStarting = false;
    console.error(`[FlaskClusteringService] 启动服务失败: ${error}`);
    return false;
  }
}

/**
 * 执行向量聚类
 * 
 * @param memoryIds 记忆ID数组
 * @param vectors 向量数组
 * @returns 聚类结果
 */
export async function clusterVectors(
  memoryIds: string[],
  vectors: number[][]
): Promise<ClusterResult | null> {
  // 确保服务正在运行
  const isRunning = await ensureServiceRunning();
  if (!isRunning) {
    console.error('[FlaskClusteringService] 服务未运行，无法执行聚类');
    return null;
  }
  
  try {
    // 准备数据
    const memoryVectors: MemoryVector[] = memoryIds.map((id, index) => ({
      id,
      vector: vectors[index]
    }));
    
    console.log(`[FlaskClusteringService] 发送聚类请求，包含 ${memoryVectors.length} 条记忆...`);
    
    // 发送聚类请求
    const response = await axios.post(`${BASE_URL}/api/cluster`, memoryVectors, {
      timeout: 300000  // 5分钟超时
    });
    
    // 处理结果
    const result = response.data;
    console.log(`[FlaskClusteringService] 聚类成功，发现 ${result.centroids.length} 个聚类`);
    
    // 转换为期望的格式
    return {
      centroids: result.centroids,
      topics: result.topics
    };
    
  } catch (error) {
    console.error(`[FlaskClusteringService] 聚类请求失败: ${error}`);
    return null;
  }
}

/**
 * 关闭聚类服务
 */
export function shutdownService(): void {
  if (serviceProcess) {
    console.log('[FlaskClusteringService] 关闭聚类服务...');
    serviceProcess.kill();
    serviceProcess = null;
  }
}

/**
 * 服务退出时的清理函数
 */
process.on('exit', () => {
  shutdownService();
});

// 注册其他退出信号处理
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
  process.on(signal, () => {
    shutdownService();
    process.exit(0);
  });
});