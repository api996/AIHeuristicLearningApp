/**
 * Flask嵌入API客户端
 * 使用HTTP调用Python嵌入服务，避免命令行参数限制问题
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
 * 调用嵌入API生成文本的向量嵌入
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

    // 确保服务已启动
    const serviceReady = await ensureServiceRunning();
    if (!serviceReady) {
      log(`[flask_embedding] 错误: 无法启动嵌入API服务`, 'error');
      throw new Error('无法启动嵌入API服务');
    }

    // 准备请求数据
    const requestData = { text };

    // 发起API请求
    log(`[flask_embedding] 发送嵌入请求，文本长度: ${text.length}`, 'info');
    const startTime = Date.now();
    
    const response = await axios.post(`${DEFAULT_API_URL}/api/embed`, requestData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000 // 30秒超时，考虑大文本处理需要时间
    });

    const elapsedTime = Date.now() - startTime;
    log(`[flask_embedding] 嵌入请求完成，耗时: ${elapsedTime}ms`, 'info');

    if (response.status !== 200) {
      log(`[flask_embedding] API请求失败，状态码: ${response.status}`, 'error');
      throw new Error(`API请求失败，状态码: ${response.status}`);
    }

    const result = response.data;
    if (!result.success || !result.embedding || !Array.isArray(result.embedding)) {
      log(`[flask_embedding] API返回无效结果: ${JSON.stringify(result)}`, 'error');
      throw new Error('API返回无效结果');
    }

    const embedding = result.embedding;
    log(`[flask_embedding] 嵌入生成成功，维度: ${embedding.length}`, 'info');

    return embedding;
  } catch (error) {
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

    // 确保服务已启动
    const serviceReady = await ensureServiceRunning();
    if (!serviceReady) {
      log(`[flask_embedding] 错误: 无法启动嵌入API服务`, 'error');
      throw new Error('无法启动嵌入API服务');
    }

    // 准备请求数据
    const requestData = { text1, text2 };

    // 发起API请求
    log(`[flask_embedding] 发送相似度请求`, 'info');
    const startTime = Date.now();
    
    const response = await axios.post(`${DEFAULT_API_URL}/api/similarity`, requestData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000 // 30秒超时
    });

    const elapsedTime = Date.now() - startTime;
    log(`[flask_embedding] 相似度请求完成，耗时: ${elapsedTime}ms`, 'info');

    if (response.status !== 200) {
      log(`[flask_embedding] API请求失败，状态码: ${response.status}`, 'error');
      throw new Error(`API请求失败，状态码: ${response.status}`);
    }

    const result = response.data;
    if (!result.success || typeof result.similarity !== 'number') {
      log(`[flask_embedding] API返回无效结果: ${JSON.stringify(result)}`, 'error');
      throw new Error('API返回无效结果');
    }

    log(`[flask_embedding] 相似度计算成功: ${result.similarity}`, 'info');
    return result.similarity;
  } catch (error) {
    log(`[flask_embedding] 相似度计算出错: ${error}`, 'error');
    throw error;
  }
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