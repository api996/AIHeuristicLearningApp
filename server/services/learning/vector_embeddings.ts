/**
 * 向量嵌入服务
 * 负责生成和管理文本的向量表示
 * 集成内容价值评估，避免无价值内容向量化
 * 
 * 架构说明:
 * 1. 提供双语言实现的嵌入服务：
 *    - 首先尝试调用Python实现（基于Gemini API），稳定且扩展性好
 *    - 出错时回退到JS实现（也基于Gemini API），确保服务可用性
 * 2. 所有嵌入生成结果格式一致，确保不同语言实现的兼容性
 */

import { log } from "../../vite";
import { genAiService } from "../genai/genai_service";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";
import { webSearchService } from "../../services/web-search";
// 使用ESM兼容的方式导入child_process
import * as childProcess from 'child_process';

export class VectorEmbeddingsService {
  /**
   * 生成文本的向量嵌入
   * 首先尝试使用Python实现，出错时回退到JS实现
   * @param text 输入文本
   * @returns 向量嵌入
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        log('[vector_embeddings] 无法为空文本生成嵌入', 'warn');
        return null;
      }

      // 清理文本，移除多余空白
      const cleanedText = text
        .replace(/\s+/g, ' ')
        .trim();

      // 截断文本，如果过长
      const truncatedText = cleanedText.length > 8000 
        ? cleanedText.substring(0, 8000)
        : cleanedText;
      
      try {
        // 首先尝试使用Python嵌入服务API生成嵌入向量
        log('[vector_embeddings] 尝试使用Python嵌入服务生成向量...', 'info');
        const pythonCommand = `
from services.embedding import embedding_service
import asyncio
import json
import sys

async def get_embedding():
    texts = ["${truncatedText.replace(/"/g, '\\"')}"]
    embeddings = await embedding_service.get_embeddings(texts)
    if embeddings and len(embeddings) > 0:
        print(json.dumps(embeddings[0]))
    else:
        print("null")

asyncio.run(get_embedding())
`;

        // 使用ESM兼容的方式执行Python代码
        const embedding = await new Promise<number[] | null>((resolve, reject) => {
          // 使用Python执行代码
          const pythonProcess = childProcess.exec('python -c \'' + pythonCommand + '\'', {
            cwd: '.',  // 使用当前工作目录
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
          });
          
          let output = '';
          
          if (pythonProcess.stdout) {
            pythonProcess.stdout.on('data', (data: Buffer) => {
              output += data.toString();
            });
          } else {
            log('[vector_embeddings] 警告: 无法获取Python进程的标准输出，将使用JS实现', 'warn');
            // 如果无法获取输出，使用JS实现
            genAiService.generateEmbedding(truncatedText).then(resolve).catch(reject);
            return;
          }
          
          pythonProcess.on('close', (code: number) => {
            if (code !== 0) {
              log('[vector_embeddings] Python嵌入服务执行失败，将使用JS实现', 'warn');
              // 如果Python服务失败，回退到JS实现
              genAiService.generateEmbedding(truncatedText).then(resolve).catch(reject);
              return;
            }
            
            try {
              // 解析Python输出的JSON
              const result = JSON.parse(output.trim());
              resolve(result);
            } catch (parseError) {
              log(`[vector_embeddings] 解析Python输出失败: ${parseError}，将使用JS实现`, 'warn');
              // 如果解析失败，回退到JS实现
              genAiService.generateEmbedding(truncatedText).then(resolve).catch(reject);
            }
          });
          
          pythonProcess.on('error', (err: Error) => {
            log(`[vector_embeddings] 执行Python失败: ${err}，将使用JS实现`, 'warn');
            // 如果执行失败，回退到JS实现
            genAiService.generateEmbedding(truncatedText).then(resolve).catch(reject);
          });
        });
        
        if (!embedding) {
          log('[vector_embeddings] Python服务返回空结果，将使用JS实现', 'warn');
          // 如果Python服务返回空结果，使用JS实现
          return await genAiService.generateEmbedding(truncatedText);
        }
        
        log(`[vector_embeddings] 向量嵌入生成成功，维度: ${embedding.length}`, 'info');
        return embedding;
      } catch (pythonError) {
        // 如果Python调用出错，使用JS实现
        log(`[vector_embeddings] Python嵌入调用出错: ${pythonError}，将使用JS实现`, 'warn');
        const embedding = await genAiService.generateEmbedding(truncatedText);
        
        if (!embedding) {
          log('[vector_embeddings] JS实现也返回空结果', 'error');
          return null;
        }
        
        log(`[vector_embeddings] 使用JS实现生成成功，维度: ${embedding.length}`, 'info');
        return embedding;
      }
    } catch (error) {
      log(`[vector_embeddings] 生成嵌入时出错: ${error}`, 'error');
      return null;
    }
  }

  /**
   * 为记忆生成并保存向量嵌入
   * @param memoryId 记忆ID
   * @param content 记忆内容
   * @param forceEmbed 是否强制生成嵌入，跳过内容价值评估
   * @returns 成功标志
   */
  async generateAndSaveEmbedding(
    memoryId: number | string, 
    content: string,
    forceEmbed: boolean = false
  ): Promise<boolean> {
    try {
      // 首先检查是否已有嵌入
      // 确保memoryId作为字符串传递给storage.getEmbeddingByMemoryId
      const memoryIdStr = String(memoryId);
      const existingEmbedding = await storage.getEmbeddingByMemoryId(memoryIdStr);
      if (existingEmbedding) {
        log(`[vector_embeddings] 记忆 ${memoryIdStr} 已有嵌入，跳过生成`, 'info');
        return true;
      }
      
      // 如果不是强制生成，进行内容价值评估
      if (!forceEmbed) {
        const shouldEmbed = await webSearchService.shouldVectorize(content);
        if (!shouldEmbed) {
          log(`[vector_embeddings] 记忆 ${memoryIdStr} 内容未通过价值评估，不生成嵌入`, 'info');
          return false;
        }
      }

      // 生成嵌入
      const embedding = await this.generateEmbedding(content);
      if (!embedding) {
        log(`[vector_embeddings] 记忆 ${memoryIdStr} 嵌入生成失败`, 'warn');
        return false;
      }

      // 保存嵌入
      await storage.saveMemoryEmbedding(memoryIdStr, embedding);
      log(`[vector_embeddings] 记忆 ${memoryIdStr} 的嵌入已保存`, 'info');
      
      return true;
    } catch (error) {
      log(`[vector_embeddings] 保存记忆嵌入时出错: ${error}`, 'error');
      return false;
    }
  }

