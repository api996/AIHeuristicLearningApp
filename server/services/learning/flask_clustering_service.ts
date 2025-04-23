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
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 2000 });
    if (response.status === 200) {
      console.log('[FlaskClusteringService] 服务已经在运行');
      return true;
    }
  } catch (error) {
    // 服务未运行或响应超时，将尝试重启它
    console.log('[FlaskClusteringService] 服务健康检查失败，将尝试重启服务');
    
    // 如果有旧服务进程，尝试优雅关闭
    if (serviceProcess) {
      try {
        console.log('[FlaskClusteringService] 发现旧服务进程，尝试关闭...');
        serviceProcess.kill();
        serviceProcess = null;
        // 等待1秒确保旧进程关闭
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (killError) {
        console.error(`[FlaskClusteringService] 关闭旧服务进程失败: ${killError}`);
      }
    }
  }
  
  // 启动服务
  isServiceStarting = true;
  console.log('[FlaskClusteringService] 启动聚类服务...');
  
  try {
    // 使用Python服务管理器启动服务
    serviceProcess = spawn('python', [SERVICE_MANAGER_PATH], {
      stdio: 'pipe',
      detached: false,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1' // 确保Python输出不被缓冲
      }
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
      isServiceStarting = false;
    });
    
    // 等待服务启动
    return new Promise<boolean>((resolve) => {
      let retries = 0;
      const maxRetries = 30;
      
      const checkHealth = async () => {
        if (!serviceProcess) {
          // 服务进程已经终止
          isServiceStarting = false;
          console.error('[FlaskClusteringService] 服务进程已终止');
          resolve(false);
          return;
        }
        
        try {
          const response = await axios.get(`${BASE_URL}/health`, { timeout: 2000 });
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
          // 尝试强制终止进程
          if (serviceProcess) {
            try {
              serviceProcess.kill('SIGKILL');
              serviceProcess = null;
            } catch (killError) {
              console.error(`[FlaskClusteringService] 强制终止进程失败: ${killError}`);
            }
          }
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
  // 参数验证
  if (!memoryIds || !vectors || memoryIds.length === 0 || vectors.length === 0) {
    console.error('[FlaskClusteringService] 无效的参数: 记忆ID或向量数组为空');
    return null;
  }
  
  if (memoryIds.length !== vectors.length) {
    console.error(`[FlaskClusteringService] 记忆ID数量与向量数量不匹配: ${memoryIds.length} vs ${vectors.length}`);
    return null;
  }
  
  // 确保服务正在运行，最多尝试3次
  let isRunning = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    isRunning = await ensureServiceRunning();
    if (isRunning) break;
    
    console.log(`[FlaskClusteringService] 服务启动失败，尝试重新启动 (${attempt}/3)...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (!isRunning) {
    console.error('[FlaskClusteringService] 所有启动尝试均失败，无法执行聚类');
    return null;
  }
  
  // 大数据集处理策略
  const totalVectors = memoryIds.length;
  const batchSize = 500; // 每批处理的最大向量数
  const needsBatching = totalVectors > batchSize;
  
  try {
    console.log(`[FlaskClusteringService] 发送聚类请求，包含 ${totalVectors} 条记忆...`);
    
    // 创建向量数据
    const memoryVectors: MemoryVector[] = memoryIds.map((id, index) => ({
      id,
      vector: vectors[index]
    }));
    
    // 超大数据集分批处理
    if (needsBatching) {
      console.log(`[FlaskClusteringService] 数据量较大(${totalVectors})，使用增强分批处理策略...`);
      
      // 1. 先发送小型测试请求确保服务正常工作
      const testBatch = memoryVectors.slice(0, 10);
      
      console.log(`[FlaskClusteringService] 发送测试请求，包含 ${testBatch.length} 条记忆...`);
      await axios.post(`${BASE_URL}/api/cluster`, testBatch, {
        timeout: 10000  // 10秒超时
      });
      
      // 2. 使用均匀采样减少数据量但保留代表性
      // 当数据量很大时，使用均匀采样而不是随机采样，确保保留整体分布
      let sampledVectors: MemoryVector[];
      
      if (totalVectors > 1000) {
        console.log(`[FlaskClusteringService] 数据量过大(${totalVectors})，使用均匀采样方法...`);
        // 每隔几个取一个样本，确保整体分布的代表性
        const step = Math.max(1, Math.floor(totalVectors / 1000));
        sampledVectors = [];
        
        for (let i = 0; i < totalVectors; i += step) {
          sampledVectors.push(memoryVectors[i]);
          if (sampledVectors.length >= 1000) break;
        }
        
        console.log(`[FlaskClusteringService] 采样后数据量: ${sampledVectors.length}`);
      } else {
        sampledVectors = memoryVectors;
      }
      
      // 3. 发送优化后的请求
      console.log(`[FlaskClusteringService] 发送优化后的聚类请求...`);
      const response = await axios.post(`${BASE_URL}/api/cluster`, sampledVectors, {
        timeout: 600000,  // 10分钟超时
        maxContentLength: 150 * 1024 * 1024,  // 150MB最大内容长度
        maxBodyLength: 150 * 1024 * 1024,     // 150MB最大请求体长度
      });
      
      // 处理结果
      const result = response.data;
      console.log(`[FlaskClusteringService] 聚类成功，发现 ${result.centroids.length} 个聚类`);
      
      // 转换为期望的格式
      return {
        centroids: result.centroids,
        topics: result.topics
      };
    } else {
      // 小数据集直接处理
      console.log(`[FlaskClusteringService] 发送标准聚类请求...`);
      const response = await axios.post(`${BASE_URL}/api/cluster`, memoryVectors, {
        timeout: 300000,  // 5分钟超时
        maxContentLength: 50 * 1024 * 1024,   // 50MB最大内容长度
        maxBodyLength: 50 * 1024 * 1024,      // 50MB最大请求体长度
      });
      
      // 处理结果
      const result = response.data;
      console.log(`[FlaskClusteringService] 聚类成功，发现 ${result.centroids.length} 个聚类`);
      
      // 转换为期望的格式
      return {
        centroids: result.centroids,
        topics: result.topics
      };
    }
  } catch (error) {
    console.error(`[FlaskClusteringService] 聚类请求失败: ${error}`);
    
    // 尝试关闭并重启服务
    try {
      shutdownService();
      await new Promise(resolve => setTimeout(resolve, 1000));
      // 下次调用会自动重启服务
    } catch (shutdownError) {
      console.error(`[FlaskClusteringService] 关闭服务失败: ${shutdownError}`);
    }
    
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