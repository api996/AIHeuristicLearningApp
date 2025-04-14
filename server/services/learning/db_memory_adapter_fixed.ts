/**
 * 数据库记忆适配器
 * 为学习记忆服务提供数据库存储支持，并保持与文件系统API兼容
 */

import { storage } from '../../storage';
import { log } from '../../vite';

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
  userId?: number; // 添加userId字段以兼容clusterMemories的需求
}

/**
 * 数据库记忆适配器类
 * 提供与文件系统记忆API兼容的接口，但使用数据库存储
 */
export class DbMemoryAdapter {
  /**
   * 保存记忆到数据库
   * 
   * @param userId 用户ID
   * @param content 记忆内容
   * @param type 记忆类型
   * @param embedding 嵌入向量
   * @param summary 内容摘要
   * @param keywords 关键词列表
   * @returns 记忆ID
   */
  async saveMemory(
    userId: number, 
    content: string, 
    type: string = 'chat',
    embedding?: number[],
    summary?: string,
    keywords?: string[]
  ): Promise<string> {
    try {
      log(`[DbMemoryAdapter] 保存记忆: 用户=${userId}, 内容长度=${content.length}, 类型=${type}`);
      
      // 创建记忆记录
      const memory = await storage.createMemory(userId, content, type, summary);
      
      // 保存关键词
      if (keywords && Array.isArray(keywords)) {
        for (const keyword of keywords) {
          if (keyword && typeof keyword === 'string') {
            await storage.addKeywordToMemory(memory.id, keyword);
          }
        }
        log(`[DbMemoryAdapter] 添加了 ${keywords.length} 个关键词`);
      }
      
      // 保存嵌入向量
      if (embedding && Array.isArray(embedding)) {
        await storage.saveMemoryEmbedding(memory.id, embedding);
        log(`[DbMemoryAdapter] 添加了嵌入向量 (${embedding.length} 维)`);
      }
      
      return memory.id.toString();
    } catch (error) {
      log(`[DbMemoryAdapter] 保存记忆出错: ${error}`);
      throw error;
    }
  }

  /**
   * 检索相似记忆
   * 
   * @param userId 用户ID
   * @param queryEmbedding 查询嵌入向量
   * @param limit 返回记录数量限制
   * @returns 相似记忆列表
   */
  async retrieveSimilarMemories(
    userId: number, 
    queryEmbedding: number[], 
    limit: number = 5
  ): Promise<MemoryItem[]> {
    try {
      log(`[DbMemoryAdapter] 检索相似记忆: 用户=${userId}, 向量维度=${queryEmbedding.length}, 限制=${limit}`);
      
      // 从数据库查找相似记忆
      const memories = await storage.findSimilarMemories(userId, queryEmbedding, limit);
      
      // 转换为期望的返回格式
      const result: MemoryItem[] = [];
      
      for (const memory of memories) {
        // 获取关键词
        const keywordRecords = await storage.getKeywordsByMemoryId(memory.id);
        const keywords = keywordRecords.map(kr => kr.keyword);
        
        // 获取嵌入向量
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        
        // 构造记忆项，安全处理时间戳
        const memoryItem: MemoryItem = {
          id: memory.id.toString(),
          content: memory.content,
          type: memory.type,
          timestamp: memory.timestamp ? memory.timestamp.toISOString() : new Date().toISOString(),
          summary: memory.summary || undefined,
          keywords: keywords,
          embedding: embedding ? (embedding.vectorData as number[]) : undefined,
          userId: memory.userId // 添加userId
        };
        
        result.push(memoryItem);
      }
      
      log(`[DbMemoryAdapter] 找到 ${result.length} 个相似记忆`);
      return result;
    } catch (error) {
      log(`[DbMemoryAdapter] 检索相似记忆出错: ${error}`);
      return [];
    }
  }

