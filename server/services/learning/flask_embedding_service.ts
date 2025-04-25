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
 * 直接调用Python嵌入脚本生成文本的向量嵌入
 * Replit环境中，直接调用Python脚本更可靠，避免维护长时间运行的服务
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

    // 直接运行Python嵌入脚本
    return new Promise<number[]>(async (resolve, reject) => {
      try {
        // 准备临时文件存储文本内容，避免命令行参数长度限制
        const tempDir = path.join(os.tmpdir(), 'ai-embeddings');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 创建唯一的临时文件名
        const tempFilePath = path.join(tempDir, `text_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.txt`);
        const outputFilePath = path.join(tempDir, `embedding_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.json`);
        
        // 将文本写入临时文件
        fs.writeFileSync(tempFilePath, text);
        
        // 确定Python脚本路径
        const scriptDir = path.join(__dirname, '../api/embedding');
        const scriptPath = path.join(scriptDir, 'direct_embed.py');
        
        // 如果direct_embed.py不存在，创建它
        if (!fs.existsSync(scriptPath)) {
          log(`[flask_embedding] 创建直接嵌入脚本: ${scriptPath}`, 'info');
          const scriptContent = `#!/usr/bin/env python3
"""
直接嵌入脚本 - 读取文本文件，生成嵌入，将结果写入JSON文件
"""

import sys
import os
import json
import traceback

# 添加父目录到系统路径
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.append(parent_dir)

# 导入嵌入服务
try:
    from services.embedding import EmbeddingService
    embedding_service = EmbeddingService()
    
    # 检查命令行参数
    if len(sys.argv) != 3:
        print("错误: 需要两个参数: 输入文件路径和输出文件路径")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # 检查文件是否存在
    if not os.path.exists(input_file):
        print(f"错误: 找不到输入文件 {input_file}")
        sys.exit(1)
    
    # 读取文本内容
    with open(input_file, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # 生成嵌入
    embedding = embedding_service.embed_single_text(text)
    
    # 将结果写入输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "success": True,
            "embedding": embedding,
            "dimensions": len(embedding)
        }, f)
    
    print(f"嵌入生成成功，维度: {len(embedding)}")
    sys.exit(0)
    
except Exception as e:
    traceback.print_exc()
    
    # 写入错误信息到输出文件
    try:
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            json.dump({
                "success": False,
                "error": str(e)
            }, f)
    except:
        pass
    
    print(f"错误: {e}")
    sys.exit(1)
`;
          fs.writeFileSync(scriptPath, scriptContent);
          // 确保脚本有执行权限
          try {
            fs.chmodSync(scriptPath, 0o755);
          } catch (error) {
            log(`[flask_embedding] 警告: 无法设置脚本执行权限: ${error}`, 'warn');
          }
        }
        
        // 设置超时，确保不会无限等待
        const timeout = setTimeout(() => {
          log(`[flask_embedding] 警告: 生成嵌入超时`, 'warn');
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
          } catch (error) {
            log(`[flask_embedding] 清理临时文件失败: ${error}`, 'error');
          }
          reject(new Error('生成嵌入超时'));
        }, 30000);
        
        log(`[flask_embedding] 执行直接嵌入脚本: ${scriptPath}`, 'info');
        
        // 执行Python脚本
        const pythonPathEnv: string = process.env.PYTHON_PATH || 'python3';
        const startTime = Date.now();
        
        const pyProcess = spawn(pythonPathEnv, [scriptPath, tempFilePath, outputFilePath], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let stdoutData = '';
        let stderrData = '';
        
        pyProcess.stdout.on('data', (data: Buffer) => {
          stdoutData += data.toString();
          log(`[flask_embedding] ${data.toString().trim()}`, 'info');
        });
        
        pyProcess.stderr.on('data', (data: Buffer) => {
          stderrData += data.toString();
          log(`[flask_embedding] 错误: ${data.toString().trim()}`, 'error');
        });
        
        pyProcess.on('close', (code: number) => {
          clearTimeout(timeout);
          const elapsedTime = Date.now() - startTime;
          
          if (code !== 0) {
            log(`[flask_embedding] 脚本执行失败，退出码: ${code}, 耗时: ${elapsedTime}ms`, 'error');
            log(`[flask_embedding] 错误输出: ${stderrData}`, 'error');
            
            try {
              if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            } catch (error) {
              log(`[flask_embedding] 清理临时文件失败: ${error}`, 'error');
            }
            
            // 尝试从输出文件读取更详细的错误信息
            try {
              if (fs.existsSync(outputFilePath)) {
                const errorResult = JSON.parse(fs.readFileSync(outputFilePath, 'utf-8'));
                fs.unlinkSync(outputFilePath);
                
                if (errorResult.error) {
                  reject(new Error(`嵌入生成失败: ${errorResult.error}`));
                  return;
                }
              }
            } catch (error) {
              log(`[flask_embedding] 读取错误输出失败: ${error}`, 'error');
            }
            
            reject(new Error(`脚本执行失败，退出码: ${code}`));
            return;
          }
          
          // 从输出文件读取结果
          try {
            if (fs.existsSync(outputFilePath)) {
              const result = JSON.parse(fs.readFileSync(outputFilePath, 'utf-8'));
              
              // 清理临时文件
              try {
                fs.unlinkSync(tempFilePath);
                fs.unlinkSync(outputFilePath);
              } catch (error) {
                log(`[flask_embedding] 清理临时文件失败: ${error}`, 'error');
              }
              
              if (!result.success || !result.embedding || !Array.isArray(result.embedding)) {
                log(`[flask_embedding] 脚本返回无效结果: ${JSON.stringify(result)}`, 'error');
                reject(new Error('脚本返回无效结果'));
                return;
              }
              
              log(`[flask_embedding] 嵌入生成成功，维度: ${result.dimensions}, 耗时: ${elapsedTime}ms`, 'info');
              resolve(result.embedding);
            } else {
              log(`[flask_embedding] 输出文件不存在: ${outputFilePath}`, 'error');
              
              // 清理临时文件
              try {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
              } catch (error) {
                log(`[flask_embedding] 清理临时文件失败: ${error}`, 'error');
              }
              
              reject(new Error('输出文件不存在'));
            }
          } catch (error) {
            log(`[flask_embedding] 处理输出文件时出错: ${error}`, 'error');
            
            // 清理临时文件
            try {
              if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
              if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
            } catch (cleanError) {
              log(`[flask_embedding] 清理临时文件失败: ${cleanError}`, 'error');
            }
            
            reject(error);
          }
        });
      } catch (error) {
        log(`[flask_embedding] 执行脚本时出错: ${error}`, 'error');
        reject(error);
      }
    });
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

    // 首先生成两个文本的嵌入
    log(`[flask_embedding] 生成第一个文本的嵌入`, 'info');
    const embedding1 = await generateEmbedding(text1);
    
    log(`[flask_embedding] 生成第二个文本的嵌入`, 'info');
    const embedding2 = await generateEmbedding(text2);
    
    // 计算余弦相似度
    log(`[flask_embedding] 计算余弦相似度`, 'info');
    const similarity = cosineSimilarity(embedding1, embedding2);
    
    log(`[flask_embedding] 相似度计算成功: ${similarity}`, 'info');
    return similarity;
  } catch (error) {
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