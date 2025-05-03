/**
 * Flask嵌入API客户端
 * 使用HTTP调用Python嵌入服务，避免命令行参数限制问题
 */

import axios from 'axios';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// 使用进程的当前工作目录作为基准目录
const BASE_DIR = process.cwd();

// 日志工具
import { log } from '../../vite';

// 默认API配置 - 使用高端口号避免与其他服务冲突
const DEFAULT_API_PORT = 9003; // 使用9002端口，与聚类服务(9001)区分
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
      const scriptPath = path.join(BASE_DIR, 'server/services/api/embedding/start_service.py');
      
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
  try {
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
      let healthCheckRetries = 10; // 增加重试次数
      let serviceHealthy = false;
      
      while (healthCheckRetries > 0 && !serviceHealthy) {
        log(`[flask_embedding] 检查服务健康状态，剩余重试次数: ${healthCheckRetries}`, 'info');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
        try {
          serviceHealthy = await checkServiceHealth();
        } catch (error) {
          log(`[flask_embedding] 健康检查失败: ${error}`, 'warn');
        }
        healthCheckRetries--;
      }
      
      if (serviceHealthy) {
        log(`[flask_embedding] 服务健康检查通过`, 'info');
        return true;
      } else {
        log(`[flask_embedding] 服务已启动但健康检查失败`, 'error');
        // 如果健康检查失败，尝试使用直接嵌入方式
        log(`[flask_embedding] 将使用直接嵌入API模式作为备选方案`, 'warn');
        return false;
      }
    }
    
    log(`[flask_embedding] 服务启动失败`, 'error');
    return false;
  } catch (error) {
    log(`[flask_embedding] 确保服务运行时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 通过Flask API服务生成文本的向量嵌入
 * 使用HTTP调用Python嵌入服务，更稳定、更可靠
 * @param text 需要嵌入的文本
 * @returns 向量嵌入
 */
/**
 * 使用Python直接生成嵌入的备选方案
 * 在Flask服务失败时使用
 * @param text 需要嵌入的文本
 * @returns 向量嵌入
 */
async function fallbackGenerateEmbedding(text: string): Promise<number[]> {
  try {
    log(`[flask_embedding] 使用直接Python嵌入模式`, 'warn');
    
    // 通过构造Python进程来直接调用Gemini API
    // 使用已导入的模块而不是require
    // 这些模块已在文件顶部导入
    // const { spawn } = require('child_process');
    // const path = require('path');
    
    // 构造Python命令
    const pythonScript = path.join(BASE_DIR, 'server/services/embedding.py');
    
    // 运行Python脚本生成向量嵌入
    try {
      log(`[flask_embedding] 检查Python脚本是否存在: ${pythonScript}`, 'info');
      // 使用已导入的模块而不是require
      // const fs = require('fs');
      if (!fs.existsSync(pythonScript)) {
        log(`[flask_embedding] 错误: Python脚本不存在: ${pythonScript}`, 'error');
        // 尝试查找其他可能的位置
        const alternativePath = path.join(BASE_DIR, 'server/services/embedding.py');
        if (fs.existsSync(alternativePath)) {
          log(`[flask_embedding] 找到替代路径: ${alternativePath}`, 'info');
          return await directPythonEmbedding(alternativePath, text);
        } else {
          throw new Error('找不到Python嵌入脚本');
        }
      }
      
      // 使用标准路径生成嵌入
      return await directPythonEmbedding(pythonScript, text);
    } catch (error) {
      log(`[flask_embedding] 直接嵌入模式失败: ${error}`, 'error');
      throw error;
    }
  } catch (error) {
    log(`[flask_embedding] 所有嵌入尝试都失败: ${error}`, 'error');
    throw error;
  }
}

/**
 * 直接调用Python脚本生成嵌入
 * @param pythonScript Python脚本路径
 * @param text 要嵌入的文本
 * @returns 向量嵌入
 */
async function directPythonEmbedding(pythonScript: string, text: string): Promise<number[]> {
  // 使用已导入的模块而不是require
  
  return await new Promise<number[]>((resolve, reject) => {
    try {
      log(`[flask_embedding] 启动Python进程: ${pythonScript}`, 'info');
      const pythonProcess = spawn('python', [pythonScript, '--text', text]);
      
      let output = '';
      pythonProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      let errorOutput = '';
      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
        log(`[flask_embedding] Python脚本错误: ${data.toString().trim()}`, 'error');
      });
      
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          log(`[flask_embedding] Python脚本退出代码: ${code}, 错误: ${errorOutput}`, 'error');
          reject(new Error(`Python脚本执行失败，代码: ${code}, 错误: ${errorOutput}`));
          return;
        }
        
        try {
          log(`[flask_embedding] Python输出: ${output.substring(0, 100)}...`, 'info');
          const result = JSON.parse(output.trim());
          if (result && Array.isArray(result)) {
            log(`[flask_embedding] 直接嵌入模式成功，维度: ${result.length}`, 'info');
            resolve(result);
          } else {
            reject(new Error('无效的Python嵌入输出格式'));
          }
        } catch (parseError) {
          reject(new Error(`解析Python输出失败: ${parseError}, 输出: ${output.trim().substring(0, 100)}...`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // 确保文本不为空
    if (!text || text.trim().length === 0) {
      log(`[flask_embedding] 错误: 无效的文本内容`, 'error');
      throw new Error('无效的文本内容');
    }

    log(`[flask_embedding] 开始生成嵌入，文本长度: ${text.length}`, 'info');

    // 尝试使用Flask API生成嵌入
    try {
      // 确保服务正在运行
      const serviceRunning = await ensureServiceRunning();
      if (!serviceRunning) {
        log(`[flask_embedding] 服务不可用，切换到直接模式`, 'warn');
        return await fallbackGenerateEmbedding(text);
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
        // 切换到直接模式
        return await fallbackGenerateEmbedding(text);
      }

      log(`[flask_embedding] 嵌入生成成功，维度: ${response.data.dimensions}, 耗时: ${elapsedTime}ms`, 'info');
      return response.data.embedding;
    } catch (apiError: any) {
      // 处理API调用错误
      log(`[flask_embedding] API调用出错: ${apiError}`, 'error');
      
      // 如果是连接问题，尝试重启服务
      if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ETIMEDOUT') {
        log(`[flask_embedding] 连接嵌入服务失败: ${apiError.message}`, 'error');
        
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
      
      // 如果所有重试都失败，切换到直接模式
      log(`[flask_embedding] 所有API尝试失败，切换到直接模式`, 'warn');
      return await fallbackGenerateEmbedding(text);
    }
  } catch (error: any) {
    // 处理所有其他错误
    log(`[flask_embedding] 嵌入生成处理过程中发生严重错误: ${error}`, 'error');
    throw error;
  }
}

/**
 * 计算两个文本之间的相似度
 * @param text1 第一个文本
 * @param text2 第二个文本
 * @returns 相似度(0-1之间)
 */
/**
 * 使用本地计算相似度的备选方案
 * @param text1 第一个文本
 * @param text2 第二个文本
 * @returns 相似度(0-1之间)
 */
async function fallbackCalculateSimilarity(text1: string, text2: string): Promise<number> {
  try {
    log(`[flask_embedding] 使用本地相似度计算模式`, 'warn');
    
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
  } catch (error) {
    log(`[flask_embedding] 本地相似度计算出错: ${error}`, 'error');
    throw error;
  }
}

export async function calculateSimilarity(text1: string, text2: string): Promise<number> {
  try {
    // 确保文本不为空
    if (!text1 || !text2) {
      log(`[flask_embedding] 错误: 无效的文本内容`, 'error');
      throw new Error('无效的文本内容');
    }

    log(`[flask_embedding] 开始计算相似度，文本1长度: ${text1.length}, 文本2长度: ${text2.length}`, 'info');

    // 尝试使用Flask API计算相似度
    try {
      // 确保服务正在运行
      const serviceRunning = await ensureServiceRunning();
      if (!serviceRunning) {
        log(`[flask_embedding] 服务不可用，切换到本地相似度计算模式`, 'warn');
        return await fallbackCalculateSimilarity(text1, text2);
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
        // 切换到本地计算模式
        return await fallbackCalculateSimilarity(text1, text2);
      }

      log(`[flask_embedding] 相似度计算成功: ${response.data.similarity}, 耗时: ${elapsedTime}ms`, 'info');
      return response.data.similarity;
    } catch (apiError: any) {
      // 处理API调用错误
      log(`[flask_embedding] API调用出错: ${apiError}`, 'error');
      
      // 如果是连接问题，尝试重启服务
      if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ETIMEDOUT') {
        log(`[flask_embedding] 连接嵌入服务失败: ${apiError.message}`, 'error');
        
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
      }
      
      // 如果所有重试都失败，切换到本地计算模式
      log(`[flask_embedding] 所有API尝试失败，切换到本地相似度计算模式`, 'warn');
      return await fallbackCalculateSimilarity(text1, text2);
    }
  } catch (error: any) {
    // 处理所有其他错误
    log(`[flask_embedding] 相似度计算处理过程中发生严重错误: ${error}`, 'error');
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
