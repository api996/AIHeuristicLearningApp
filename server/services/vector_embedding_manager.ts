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
  // 最小运行间隔(15分钟)
  minInterval: 15 * 60 * 1000,
  // 队列锁，防止并发运行
  isRunning: false,
  
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
   * 开始定时任务调度器
   */
  startScheduler: function(): void {
    // 每15分钟执行一次
    const interval = 15 * 60 * 1000;
    log(`[向量嵌入] 启动定时任务，每${interval/60000}分钟检查一次`);
    
    setInterval(() => {
      this.runGenerator("定时触发").catch(err => {
        log(`[向量嵌入] 定时任务异常: ${err}`);
      });
    }, interval);
    
    // 服务器启动后延迟1分钟执行第一次，避免与其他初始化任务冲突
    setTimeout(() => {
      log("[向量嵌入] 服务启动后首次执行生成任务...");
      this.runGenerator("服务启动").catch(err => {
        log(`[向量嵌入] 首次任务异常: ${err}`);
      });
    }, 60 * 1000);
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