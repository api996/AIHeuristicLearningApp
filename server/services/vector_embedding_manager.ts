/**
 * 向量嵌入管理器
 * 负责管理向量嵌入的生成任务和调度
 */

import { log } from "../vite";
import { exec } from "child_process";
import path from "path";

/**
 * 向量嵌入管理器
 * 提供向量嵌入的按需生成和定时任务管理
 */
export const vectorEmbeddingManager = {
  // 记录最近一次运行时间
  lastRunTime: 0,
  // 最小运行间隔(60分钟 - 增加以减少API调用)
  minInterval: 60 * 60 * 1000,
  // 队列锁，防止并发运行
  isRunning: false,
  // 最后处理的记忆ID计数
  lastProcessedCount: 0,
  // 最小新记忆数量阈值，低于此值不进行批处理（除非手动触发）
  minNewMemoriesThreshold: 5, // 调整为5条，与EmbeddingManager的批处理大小一致
  
  /**
   * 运行嵌入生成脚本
   * @param reason 触发原因
   * @returns 生成任务是否成功
   */
  runGenerator: async function(reason = "按需触发"): Promise<boolean> {
    if (this.isRunning) {
      log(`[向量嵌入] 生成任务已在运行中，跳过此次触发(${reason})`);
      return false;
    }
    
    // 移除了时间间隔检查，现在完全按需触发
    
    try {
      this.isRunning = true;
      log(`[向量嵌入] 开始执行生成任务...(触发原因: ${reason})`);
      
      const scriptPath = path.join(process.cwd(), "server", "generate_vector_embeddings.js");
      
      return new Promise<boolean>((resolve) => {
        // 使用Node执行脚本
        const embedProcess = exec(`node ${scriptPath}`, {
          timeout: 10 * 60 * 1000, // 10分钟超时，处理批量任务需要更长时间
        });
        
        embedProcess.stdout?.on('data', (data) => {
          log(`[向量嵌入生成] ${data.toString().trim()}`);
        });
        
        embedProcess.stderr?.on('data', (data) => {
          log(`[向量嵌入生成错误] ${data.toString().trim()}`);
        });
        
        embedProcess.on('close', (code) => {
          this.lastRunTime = Date.now();
          this.isRunning = false;
          
          if (code === 0) {
            log(`[向量嵌入] 生成任务成功完成(${reason})`);
            resolve(true);
          } else {
            log(`[向量嵌入] 生成任务失败，退出码: ${code}(${reason})`);
            resolve(false); // 使用resolve而不是reject，避免中断程序
          }
        });
        
        embedProcess.on('error', (error) => {
          this.isRunning = false;
          log(`[向量嵌入] 生成任务执行错误: ${error.message}`);
          resolve(false);
        });
      });
    } catch (error) {
      this.isRunning = false;
      log(`[向量嵌入] 生成任务执行异常: ${error}`);
      return false;
    }
  },
  
  /**
   * 检查是否有足够新记忆需要处理
   * @returns 是否有足够新记忆需要处理
   */
  async checkForNewMemories(): Promise<boolean> {
    try {
      // 使用直接的SQL查询计算未处理的记忆数量
      // 这是一个更简单的方法，直接使用node直接调用SQL命令
      const command = `node -e "
        const { Pool, neonConfig } = require('@neondatabase/serverless');
        const { WebSocket } = require('ws');
        
        // 正确配置WebSocket构造函数
        neonConfig.webSocketConstructor = WebSocket;
        neonConfig.useSecureWebSocket = true; 
        neonConfig.forceDisablePgSSL = true;
        
        // 配置数据库连接
        const pool = new Pool({ 
          connectionString: process.env.DATABASE_URL
        });
        
        async function checkNewMemories() {
          try {
            // 查询未处理的记忆数量
            const result = await pool.query(
              'SELECT COUNT(*) FROM memories LEFT JOIN memory_embeddings ON memories.id = memory_embeddings.memory_id WHERE memory_embeddings.id IS NULL'
            );
            console.log(result.rows[0].count);
          } catch (err) {
            console.error(err);
            console.log('0');
          } finally {
            await pool.end();
          }
        }
        
        checkNewMemories();
      "`;
      
      return new Promise<boolean>((resolve) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            log(`[向量嵌入] 检查新记忆出错: ${error.message}`, "error");
            resolve(false);
            return;
          }
          
          if (stderr) {
            log(`[向量嵌入] 检查新记忆错误输出: ${stderr}`, "warn");
          }
          
          const count = parseInt(stdout.trim(), 10);
          const previousCount = this.lastProcessedCount;
          this.lastProcessedCount = count;
          
          // 新记忆数量是否超过阈值
          const hasEnoughNewMemories = count >= this.minNewMemoriesThreshold;
          
          // 记忆数量是否有变化
          const hasChanged = count !== previousCount;
          
          if (hasEnoughNewMemories) {
            log(`[向量嵌入] 检测到${count}条未处理的记忆，超过阈值(${this.minNewMemoriesThreshold})，将触发处理`);
            resolve(true);
          } else if (hasChanged) {
            log(`[向量嵌入] 检测到${count}条未处理的记忆，未达到处理阈值(${this.minNewMemoriesThreshold})，暂不处理`);
            resolve(false);
          } else {
            log(`[向量嵌入] 未检测到新的未处理记忆，跳过处理`);
            resolve(false);
          }
        });
      });
    } catch (err) {
      log(`[向量嵌入] 检查新记忆异常: ${err}`, "error");
      return false;
    }
  },
  
  /**
   * 开始定时任务调度器
   * 注意：我们不再使用定时任务，只在需要时触发
   */
  startScheduler: function(): void {
    log(`[向量嵌入] 不再使用定时任务，改为按需触发模式`);
    
    // 不在服务启动时自动进行检查，只在用户交互过程中生成足够记忆时自动检查
    log(`[向量嵌入] 不再自动检查，将仅在记忆数量超过${this.minNewMemoriesThreshold}时才触发处理`);
    // 我们不再使用setTimeout自动检查
  },
  
  /**
   * 针对特定记忆ID触发向量嵌入生成
   * 用于在创建新记忆后确保其向量嵌入被生成
   * 
   * @param memoryId 记忆ID
   * @param content 记忆内容（可选，用于打印日志）
   * @returns 是否成功触发
   */
  triggerForMemory: async function(memoryId: string, content?: string): Promise<boolean> {
    if (!memoryId) {
      log(`[向量嵌入] 无效的记忆ID，无法触发向量生成`, "error");
      return false;
    }
    
    const contentPreview = content ? content.substring(0, 30) + "..." : "内容未提供";
    log(`[向量嵌入] 新记忆创建，立即处理 - ID: ${memoryId}, 内容: ${contentPreview}`);
    
    // 直接处理这个特定记忆
    try {
      // 构建针对特定记忆ID的命令
      const scriptPath = path.join(process.cwd(), "server", "generate_vector_embeddings.js");
      const command = `node ${scriptPath} --memory-id=${memoryId}`;
      
      log(`[向量嵌入] 执行单记忆处理命令: ${command}`);
      
      return new Promise<boolean>((resolve) => {
        const embedProcess = exec(command, {
          timeout: 30 * 1000, // 30秒超时，单个记忆处理应该很快
        });
        
        embedProcess.stdout?.on('data', (data) => {
          log(`[向量嵌入生成] ${data.toString().trim()}`);
        });
        
        embedProcess.stderr?.on('data', (data) => {
          log(`[向量嵌入生成错误] ${data.toString().trim()}`);
        });
        
        embedProcess.on('close', (code) => {
          if (code === 0) {
            log(`[向量嵌入] 单记忆处理完成 - ID: ${memoryId}`);
            resolve(true);
          } else {
            log(`[向量嵌入] 单记忆处理失败，退出码: ${code} - ID: ${memoryId}`);
            resolve(false);
          }
        });
        
        embedProcess.on('error', (error) => {
          log(`[向量嵌入] 单记忆处理错误: ${error.message}`);
          resolve(false);
        });
      });
    } catch (error) {
      log(`[向量嵌入] 单记忆处理异常: ${error}`);
      return false;
    }
  }
};