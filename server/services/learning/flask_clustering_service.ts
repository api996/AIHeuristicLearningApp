/**
 * Flask聚类API客户端
 * 使用HTTP调用Python聚类服务，避免文件系统交互
 */

import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件的目录路径（ES模块替代__dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 日志工具
import { log } from './utils';

// 默认API配置 - 使用高端口号避免与其他服务冲突
const DEFAULT_API_PORT = 9001; // 使用9001端口，远离常用端口范围
const DEFAULT_API_URL = `http://localhost:${DEFAULT_API_PORT}`;

// API服务实例
let serviceProcess: any = null;
let serviceStarted = false;
let servicePort = DEFAULT_API_PORT;

/**
 * 启动聚类API服务
 * @returns Promise<boolean> 是否成功启动
 */
export async function startClusteringService(): Promise<boolean> {
  // 如果服务已经启动，直接返回成功
  if (serviceStarted && serviceProcess && !serviceProcess.killed) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    try {
      log(`[flask_clustering] 启动聚类API服务...`, 'info');

      // 查找启动脚本路径
      const scriptPath = path.join(__dirname, '../api/clustering/start_service.py');
      
      // 检查脚本是否存在
      if (!fs.existsSync(scriptPath)) {
        log(`[flask_clustering] 错误: 找不到启动脚本 ${scriptPath}`, 'error');
        resolve(false);
        return;
      }

      // 设置环境变量
      const env = { 
        ...process.env, 
        CLUSTERING_API_PORT: servicePort.toString(),
        PYTHONUNBUFFERED: '1' // 确保Python输出不缓冲
      };

      log(`[flask_clustering] 尝试启动聚类服务: ${scriptPath}`, 'info');
      
      // 检查Python路径
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      
      // 启动服务进程 - 优先使用python3，如果失败再尝试python
      try {
        serviceProcess = spawn(pythonPath, [scriptPath], { 
          env,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        log(`[flask_clustering] 使用 ${pythonPath} 启动聚类服务`, 'info');
      } catch (error: any) {
        log(`[flask_clustering] 使用 ${pythonPath} 启动失败: ${error.message}`, 'warn');
        
        // 尝试使用python
        try {
          serviceProcess = spawn('python', [scriptPath], { 
            env,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          
          log(`[flask_clustering] 改用 python 启动聚类服务`, 'info');
        } catch (pythonError: any) {
          log(`[flask_clustering] 使用 python 启动也失败: ${pythonError.message}`, 'error');
          throw new Error('无法启动Python聚类服务');
        }
      }

      // 设置超时，确保不会无限等待
      const timeout = setTimeout(() => {
        log(`[flask_clustering] 警告: 启动服务超时`, 'warn');
        resolve(false);
      }, 10000);

      // 处理输出
      serviceProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        log(`[clustering_api] ${output}`, 'info');

        // 检查是否成功启动
        if (output.includes('聚类API服务已启动') || output.includes('启动聚类API服务，端口')) {
          clearTimeout(timeout);
          serviceStarted = true;
          log(`[flask_clustering] 聚类API服务已成功启动`, 'info');
          resolve(true);
        }
      });

      // 处理错误
      serviceProcess.stderr.on('data', (data: Buffer) => {
        log(`[clustering_api_error] ${data.toString().trim()}`, 'error');
      });

      // 处理退出
      serviceProcess.on('close', (code: number) => {
        if (code !== 0) {
          log(`[flask_clustering] 聚类API服务异常退出，代码: ${code}`, 'error');
        }
        serviceStarted = false;
        clearTimeout(timeout);
        
        // 如果尚未解析，解析为失败
        resolve(false);
      });

      // 尝试检查服务是否已经运行
      checkServiceHealth()
        .then((running) => {
          if (running) {
            clearTimeout(timeout);
            serviceStarted = true;
            log(`[flask_clustering] 聚类API服务已经在运行`, 'info');
            resolve(true);
          }
        })
        .catch(() => {
          // 忽略错误，等待服务启动
        });
    } catch (error) {
      log(`[flask_clustering] 启动聚类API服务出错: ${error}`, 'error');
      resolve(false);
    }
  });
}

/**
 * 检查服务健康状态
 * @returns Promise<boolean> 服务是否健康
 */
