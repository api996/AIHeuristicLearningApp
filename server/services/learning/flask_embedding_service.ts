/**
 * Flask嵌入API客户端
 * 使用HTTP调用Python嵌入服务，避免命令行参数限制问题
 */

import axios from 'axios';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

// 获取当前文件的目录路径（ES模块替代__dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 日志工具
import { log } from './utils';

// 默认API配置 - 使用高端口号避免与其他服务冲突
const DEFAULT_API_PORT = 9002; // 使用9002端口，与聚类服务(9001)区分
const DEFAULT_API_URL = `http://localhost:${DEFAULT_API_PORT}`;

// API服务实例
let serviceProcess: any = null;
let serviceStarted = false;
let servicePort = DEFAULT_API_PORT;

// 立即尝试启动服务，确保它在应用启动时可用
(async function initialStartup() {
  try {
    log(`[flask_embedding] 应用启动时初始化嵌入服务...`, 'info');
    await startEmbeddingService();
  } catch (error) {
    log(`[flask_embedding] 初始化时启动服务失败: ${error}`, 'error');
  }
})();

/**
 * 启动嵌入API服务
 * @returns Promise<boolean> 是否成功启动
 */
export async function startEmbeddingService(): Promise<boolean> {
  // 如果服务已经启动，直接返回成功
  if (serviceStarted && serviceProcess && !serviceProcess.killed) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    try {
      log(`[flask_embedding] 启动嵌入API服务...`, 'info');

      // 查找启动脚本路径
      const scriptPath = path.join(__dirname, '../api/embedding/start_service.py');
      
      // 检查脚本是否存在
      if (!fs.existsSync(scriptPath)) {
        log(`[flask_embedding] 错误: 找不到启动脚本 ${scriptPath}`, 'error');
        resolve(false);
        return;
      }

      // 设置环境变量
      const env = { 
        ...process.env, 
        EMBEDDING_API_PORT: servicePort.toString(),
        PYTHONUNBUFFERED: '1' // 确保Python输出不缓冲
      };

      log(`[flask_embedding] 尝试启动嵌入服务: ${scriptPath}`, 'info');
      
      // 检查Python路径
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      
      // 启动服务进程 - 优先使用python3，如果失败再尝试python
      try {
        serviceProcess = spawn(pythonPath, [scriptPath], { 
          env,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        log(`[flask_embedding] 使用 ${pythonPath} 启动嵌入服务`, 'info');
      } catch (error: any) {
        log(`[flask_embedding] 使用 ${pythonPath} 启动失败: ${error.message}`, 'warn');
        
        // 尝试使用python
        try {
          serviceProcess = spawn('python', [scriptPath], { 
            env,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          
          log(`[flask_embedding] 改用 python 启动嵌入服务`, 'info');
        } catch (pythonError: any) {
          log(`[flask_embedding] 使用 python 启动也失败: ${pythonError.message}`, 'error');
          throw new Error('无法启动Python嵌入服务');
        }
      }

      // 设置超时，确保不会无限等待
      const timeout = setTimeout(() => {
        log(`[flask_embedding] 警告: 启动服务超时`, 'warn');
        resolve(false);
      }, 10000);

      // 处理输出
      serviceProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        log(`[embedding_api] ${output}`, 'info');

        // 检查是否成功启动
        if (output.includes('嵌入API服务已启动') || output.includes('启动向量嵌入API服务')) {
          clearTimeout(timeout);
          serviceStarted = true;
          log(`[flask_embedding] 嵌入API服务已成功启动`, 'info');
          resolve(true);
        }
      });

      // 处理错误
      serviceProcess.stderr.on('data', (data: Buffer) => {
        log(`[embedding_api_error] ${data.toString().trim()}`, 'error');
      });

      // 处理退出
      serviceProcess.on('close', (code: number) => {
        if (code !== 0) {
          log(`[flask_embedding] 嵌入API服务异常退出，代码: ${code}`, 'error');
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
            log(`[flask_embedding] 嵌入API服务已经在运行`, 'info');
            resolve(true);
          }
        })
        .catch(() => {
          // 忽略错误，等待服务启动
        });
    } catch (error) {
      log(`[flask_embedding] 启动嵌入API服务出错: ${error}`, 'error');
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
 * 停止嵌入API服务
 */
export async function stopEmbeddingService(): Promise<void> {
  if (serviceProcess && !serviceProcess.killed) {
    log(`[flask_embedding] 停止嵌入API服务...`, 'info');
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
    log(`[flask_embedding] 服务已经在运行，无需启动`, 'info');
    return true;
  }

  log(`[flask_embedding] 服务未运行，尝试启动...`, 'info');
  
  // 如果没在运行，尝试启动服务
  const startSuccess = await startEmbeddingService();
  
  if (startSuccess) {
    // 服务启动成功，再次验证健康状态
    let healthCheckRetries = 5;
    let serviceHealthy = false;
    
    while (healthCheckRetries > 0 && !serviceHealthy) {
      log(`[flask_embedding] 检查服务健康状态，剩余重试次数: ${healthCheckRetries}`, 'info');
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
      serviceHealthy = await checkServiceHealth();
      healthCheckRetries--;
    }
    
    if (serviceHealthy) {
      log(`[flask_embedding] 服务健康检查通过`, 'info');
      return true;
    } else {
      log(`[flask_embedding] 服务已启动但健康检查失败`, 'error');
      return false;
    }
  }
  
  log(`[flask_embedding] 服务启动失败`, 'error');
  return false;
}

/**
 * 通过Flask API服务生成文本的向量嵌入
 * 使用HTTP调用Python嵌入服务，更稳定、更可靠
 * @param text 需要嵌入的文本
 * @returns 向量嵌入
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // 确保文本不为空
    if (!text || text.trim().length === 0) {
      log(`[flask_embedding] 错误: 无效的文本内容`, 'error');
      throw new Error('无效的文本内容');
    }

    log(`[flask_embedding] 开始生成嵌入，文本长度: ${text.length}`, 'info');

    // 确保服务正在运行
    const serviceRunning = await ensureServiceRunning();
    if (!serviceRunning) {
      throw new Error('嵌入服务未运行，无法生成嵌入');
    }

    // 使用Flask API生成嵌入
    const startTime = Date.now();
    const response = await axios.post(
      `${DEFAULT_API_URL}/api/embed`,
      { text },
      { 
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const elapsedTime = Date.now() - startTime;

    if (!response.data.success || !response.data.embedding || !Array.isArray(response.data.embedding)) {
      log(`[flask_embedding] API返回无效响应: ${JSON.stringify(response.data)}`, 'error');
      throw new Error('API返回无效响应');
    }

    log(`[flask_embedding] 嵌入生成成功，维度: ${response.data.dimensions}, 耗时: ${elapsedTime}ms`, 'info');
    return response.data.embedding;
  } catch (error: any) {
    // 处理特定的错误类型
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      log(`[flask_embedding] 连接嵌入服务失败: ${error.message}`, 'error');
      
      // 尝试重启服务
      log(`[flask_embedding] 尝试重启嵌入服务...`, 'info');
      const restartSuccess = await startEmbeddingService();
      
      if (restartSuccess) {
        log(`[flask_embedding] 服务已重启，重试嵌入生成`, 'info');
        // 等待服务启动
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 重试请求
        try {
          const response = await axios.post(
            `${DEFAULT_API_URL}/api/embed`,
            { text },
            { 
              timeout: 30000,
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (response.data.success && response.data.embedding) {
            log(`[flask_embedding] 重试成功，嵌入维度: ${response.data.dimensions}`, 'info');
            return response.data.embedding;
          }
        } catch (retryError) {
          log(`[flask_embedding] 重试失败: ${retryError}`, 'error');
        }
      }
    }
    
    log(`[flask_embedding] 嵌入生成出错: ${error}`, 'error');
    throw error;
  }
}

/**
 * 计算两个文本之间的相似度
 * @param text1 第一个文本
 * @param text2 第二个文本
 * @returns 相似度(0-1之间)
 */
export async function calculateSimilarity(text1: string, text2: string): Promise<number> {
  try {
    // 确保文本不为空
    if (!text1 || !text2) {
      log(`[flask_embedding] 错误: 无效的文本内容`, 'error');
      throw new Error('无效的文本内容');
    }

    log(`[flask_embedding] 开始计算相似度，文本1长度: ${text1.length}, 文本2长度: ${text2.length}`, 'info');

    // 确保服务正在运行
    const serviceRunning = await ensureServiceRunning();
    if (!serviceRunning) {
      throw new Error('嵌入服务未运行，无法计算相似度');
    }

    // 使用Flask API直接计算相似度
    const startTime = Date.now();
    const response = await axios.post(
      `${DEFAULT_API_URL}/api/similarity`,
      { text1, text2 },
      { 
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const elapsedTime = Date.now() - startTime;

    if (!response.data.success || typeof response.data.similarity !== 'number') {
      log(`[flask_embedding] API返回无效响应: ${JSON.stringify(response.data)}`, 'error');
      throw new Error('API返回无效响应');
    }

    log(`[flask_embedding] 相似度计算成功: ${response.data.similarity}, 耗时: ${elapsedTime}ms`, 'info');
    return response.data.similarity;
  } catch (error: any) {
    // 处理特定的错误类型
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      log(`[flask_embedding] 连接嵌入服务失败: ${error.message}`, 'error');
      
      // 尝试重启服务
      log(`[flask_embedding] 尝试重启嵌入服务...`, 'info');
      const restartSuccess = await startEmbeddingService();
      
      if (restartSuccess) {
        log(`[flask_embedding] 服务已重启，重试相似度计算`, 'info');
        // 等待服务启动
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 重试请求
        try {
          const response = await axios.post(
            `${DEFAULT_API_URL}/api/similarity`,
            { text1, text2 },
            { 
              timeout: 30000,
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (response.data.success && typeof response.data.similarity === 'number') {
            log(`[flask_embedding] 重试成功，相似度: ${response.data.similarity}`, 'info');
            return response.data.similarity;
          }
        } catch (retryError) {
          log(`[flask_embedding] 重试失败: ${retryError}`, 'error');
        }
      }
      
      // 如果服务无法启动或重试失败，回退到本地计算
      log(`[flask_embedding] 无法通过API计算相似度，回退到本地计算`, 'warn');
      
      // 首先生成两个文本的嵌入
      log(`[flask_embedding] 生成第一个文本的嵌入`, 'info');
      const embedding1 = await generateEmbedding(text1);
      
      log(`[flask_embedding] 生成第二个文本的嵌入`, 'info');
      const embedding2 = await generateEmbedding(text2);
      
      // 计算余弦相似度
      log(`[flask_embedding] 计算余弦相似度`, 'info');
      const similarity = cosineSimilarity(embedding1, embedding2);
      
      log(`[flask_embedding] 本地相似度计算成功: ${similarity}`, 'info');
      return similarity;
    }
    
    log(`[flask_embedding] 相似度计算出错: ${error}`, 'error');
    throw error;
  }
}

/**
 * 计算两个向量的余弦相似度
 * @param vec1 第一个向量
 * @param vec2 第二个向量
 * @returns 余弦相似度 (0-1之间)
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    throw new Error(`向量维度不匹配: ${vec1?.length} vs ${vec2?.length}`);
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0; // 避免除以零
  }
  
  const similarity = dotProduct / (magnitude1 * magnitude2);
  
  // 确保结果在0-1之间
  return Math.max(0, Math.min(1, similarity));
}

// 确保进程退出时关闭服务
process.on('exit', () => {
  stopEmbeddingService();
});

process.on('SIGINT', () => {
  stopEmbeddingService();
  process.exit(0);
});

// 导出函数
export default {
  generateEmbedding,
  calculateSimilarity,
  startEmbeddingService,
  stopEmbeddingService
};