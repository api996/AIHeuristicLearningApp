/**
 * 统一嵌入服务管理器
 * 集中管理所有向量嵌入请求、服务状态和自动处理
 */

import { log } from '../../vite';
import { Pool } from '@neondatabase/serverless';
import { startEmbeddingService, generateEmbedding as flaskGenerateEmbedding } from '../learning/flask_embedding_service';

// 添加全局变量类型声明
declare global {
  var embeddingManagerInstance: EmbeddingManager | undefined;
}

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
  private memoryQueue: (number | string)[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  
  // 错误重试和迟踪
  private memoryRetryAttempts: Map<string, number> = new Map();
  private maxRetryAttempts: number = 3;
  private failedMemories: Set<string> = new Set();
  private apiErrorCount: number = 0;
  
  // 单例模式的实例检查
  private static instance: EmbeddingManager;

  constructor() {
    // 确保只有一个实例
    if (EmbeddingManager.instance) {
      log(`[EmbeddingManager] 已存在实例，使用现有实例`, 'warn');
      return EmbeddingManager.instance;
    }
    
    log(`[EmbeddingManager] 初始化统一嵌入服务管理器`, 'info');
    
    // 启动服务并开始监控
    this.initializeService();
    
    // 设置定期检查未处理记忆的任务
    this.setupAutoProcessing();
    
    // 保存实例
    EmbeddingManager.instance = this;
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
    if (!memoryId) {
      this.processingMemory = false;
      return;
    }
    
    // 使用字符串ID作为键
    const memoryIdStr = String(memoryId);
    const attempts = this.memoryRetryAttempts.get(memoryIdStr) || 0;
    if (attempts >= this.maxRetryAttempts) {
      log(`[EmbeddingManager] 记忆 ${memoryIdStr} 已达到最大重试次数 (${attempts}/${this.maxRetryAttempts})，跳过处理`, 'warn');
      this.failedMemories.add(memoryIdStr);
      this.processingMemory = false;
      
      // 延迟处理下一个，避免过快请求API
      setTimeout(() => {
        this.processNextMemory();
      }, 1000); // 1秒后处理下一个
      return;
    }
    
    // 如果API错误太多，暂停处理(至少5分钟)
    if (this.apiErrorCount > 10) {
      log(`[EmbeddingManager] API错误过多 (${this.apiErrorCount}次)，暂停处理5分钟`, 'warn');
      this.processingMemory = false;
      
      // 将当前记忆放回队列开始处理，稍后再处理
      this.memoryQueue.unshift(memoryId);
      
      // 5分钟后重置错误计数并恢复处理
      setTimeout(() => {
        this.apiErrorCount = 0;
        log(`[EmbeddingManager] 已重置API错误计数，恢复处理`, 'info');
        this.processNextMemory();
      }, 5 * 60 * 1000);
      return;
    }
    
    try {
      log(`[EmbeddingManager] 开始处理记忆 ${memoryIdStr}`, 'info');
      
      // 查询记忆内容
      const memoryQuery = await pool.query(
        'SELECT content FROM memories WHERE id = $1',
        [memoryId]
      );
      
      if (memoryQuery.rows.length === 0) {
        log(`[EmbeddingManager] 未找到ID为 ${memoryIdStr} 的记忆`, 'warn');
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
        log(`[EmbeddingManager] 删除记忆 ${memoryIdStr} 的现有嵌入`, 'info');
      }
      
      // 生成新的嵌入向量
      log(`[EmbeddingManager] 为记忆 ${memoryIdStr} 生成嵌入向量`, 'info');
      const embedding = await this.generateEmbedding(content);
      
      if (!embedding || embedding.length !== 3072) {
        throw new Error(`嵌入生成失败或维度不正确 (实际维度: ${embedding ? embedding.length : 0}, 期望: 3072)`);
      }
      
      // 保存嵌入向量
      await pool.query(
        'INSERT INTO memory_embeddings (memory_id, vector_data) VALUES ($1, $2)',
        [memoryId, JSON.stringify(embedding)]
      );
      
      // 处理成功，重置该记忆的重试计数
      this.memoryRetryAttempts.delete(memoryIdStr);
      
      log(`[EmbeddingManager] 成功为记忆 ${memoryIdStr} 生成并保存 ${embedding.length} 维嵌入向量`, 'info');
    } catch (error) {
      // 增加重试计数
      const newAttempts = (this.memoryRetryAttempts.get(memoryIdStr) || 0) + 1;
      this.memoryRetryAttempts.set(memoryIdStr, newAttempts);
      
      // 检查错误类型
      const errorMsg = String(error);
      if (errorMsg.includes('API') || errorMsg.includes('密钥') || errorMsg.includes('配额') || 
          errorMsg.includes('GEMINI') || errorMsg.includes('超时')) {
        this.apiErrorCount++;
        log(`[EmbeddingManager] 检测到API错误，计数增加到 ${this.apiErrorCount}`, 'warn');
      }
      
      log(`[EmbeddingManager] 处理记忆 ${memoryIdStr} 时出错 (尝试 ${newAttempts}/${this.maxRetryAttempts}): ${error}`, 'error');
      
      // 如果还没达到最大重试次数，重新加入队列
      if (newAttempts < this.maxRetryAttempts) {
        log(`[EmbeddingManager] 将记忆 ${memoryIdStr} 重新加入队列，稍后重试`, 'info');
        // 将失败的记忆添加回队列末尾
        this.memoryQueue.push(memoryId);
      } else {
        log(`[EmbeddingManager] 记忆 ${memoryIdStr} 达到最大重试次数，不再处理`, 'warn');
        this.failedMemories.add(memoryIdStr);
      }
    } finally {
      this.processingMemory = false;
      
      // 检查API错误计数决定延迟时间
      const delayTime = this.apiErrorCount > 5 ? 30000 : 5000; // API错误多时增加延迟
      
      // 延迟处理下一个，避免过快请求API
      setTimeout(() => {
        this.processNextMemory();
      }, delayTime);
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
      
      // 检查API错误计数，如果太多则拒绝请求
      if (this.apiErrorCount > 10) {
        throw new Error(`API服务当前不可用，请稍后再试 (错误计数: ${this.apiErrorCount})`);
      }
      
      // 确保服务正在运行
      if (!this.status.running) {
        await this.initializeService();
      }
      
      // 对较长的文本进行截断，避免命令行参数过长
      let truncatedText = text;
      const maxTextLength = 1000;
      if (text.length > maxTextLength) {
        truncatedText = text.substring(0, maxTextLength);
        log(`[EmbeddingManager] 文本过长，已截断至${maxTextLength}字符`, 'warn');
      }
      
      // 调用Flask服务生成嵌入
      let embedding;
      try {
        embedding = await flaskGenerateEmbedding(truncatedText);
      } catch (error) {
        // 判断是否为API相关错误
        const errorMsg = String(error);
        if (errorMsg.includes('API') || errorMsg.includes('密钥') || errorMsg.includes('配额') || 
            errorMsg.includes('GEMINI') || errorMsg.includes('超时')) {
          this.apiErrorCount++;
          log(`[EmbeddingManager] 检测到API错误，计数增加到 ${this.apiErrorCount}`, 'warn');
        }
        throw error;
      }
      
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
   * 获取处理统计数据
   */
  public getProcessingStats() {
    return {
      queueSize: this.memoryQueue.length,
      failedMemoriesCount: this.failedMemories.size,
      apiErrorCount: this.apiErrorCount,
      failedMemories: Array.from(this.failedMemories),
      retryAttempts: Object.fromEntries(this.memoryRetryAttempts),
      processingInProgress: this.processingMemory,
      serviceStatus: this.status
    };
  }
  
  /**
   * 手动触发未处理记忆检查
   */
  public triggerCheck(): void {
    log(`[EmbeddingManager] 手动触发未处理记忆检查`, 'info');
    this.checkUnprocessedMemories();
  }
}

// 创建并导出单例 - 使用IIFE确保只创建一次
export const embeddingManager = (() => {
  // 检查是否已存在实例
  if ((global as any).embeddingManagerInstance) {
    log(`[使用现有实例] 嵌入服务管理器`, 'info');
    return (global as any).embeddingManagerInstance as EmbeddingManager;
  }
  
  // 创建新实例
  const instance = new EmbeddingManager();
  
  // 将实例保存到全局对象
  (global as any).embeddingManagerInstance = instance;
  
  return instance;
})();