  /**
   * 批量为记忆生成向量嵌入
   * @param memories 记忆对象数组
   * @param forceEmbed 是否强制生成嵌入，跳过内容价值评估
   * @returns 成功生成嵌入的记忆数量
   */
  async batchGenerateEmbeddings(
    memories: Memory[],
    forceEmbed: boolean = false
  ): Promise<number> {
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const memory of memories) {
      // 跳过空内容
      if (!memory.content || memory.content.trim().length === 0) {
        continue;
      }

      try {
        const success = await this.generateAndSaveEmbedding(memory.id, memory.content, forceEmbed);
        if (success) {
          successCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        log(`[vector_embeddings] 处理记忆 ${memory.id} 时出错: ${error}`, 'error');
        failedCount++;
      }
    }

    // 记录批量处理结果
    log(`[vector_embeddings] 批量处理完成: ${successCount}个成功, ${skippedCount}个跳过, ${failedCount}个失败`, 'info');
    
    return successCount;
  }

  /**
   * 查找与输入文本语义相似的记忆
   * @param userId 用户ID
   * @param text 查询文本
   * @param limit 最大结果数
   * @returns 相似记忆数组
   */
  async findSimilarMemories(userId: number, text: string, limit: number = 5): Promise<Memory[]> {
    try {
      // 生成查询文本的向量嵌入
      const queryEmbedding = await this.generateEmbedding(text);
      if (!queryEmbedding) {
        log('[vector_embeddings] 无法为查询生成嵌入', 'error');
        return [];
      }

      // 使用存储服务查找相似记忆
      const similarMemories = await storage.findSimilarMemories(userId, queryEmbedding, limit);
      return similarMemories;
    } catch (error) {
      log(`[vector_embeddings] 查找相似记忆时出错: ${error}`, 'error');
      return [];
    }
  }
}

// 导出服务实例
export const vectorEmbeddingsService = new VectorEmbeddingsService();