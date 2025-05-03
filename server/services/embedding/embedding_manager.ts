/**
 * 统一嵌入服务管理器
 * 集中管理所有向量嵌入请求、服务状态和自动处理
 */

import { log } from '../../vite';
import { Pool } from '@neondatabase/serverless';
import { startEmbeddingService, generateEmbedding as flaskGenerateEmbedding } from '../learning/flask_embedding_service';

// 连接数据库
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 服务状态和配置
interface ServiceStatus {
  running: boolean;
  lastCheck: number;
  failedAttempts: number;
  connectionErrors: number;
}

class EmbeddingManager {
  private status: ServiceStatus = {
    running: false,
    lastCheck: 0,
    failedAttempts: 0,
    connectionErrors: 0
  };
  
  private processingMemory: boolean = false;
  private memoryQueue: number[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    log(`[EmbeddingManager] 初始化统一嵌入服务管理器`, 'info');
    
    // 启动服务并开始监控
    this.initializeService();
    
    // 设置定期检查未处理记忆的任务
    this.setupAutoProcessing();
  }
  
  /**
   * 初始化嵌入服务
   */
  private async initializeService(): Promise<void> {
    try {
      log(`[EmbeddingManager] 启动嵌入服务...`, 'info');
      const success = await startEmbeddingService();
      
      this.status.running = success;
      this.status.lastCheck = Date.now();
      
      if (success) {
        log(`[EmbeddingManager] 嵌入服务启动成功`, 'info');
        this.status.failedAttempts = 0;
      } else {
        log(`[EmbeddingManager] 嵌入服务启动失败`, 'warn');
        this.status.failedAttempts++;
      }
    } catch (error) {
      log(`[EmbeddingManager] 初始化服务出错: ${error}`, 'error');
      this.status.failedAttempts++;
      this.status.running = false;
    }
  }
  
  /**
   * 设置自动处理任务
   */
  private setupAutoProcessing(): void {
    // 每10分钟检查一次未处理的记忆
    this.checkInterval = setInterval(() => {
      this.checkUnprocessedMemories();
    }, 10 * 60 * 1000);
    
    // 立即执行一次检查
    setTimeout(() => {
      this.checkUnprocessedMemories();
    }, 60 * 1000); // 启动1分钟后执行第一次检查
    
    log(`[EmbeddingManager] 已设置自动处理任务`, 'info');
  }
  
  /**
   * 检查并处理未生成嵌入的记忆
   */
  private async checkUnprocessedMemories(): Promise<void> {
    if (this.processingMemory) {
      log(`[EmbeddingManager] 已有处理任务在进行中，跳过此次检查`, 'info');
      return;
    }
    
    try {
      log(`[EmbeddingManager] 检查未处理的记忆...`, 'info');
      
      // 查询缺少嵌入的记忆
      const query = `
        SELECT m.id, m.content, m.user_id, m.timestamp, m.type
        FROM memories m
        WHERE NOT EXISTS (
          SELECT 1 FROM memory_embeddings me 
          WHERE me.memory_id = m.id
        )
        ORDER BY m.timestamp DESC
        LIMIT 10
      `;
      
      const result = await pool.query(query);
      
      if (result.rows.length === 0) {
        log(`[EmbeddingManager] 没有发现未处理的记忆`, 'info');
        return;
      }
      
      log(`[EmbeddingManager] 发现 ${result.rows.length} 条未处理的记忆`, 'info');
      
      // 添加到处理队列
      for (const memory of result.rows) {
        this.addToProcessingQueue(memory.id);
      }
      
      // 开始处理队列
      this.processNextMemory();
    } catch (error) {
      log(`[EmbeddingManager] 检查未处理记忆时出错: ${error}`, 'error');
    }
  }
  
  /**
   * 添加记忆到处理队列
   */
  public addToProcessingQueue(memoryId: number): void {
    if (!this.memoryQueue.includes(memoryId)) {
      this.memoryQueue.push(memoryId);
      log(`[EmbeddingManager] 已将记忆 ${memoryId} 添加到处理队列`, 'info');
      
      // 如果当前没有处理任务，立即开始处理
      if (!this.processingMemory) {
        this.processNextMemory();
      }
    }
  }
  