async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${DEFAULT_API_URL}/health`, { timeout: 1000 });
    return response.status === 200 && response.data.status === 'healthy';
  } catch (error) {
    return false;
  }
}

/**
 * 停止聚类API服务
 */
export async function stopClusteringService(): Promise<void> {
  if (serviceProcess && !serviceProcess.killed) {
    log(`[flask_clustering] 停止聚类API服务...`, 'info');
    serviceProcess.kill();
    serviceStarted = false;
  }
}

/**
 * 确保服务已启动
 * @returns Promise<boolean> 服务是否可用
 */
async function ensureServiceRunning(): Promise<boolean> {
  // 先检查服务是否已经在运行
  const isRunning = await checkServiceHealth();
  if (isRunning) {
    serviceStarted = true;
    log(`[flask_clustering] 服务已经在运行，无需启动`, 'info');
    return true;
  }

  log(`[flask_clustering] 服务未运行，尝试启动...`, 'info');
  
  // 如果没在运行，尝试启动服务
  const startSuccess = await startClusteringService();
  
  if (startSuccess) {
    // 服务启动成功，再次验证健康状态
    let healthCheckRetries = 5;
    let serviceHealthy = false;
    
    while (healthCheckRetries > 0 && !serviceHealthy) {
      log(`[flask_clustering] 检查服务健康状态，剩余重试次数: ${healthCheckRetries}`, 'info');
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
      serviceHealthy = await checkServiceHealth();
      healthCheckRetries--;
    }
    
    if (serviceHealthy) {
      log(`[flask_clustering] 服务健康检查通过`, 'info');
      return true;
    } else {
      log(`[flask_clustering] 服务已启动但健康检查失败`, 'error');
      return false;
    }
  }
  
  log(`[flask_clustering] 服务启动失败`, 'error');
  return false;
}

/**
 * 调用聚类API对向量进行聚类
 * @param memoryIds 记忆ID数组
 * @param vectors 向量数组
 * @returns 聚类结果
 */
export async function clusterVectors(memoryIds: string[], vectors: number[][]): Promise<any> {
  try {
    // 确保向量数据合法
    if (!vectors || vectors.length === 0 || !memoryIds || memoryIds.length !== vectors.length) {
      log(`[flask_clustering] 错误: 无效的向量数据`, 'error');
      throw new Error('无效的向量数据');
    }

    const vectorDimension = vectors[0].length;
    log(`[flask_clustering] 开始聚类，${memoryIds.length}条数据，向量维度: ${vectorDimension}`, 'info');

    // 确保服务已启动
    const serviceReady = await ensureServiceRunning();
    if (!serviceReady) {
      log(`[flask_clustering] 错误: 无法启动聚类API服务`, 'error');
      throw new Error('无法启动聚类API服务');
    }

    // 准备请求数据
    const requestData = memoryIds.map((id, index) => ({
      id: id,
      vector: vectors[index]
    }));

    // 发起API请求
    log(`[flask_clustering] 发送聚类请求，数据量: ${requestData.length}`, 'info');
    const startTime = Date.now();
    
    const response = await axios.post(`${DEFAULT_API_URL}/api/cluster`, requestData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000 // 60秒超时，考虑大量向量计算需要时间
    });

    const elapsedTime = Date.now() - startTime;
    log(`[flask_clustering] 聚类请求完成，耗时: ${elapsedTime}ms`, 'info');

    if (response.status !== 200) {
      log(`[flask_clustering] API请求失败，状态码: ${response.status}`, 'error');
      throw new Error(`API请求失败，状态码: ${response.status}`);
    }

    const result = response.data;
    const clusterCount = result.centroids ? result.centroids.length : 0;
    log(`[flask_clustering] 聚类结果: ${clusterCount}个聚类`, 'info');

    return result;
  } catch (error) {
    log(`[flask_clustering] 聚类出错: ${error}`, 'error');
    throw error;
  }
}

// 确保进程退出时关闭服务
process.on('exit', () => {
  stopClusteringService();
});

process.on('SIGINT', () => {
  stopClusteringService();
  process.exit(0);
});

// 导出函数
export default {
  clusterVectors,
  startClusteringService,
  stopClusteringService
};