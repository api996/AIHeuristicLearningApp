/**
 * 学习记忆服务
 * 提供统一的记忆接口，支持文件系统和数据库双模式
 */

import { spawn } from 'child_process';
import { log } from '../../vite';
import { dbMemoryAdapter } from './db_memory_adapter';

// 存储模式枚举
export enum StorageMode {
  FILE_SYSTEM = 'file_system', // 文件系统模式
  DATABASE = 'database',       // 数据库模式
  HYBRID = 'hybrid'            // 混合模式（同时写入两处，但从数据库读取）
}

// 服务配置
interface MemoryServiceConfig {
  storageMode: StorageMode;
  enableMigration: boolean; // 是否允许文件迁移到数据库
}

/**
 * 记忆条目接口
 */
export interface MemoryItem {
  id?: string;
  content: string;
  type: string;
  timestamp: string;
  embedding?: number[];
  summary?: string;
  keywords?: string[];
}

/**
 * 记忆过滤条件
 */
export interface MemoryFilter {
  type?: string;
  startDate?: string;
  endDate?: string;
  keywords?: string[];
}

/**
 * 相似度检索选项
 */
export interface SimilarityOptions {
  limit?: number;
  minScore?: number;
}

/**
 * 学习记忆服务类
 */
export class MemoryService {
  private config: MemoryServiceConfig;
  
  constructor(config?: Partial<MemoryServiceConfig>) {
    this.config = {
      storageMode: StorageMode.HYBRID, // 默认使用混合模式
      enableMigration: true,
      ...config
    };
    
    log(`[MemoryService] 初始化，存储模式: ${this.config.storageMode}`);
  }
  
  /**
   * 设置存储模式
   */
  setStorageMode(mode: StorageMode): void {
    this.config.storageMode = mode;
    log(`[MemoryService] 存储模式已更改为: ${mode}`);
  }
  
  /**
   * 保存记忆
   */
  async saveMemory(
    userId: number, 
    content: string, 
    type: string = 'chat'
  ): Promise<string> {
    try {
      log(`[MemoryService] 保存记忆: 用户=${userId}, 内容长度=${content.length}, 类型=${type}`);
      
      // 获取内容的嵌入向量
      const embeddings = await this.getEmbeddings([content]);
      const embedding = embeddings[0];
      
      // 生成内容摘要和关键词
      const summary = this.generateContentSummary(content);
      const keywords = this.extractKeywords(content);
      
      // 根据存储模式选择存储方法
      if (this.config.storageMode === StorageMode.DATABASE) {
        // 仅使用数据库
        return await dbMemoryAdapter.saveMemory(
          userId,
          content,
          type,
          embedding,
          summary,
          keywords
        );
      } else if (this.config.storageMode === StorageMode.FILE_SYSTEM) {
        // 仅使用文件系统
        return await this.saveToFileSystem(userId, content, type, embedding, summary, keywords);
      } else {
        // 混合模式：同时保存到两处，但返回数据库的ID
        const fileId = await this.saveToFileSystem(userId, content, type, embedding, summary, keywords);
        const dbId = await dbMemoryAdapter.saveMemory(
          userId,
          content,
          type,
          embedding,
          summary,
          keywords
        );
        
        log(`[MemoryService] 混合存储：文件ID=${fileId}，数据库ID=${dbId}`);
        return dbId;
      }
    } catch (error) {
      log(`[MemoryService] 保存记忆出错: ${error}`);
      throw error;
    }
  }
  
  /**
   * 寻找相似记忆
   */
  async findSimilarMemories(
    query: string,
    userId: number,
    options: SimilarityOptions = {}
  ): Promise<MemoryItem[]> {
    try {
      log(`[MemoryService] 寻找相似记忆: 用户=${userId}, 查询长度=${query.length}`);
      
      // 获取查询的嵌入向量
      const embeddings = await this.getEmbeddings([query]);
      const queryEmbedding = embeddings[0];
      
      if (!queryEmbedding) {
        log(`[MemoryService] 无法获取查询的嵌入向量`);
        return [];
      }
      
      // 根据存储模式选择检索方法
      if (this.config.storageMode === StorageMode.FILE_SYSTEM) {
        // 仅使用文件系统
        return await this.findSimilarFromFileSystem(userId, query, queryEmbedding, options);
      } else {
        // 数据库或混合模式：从数据库检索
        return await dbMemoryAdapter.retrieveSimilarMemories(
          userId,
          queryEmbedding,
          options.limit || 5
        );
      }
    } catch (error) {
      log(`[MemoryService] 寻找相似记忆出错: ${error}`);
      return [];
    }
  }
  