  /**
   * 获取用户的所有记忆
   * 
   * @param userId 用户ID
   * @returns 记忆列表
   */
  async getAllMemories(userId: number): Promise<MemoryItem[]> {
    try {
      log(`[DbMemoryAdapter] 获取所有记忆: 用户=${userId}`);
      
      // 获取用户所有记忆
      const memories = await storage.getMemoriesByUserId(userId);
      
      // 转换为期望的返回格式
      const result: MemoryItem[] = [];
      
      for (const memory of memories) {
        // 获取关键词
        const keywordRecords = await storage.getKeywordsByMemoryId(memory.id);
        const keywords = keywordRecords.map(kr => kr.keyword);
        
        // 获取嵌入向量
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        
        // 构造记忆项，安全处理时间戳
        const memoryItem: MemoryItem = {
          id: memory.id.toString(),
          content: memory.content,
          type: memory.type,
          timestamp: memory.timestamp ? memory.timestamp.toISOString() : new Date().toISOString(),
          summary: memory.summary || undefined,
          keywords: keywords,
          embedding: embedding ? (embedding.vectorData as number[]) : undefined,
          userId: memory.userId // 添加userId
        };
        
        result.push(memoryItem);
      }
      
      log(`[DbMemoryAdapter] 找到 ${result.length} 个记忆`);
      return result;
    } catch (error) {
      log(`[DbMemoryAdapter] 获取所有记忆出错: ${error}`);
      return [];
    }
  }

  /**
   * 更新记忆
   * 
   * @param userId 用户ID
   * @param memoryId 记忆ID
   * @param updates 更新内容
   * @returns 成功与否
   */
  async updateMemory(
    userId: number,
    memoryId: string,
    updates: Partial<MemoryItem>
  ): Promise<boolean> {
    try {
      const id = parseInt(memoryId, 10);
      if (isNaN(id)) {
        log(`[DbMemoryAdapter] 无效的记忆ID: ${memoryId}`);
        return false;
      }
      
      log(`[DbMemoryAdapter] 更新记忆: ID=${memoryId}`);
      
      // 获取原记忆以确认所有权
      const memory = await storage.getMemoryById(id);
      if (!memory || memory.userId !== userId) {
        log(`[DbMemoryAdapter] 记忆不存在或不属于用户: ${memoryId}`);
        return false;
      }
      
      // 更新内容和摘要
      if (updates.content || updates.summary) {
        await storage.updateMemory(id, updates.content, updates.summary);
      }
      
      // 更新关键词
      if (updates.keywords) {
        // 删除旧关键词
        await storage.deleteKeywordsByMemoryId(id);
        
        // 添加新关键词
        for (const keyword of updates.keywords) {
          if (keyword && typeof keyword === 'string') {
            await storage.addKeywordToMemory(id, keyword);
          }
        }
      }
      
      // 更新嵌入向量
      if (updates.embedding) {
        await storage.saveMemoryEmbedding(id, updates.embedding);
      }
      
      return true;
    } catch (error) {
      log(`[DbMemoryAdapter] 更新记忆出错: ${error}`);
      return false;
    }
  }

  /**
   * 删除记忆
   * 
   * @param userId 用户ID
   * @param memoryId 记忆ID
   * @returns 成功与否
   */
  async deleteMemory(userId: number, memoryId: string): Promise<boolean> {
    try {
      const id = parseInt(memoryId, 10);
      if (isNaN(id)) {
        log(`[DbMemoryAdapter] 无效的记忆ID: ${memoryId}`);
        return false;
      }
      
      log(`[DbMemoryAdapter] 删除记忆: ID=${memoryId}`);
      
      // 获取原记忆以确认所有权
      const memory = await storage.getMemoryById(id);
      if (!memory || memory.userId !== userId) {
        log(`[DbMemoryAdapter] 记忆不存在或不属于用户: ${memoryId}`);
        return false;
      }
      
      // 删除记忆及其相关数据
      await storage.deleteMemory(id);
      
      return true;
    } catch (error) {
      log(`[DbMemoryAdapter] 删除记忆出错: ${error}`);
      return false;
    }
  }
}

// 导出单例
export const dbMemoryAdapter = new DbMemoryAdapter();