/**
 * Python嵌入服务接口
 * 现在使用Flask API服务进行向量嵌入
 * 所有向量嵌入操作将统一调用HTTP API而不是命令行
 */

import { log } from "../../vite";
import { generateEmbedding, calculateSimilarity, startEmbeddingService } from "./flask_embedding_service";

export class PythonEmbeddingService {
  constructor() {
    log(`[PythonEmbedding] 初始化服务，使用Flask API`, "info");
    
    // 尝试启动Flask嵌入服务（异步启动）
    this.ensureServiceRunning().catch(err => {
      log(`[PythonEmbedding] 嵌入服务自动启动失败: ${err}`, "warn");
    });
  }

  /**
   * 确保服务正在运行
   */
  private async ensureServiceRunning(): Promise<void> {
    try {
      log(`[PythonEmbedding] 尝试启动Flask嵌入服务...`, "info");
      const success = await startEmbeddingService();
      
      if (success) {
        log(`[PythonEmbedding] Flask嵌入服务启动成功`, "info");
      } else {
        log(`[PythonEmbedding] Flask嵌入服务启动失败，将在首次调用时重试`, "warn");
      }
    } catch (error) {
      log(`[PythonEmbedding] 启动Flask嵌入服务出错: ${error}`, "error");
    }
  }

  /**
   * 获取文本的向量嵌入，调用Flask API
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
      log(`[PythonEmbedding] 通过Flask API生成嵌入，文本长度: ${text.length}`, "info");
      
      // 调用Flask API服务
      const embedding = await generateEmbedding(text.trim());
      
      // 验证向量维度
      const expectedDimension = 3072;
      if (embedding.length !== expectedDimension) {
        const errorMsg = `[PythonEmbedding] 嵌入维度异常: 实际${embedding.length}维, 期望${expectedDimension}维`;
        log(errorMsg, "error");
        throw new Error(errorMsg);
      }

      log(`[PythonEmbedding] 成功生成${embedding.length}维向量嵌入`, "info");
      return embedding;
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
      log(`[PythonEmbedding] 通过Flask API计算相似度`, "info");
      
      // 调用Flask API服务
      const similarity = await calculateSimilarity(text1.trim(), text2.trim());
      
      log(`[PythonEmbedding] 相似度计算成功: ${similarity}`, "info");
      return similarity;
    } catch (error) {
      const errorMsg = `[PythonEmbedding] 计算相似度时出错: ${error}`;
      log(errorMsg, "error");
      throw new Error(errorMsg);
    }
  }
}

// 导出服务实例
export const pythonEmbeddingService = new PythonEmbeddingService();