  /**
   * 处理队列中的下一个记忆
   */
  private async processNextMemory(): Promise<void> {
    if (this.memoryQueue.length === 0 || this.processingMemory) {
      return;
    }
    
    this.processingMemory = true;
    const memoryId = this.memoryQueue.shift();
    
    try {
      log(`[EmbeddingManager] 开始处理记忆 ${memoryId}`, 'info');
      
      // 查询记忆内容
      const memoryQuery = await pool.query(
        'SELECT content FROM memories WHERE id = $1',
        [memoryId]
      );
      
      if (memoryQuery.rows.length === 0) {
        log(`[EmbeddingManager] 未找到ID为 ${memoryId} 的记忆`, 'warn');
        this.processingMemory = false;
        this.processNextMemory();
        return;
      }
      
      const content = memoryQuery.rows[0].content;
      
      // 检查该记忆是否已有嵌入
      const existingQuery = await pool.query(
        'SELECT 1 FROM memory_embeddings WHERE memory_id = $1',
        [memoryId]
      );
      
      if (existingQuery.rows.length > 0) {
        // 删除现有嵌入
        await pool.query(
          'DELETE FROM memory_embeddings WHERE memory_id = $1',
          [memoryId]
        );
        log(`[EmbeddingManager] 删除记忆 ${memoryId} 的现有嵌入`, 'info');
      }
      
      // 生成新的嵌入向量
      log(`[EmbeddingManager] 为记忆 ${memoryId} 生成嵌入向量`, 'info');
      const embedding = await this.generateEmbedding(content);
      
      if (!embedding || embedding.length !== 3072) {
        throw new Error(`嵌入生成失败或维度不正确 (实际维度: ${embedding ? embedding.length : 0}, 期望: 3072)`);
      }
      
      // 保存嵌入向量
      await pool.query(
        'INSERT INTO memory_embeddings (memory_id, vector_data) VALUES ($1, $2)',
        [memoryId, JSON.stringify(embedding)]
      );
      
      log(`[EmbeddingManager] 成功为记忆 ${memoryId} 生成并保存 ${embedding.length} 维嵌入向量`, 'info');
    } catch (error) {
      log(`[EmbeddingManager] 处理记忆 ${memoryId} 时出错: ${error}`, 'error');
    } finally {
      this.processingMemory = false;
      
      // 延迟处理下一个，避免过快请求API
      setTimeout(() => {
        this.processNextMemory();
      }, 5000); // 5秒后处理下一个
    }
  }
  
  /**
   * 生成文本的向量嵌入
   * 所有嵌入请求的统一入口
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('无效的文本内容');
    }
    
    try {
      log(`[EmbeddingManager] 生成嵌入向量，文本长度: ${text.length}字符`, 'info');
      
      // 确保服务正在运行
      if (!this.status.running) {
        await this.initializeService();
      }
      
      // 调用Flask服务生成嵌入
      const embedding = await flaskGenerateEmbedding(text);
      
      // 验证嵌入维度
      if (!embedding || embedding.length !== 3072) {
        const errorMsg = `嵌入维度异常: 实际${embedding ? embedding.length : 0}维, 期望3072维`;
        log(`[EmbeddingManager] ${errorMsg}`, 'error');
        throw new Error(errorMsg);
      }
      
      log(`[EmbeddingManager] 成功生成${embedding.length}维向量嵌入`, 'info');
      return embedding;
    } catch (error) {
      log(`[EmbeddingManager] 生成嵌入出错: ${error}`, 'error');
      throw error;
    }
  }
  
  /**
   * 获取服务状态
   */
  public getStatus(): ServiceStatus {
    return { ...this.status };
  }
  
  /**
   * 手动触发未处理记忆检查
   */
  public triggerCheck(): void {
    log(`[EmbeddingManager] 手动触发未处理记忆检查`, 'info');
    this.checkUnprocessedMemories();
  }
}

// 创建并导出单例
export const embeddingManager = new EmbeddingManager();
