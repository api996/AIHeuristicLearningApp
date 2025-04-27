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
  minNewMemoriesThreshold: 10,
  
  /**
   * 运行嵌入生成脚本
   * @param reason 触发原因
   * @returns 生成任务是否成功
   */
  runGenerator: async function(reason = "定时触发"): Promise<boolean> {
    if (this.isRunning) {
      log(`[向量嵌入] 生成任务已在运行中，跳过此次触发(${reason})`);
      return false;
    }
    
    const now = Date.now();
    // 检查是否在最小间隔内(仅对定时触发做限制)
    if (now - this.lastRunTime < this.minInterval && reason === "定时触发") {
      log(`[向量嵌入] 上次执行时间距现在不足${this.minInterval/60000}分钟，跳过此次定时触发`);
      return false;
    }
    
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
      // 通过执行一个简单的SQL查询来获取未处理的记忆数量
      const command = `node -e "
        const { pool } = require('./server/db');
        async function checkNewMemories() {
          try {
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
   */
  startScheduler: function(): void {
    // 将间隔从15分钟增加到60分钟，降低API调用频率
    const interval = 60 * 60 * 1000; // 1小时
    log(`[向量嵌入] 启动定时任务，每${interval/60000}分钟检查一次`);
    
    setInterval(async () => {
      try {
        // 先检查是否有足够的新记忆需要处理
        const shouldProcess = await this.checkForNewMemories();
        
        // 只有当有足够的新记忆时才执行处理
        if (shouldProcess) {
          await this.runGenerator("定时触发");
        } else {
          log(`[向量嵌入] 定时检查：未达到处理条件，跳过此次执行`);
        }
      } catch (err) {
        log(`[向量嵌入] 定时任务异常: ${err}`);
      }
    }, interval);
    
    // 服务器启动后延迟2分钟执行第一次，避免与其他初始化任务冲突
    // 同时也避免每次重启就执行处理任务
    setTimeout(async () => {
      log("[向量嵌入] 服务启动后首次检查新记忆...");
      try {
        // 同样检查是否有足够的新记忆
        const shouldProcess = await this.checkForNewMemories();
        if (shouldProcess) {
          await this.runGenerator("服务启动");
        } else {
          log(`[向量嵌入] 服务启动检查：未达到处理条件，跳过执行`);
        }
      } catch (err) {
        log(`[向量嵌入] 首次任务异常: ${err}`);
      }
    }, 120 * 1000); // 2分钟
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
    log(`[向量嵌入] 新记忆创建，触发向量嵌入生成 - ID: ${memoryId}, 内容: ${contentPreview}`);
    
    // 这里可以选择两种策略:
    // 1. 直接调用脚本处理所有待处理记忆（包括当前新创建的）
    // 2. 为这个特定记忆调用一个专门的处理脚本
    
    // 为简单起见，我们使用策略1，触发常规生成脚本
    return this.runGenerator(`新记忆触发(ID:${memoryId})`);
  }
};