  /**
   * 根据过滤条件获取记忆
   */
  async getMemoriesByFilter(
    userId: number,
    filter: MemoryFilter = {}
  ): Promise<MemoryItem[]> {
    try {
      log(`[MemoryService] 获取记忆列表: 用户=${userId}, 过滤条件=${JSON.stringify(filter)}`);
      
      // 根据存储模式选择检索方法
      if (this.config.storageMode === StorageMode.FILE_SYSTEM) {
        // 仅使用文件系统
        return await this.getMemoriesFromFileSystem(userId, filter);
      } else {
        // 数据库或混合模式：从数据库检索
        // 目前没有实现过滤条件，返回所有记忆
        return await dbMemoryAdapter.getAllMemories(userId);
      }
    } catch (error) {
      log(`[MemoryService] 获取记忆列表出错: ${error}`);
      return [];
    }
  }
  
  /**
   * 执行记忆迁移
   */
  async migrateMemories(): Promise<boolean> {
    if (!this.config.enableMigration) {
      log(`[MemoryService] 迁移功能已禁用`);
      return false;
    }
    
    try {
      log(`[MemoryService] 开始执行记忆迁移...`);
      
      return new Promise<boolean>((resolve, reject) => {
        const process = spawn('tsx', ['scripts/run_memory_migration.ts']);
        
        process.stdout.on('data', (data) => {
          log(`[MemoryMigration] ${data.toString().trim()}`);
        });
        
        process.stderr.on('data', (data) => {
          log(`[MemoryMigration Error] ${data.toString().trim()}`);
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            log(`[MemoryService] 记忆迁移成功完成`);
            resolve(true);
          } else {
            log(`[MemoryService] 记忆迁移失败，退出码: ${code}`);
            resolve(false);
          }
        });
        
        process.on('error', (err) => {
          log(`[MemoryService] 启动迁移脚本错误: ${err.message}`);
          reject(err);
        });
      });
    } catch (error) {
      log(`[MemoryService] 执行记忆迁移出错: ${error}`);
      return false;
    }
  }
  
  // ---- 私有方法 ----
  
  /**
   * 获取嵌入向量
   */
  private async getEmbeddings(texts: string[]): Promise<number[][]> {
    return new Promise<number[][]>((resolve, reject) => {
      try {
        // 调用Python服务获取嵌入向量
        const process = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.embedding import embedding_service

async def get_embeddings():
    texts = ${JSON.stringify(texts)}
    embeddings = await embedding_service.get_embeddings(texts)
    print(json.dumps(embeddings))

asyncio.run(get_embeddings())
        `]);
        
        let output = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          log(`[嵌入向量错误] ${data.toString().trim()}`);
        });
        
        process.on('close', (code) => {
          if (code === 0 && output) {
            try {
              const embeddings = JSON.parse(output.trim());
              resolve(embeddings);
            } catch (e) {
              log(`解析嵌入向量结果出错: ${e}, 输出内容: ${output}`);
              // 返回随机向量作为替代
              resolve(texts.map(() => this.generateRandomVector(384)));
            }
          } else {
            log(`获取嵌入向量失败，退出码: ${code}`);
            // 返回随机向量作为替代
            resolve(texts.map(() => this.generateRandomVector(384)));
          }
        });
      } catch (error) {
        log(`获取嵌入向量过程出错: ${error}`);
        // 返回随机向量作为替代
        resolve(texts.map(() => this.generateRandomVector(384)));
      }
    });
  }
  
  /**
   * 生成随机向量（作为嵌入API失败时的替代）
   */
  private generateRandomVector(dimensions: number): number[] {
    return Array.from({ length: dimensions }, () => Math.random() * 0.02 - 0.01);
  }
  
  /**
   * 生成内容摘要
   */
  private generateContentSummary(content: string): string {
    // 简单摘要生成：取前100个字符加省略号
    return content.length > 100
      ? content.substring(0, 100) + '...'
      : content;
  }
  
  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    // 简单关键词提取：使用常见分隔符分割并过滤常见停用词
    const stopWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', 'the', 'and', 'of', 'to', 'a', 'in', 'for', 'is', 'on', 'that', 'by', 'this', 'with', 'i', 'you', 'it'];
    const words = content.split(/\s+|,|\.|\?|!|:|;|、|，|。|？|！|：|；/)
      .map(word => word.toLowerCase().trim())
      .filter(word => word.length > 1 && !stopWords.includes(word));
    
    // 计算词频并取前10个
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
  }
  
  /**
   * 保存记忆到文件系统
   */
  private async saveToFileSystem(
    userId: number,
    content: string,
    type: string,
    embedding?: number[],
    summary?: string,
    keywords?: string[]
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        // 调用Python服务保存记忆
        const process = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def save():
    memory_data = {
        "content": """${content.replace(/"/g, '\\"')}""",
        "type": "${type}",
        "embedding": ${JSON.stringify(embedding)},
        "summary": """${summary?.replace(/"/g, '\\"') || ''}""",
        "keywords": ${JSON.stringify(keywords)}
    }
    
    file_id = await learning_memory_service.save_memory_with_data(${userId}, memory_data)
    print(file_id)

asyncio.run(save())
        `]);
        
        let output = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          log(`[文件系统存储错误] ${data.toString().trim()}`);
        });
        
        process.on('close', (code) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            log(`保存到文件系统失败，退出码: ${code}`);
            reject(new Error(`保存到文件系统失败，退出码: ${code}`));
          }
        });
      } catch (error) {
        log(`保存到文件系统过程出错: ${error}`);
        reject(error);
      }
    });
  }
  
  /**
   * 从文件系统中寻找相似记忆
   */
  private async findSimilarFromFileSystem(
    userId: number,
    query: string,
    queryEmbedding: number[],
    options: SimilarityOptions
  ): Promise<MemoryItem[]> {
    return new Promise<MemoryItem[]>((resolve, reject) => {
      try {
        // 调用Python服务检索相似记忆
        const process = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def find_similar():
    memories = await learning_memory_service.retrieve_similar_memories_by_embedding(
        ${userId},
        ${JSON.stringify(queryEmbedding)},
        ${options.limit || 5}
    )
    print("JSON_RESULT_BEGIN")
    print(json.dumps(memories))
    print("JSON_RESULT_END")

asyncio.run(find_similar())
        `]);
        
        let output = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          log(`[文件系统检索错误] ${data.toString().trim()}`);
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            try {
              // 从输出中提取JSON结果
              const resultMatch = output.match(/JSON_RESULT_BEGIN\s*([\s\S]*?)\s*JSON_RESULT_END/);
              if (resultMatch && resultMatch[1]) {
                const memories = JSON.parse(resultMatch[1].trim());
                resolve(memories);
              } else {
                log(`未找到JSON结果标记，原始输出: ${output}`);
                resolve([]);
              }
            } catch (e) {
              log(`解析文件系统检索结果出错: ${e}`);
              resolve([]);
            }
          } else {
            log(`从文件系统检索失败，退出码: ${code}`);
            resolve([]);
          }
        });
      } catch (error) {
        log(`从文件系统检索过程出错: ${error}`);
        resolve([]);
      }
    });
  }
  
  /**
   * 从文件系统中获取记忆列表
   */
  private async getMemoriesFromFileSystem(
    userId: number,
    filter: MemoryFilter
  ): Promise<MemoryItem[]> {
    return new Promise<MemoryItem[]>((resolve, reject) => {
      try {
        // 调用Python服务获取记忆列表
        const process = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def get_memories():
    memories = await learning_memory_service.get_memories_by_filter(
        ${userId},
        ${JSON.stringify(filter)}
    )
    print("JSON_RESULT_BEGIN")
    print(json.dumps(memories))
    print("JSON_RESULT_END")

asyncio.run(get_memories())
        `]);
        
        let output = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          log(`[文件系统列表错误] ${data.toString().trim()}`);
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            try {
              // 从输出中提取JSON结果
              const resultMatch = output.match(/JSON_RESULT_BEGIN\s*([\s\S]*?)\s*JSON_RESULT_END/);
              if (resultMatch && resultMatch[1]) {
                const memories = JSON.parse(resultMatch[1].trim());
                resolve(memories);
              } else {
                log(`未找到JSON结果标记，原始输出: ${output}`);
                resolve([]);
              }
            } catch (e) {
              log(`解析文件系统列表结果出错: ${e}`);
              resolve([]);
            }
          } else {
            log(`从文件系统获取列表失败，退出码: ${code}`);
            resolve([]);
          }
        });
      } catch (error) {
        log(`从文件系统获取列表过程出错: ${error}`);
        resolve([]);
      }
    });
  }
}

// 导出单例
export const memoryService = new MemoryService();