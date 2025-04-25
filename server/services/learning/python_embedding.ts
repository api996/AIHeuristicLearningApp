/**
 * Python嵌入服务接口
 * 这个文件作为JavaScript到Python嵌入服务的桥接器
 * 所有向量嵌入操作将统一调用Python实现
 */

import { log } from "../../vite";
import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from 'url';

interface EmbeddingResponse {
  embedding: number[];
  error?: string;
}

export class PythonEmbeddingService {
  private pythonScriptPath: string;

  constructor() {
    // 在ES模块中获取当前文件的目录
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Python脚本的相对路径 - 从当前目录向上两级，再进入services目录
    this.pythonScriptPath = path.join(__dirname, "../../services/embedding.py");
    log(`[PythonEmbedding] 初始化服务，脚本路径: ${this.pythonScriptPath}`, "info");
  }

  /**
   * 获取文本的向量嵌入，调用Python实现
   * @param text 文本
   * @returns 嵌入向量，失败会抛出错误
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      const errorMsg = "[PythonEmbedding] 无法为空文本生成嵌入";
      log(errorMsg, "warn");
      throw new Error(errorMsg);
    }

    try {
      // 准备输入数据
      const inputData = {
        text: text.trim(),
        operation: "embed"
      };

      // 调用Python脚本
      const result = await this.callPythonScript(inputData);
      
      if (result.error || !result.embedding || !Array.isArray(result.embedding)) {
        const errorMsg = `[PythonEmbedding] 嵌入生成失败: ${result.error || "无效响应"}`;
        log(errorMsg, "error");
        throw new Error(errorMsg);
      }

      // 验证向量维度
      const expectedDimension = 3072;
      if (result.embedding.length !== expectedDimension) {
        const errorMsg = `[PythonEmbedding] 嵌入维度异常: 实际${result.embedding.length}维, 期望${expectedDimension}维`;
        log(errorMsg, "error");
        throw new Error(errorMsg);
      }

      log(`[PythonEmbedding] 成功生成${result.embedding.length}维向量嵌入`, "info");
      return result.embedding;
    } catch (error) {
      const errorMsg = `[PythonEmbedding] 生成嵌入时出错: ${error}`;
      log(errorMsg, "error");
      throw new Error(errorMsg);
    }
  }

  /**
   * 计算两个文本之间的相似度
   * @param text1 第一个文本
   * @param text2 第二个文本
   * @returns 相似度（0到1之间）
   * @throws 如果计算失败则抛出错误
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    if (!text1 || !text2) {
      const errorMsg = "[PythonEmbedding] 无法计算空文本的相似度";
      log(errorMsg, "warn");
      throw new Error(errorMsg);
    }

    try {
      // 准备输入数据
      const inputData = {
        text1: text1.trim(),
        text2: text2.trim(),
        operation: "similarity"
      };

      // 调用Python脚本
      const result = await this.callPythonScript(inputData);
      
      if (result.error || typeof result.similarity !== 'number') {
        const errorMsg = `[PythonEmbedding] 相似度计算失败: ${result.error || "无效响应"}`;
        log(errorMsg, "error");
        throw new Error(errorMsg);
      }

      return result.similarity;
    } catch (error) {
      const errorMsg = `[PythonEmbedding] 计算相似度时出错: ${error}`;
      log(errorMsg, "error");
      throw new Error(errorMsg);
    }
  }

  /**
   * 调用Python脚本并获取结果
   * @param data 要传递给Python脚本的数据
   * @returns 脚本的JSON响应
   */
  private callPythonScript(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // 启动Python进程
        const pythonProcess = spawn("python3", ["-u", this.pythonScriptPath]);
        
        let outputData = "";
        let errorData = "";

        // 收集输出
        pythonProcess.stdout.on("data", (data) => {
          outputData += data.toString();
        });

        // 收集错误信息
        pythonProcess.stderr.on("data", (data) => {
          errorData += data.toString();
          log(`[PythonEmbedding] Python错误输出: ${data.toString().trim()}`, "error");
        });

        // 处理进程结束
        pythonProcess.on("close", (code) => {
          if (code !== 0) {
            const errorMsg = `[PythonEmbedding] Python进程异常退出，代码: ${code}: ${errorData}`;
            log(errorMsg, "error");
            return reject(new Error(errorMsg));
          }

          try {
            // 尝试解析JSON输出
            const jsonStart = outputData.indexOf("{");
            const jsonEnd = outputData.lastIndexOf("}");
            
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const jsonStr = outputData.substring(jsonStart, jsonEnd + 1);
              const result = JSON.parse(jsonStr);
              
              // 检查返回结果中是否有错误信息
              if (result.error) {
                const errorMsg = `[PythonEmbedding] Python脚本返回错误: ${result.error}`;
                log(errorMsg, "error");
                return reject(new Error(errorMsg));
              }
              
              return resolve(result);
            } else {
              const errorMsg = `[PythonEmbedding] 无法解析Python响应: ${outputData}`;
              log(errorMsg, "error");
              return reject(new Error(errorMsg));
            }
          } catch (parseError) {
            const errorMsg = `[PythonEmbedding] 解析Python输出失败: ${parseError}`;
            log(errorMsg, "error");
            return reject(new Error(errorMsg));
          }
        });

        // 发送输入数据到Python进程
        pythonProcess.stdin.write(JSON.stringify(data));
        pythonProcess.stdin.end();
      } catch (error) {
        log(`[PythonEmbedding] 调用Python脚本失败: ${error}`, "error");
        reject(error);
      }
    });
  }
}

// 导出服务实例
export const pythonEmbeddingService = new PythonEmbeddingService();