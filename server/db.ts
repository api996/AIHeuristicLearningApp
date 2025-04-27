import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from "./vite";
import { backOff } from 'exponential-backoff'; // 使用指数退避重试

// 扩展Error类型的声明，使TypeScript不会报错
interface ErrorWithMessage {
  message: string;
}

// 配置常量
const isProduction = process.env.NODE_ENV === 'production';
const MAX_CONNECTION_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;
let connectionAttempts = 0;
let isConnected = false; // 追踪连接状态

// 配置Neon WebSocket连接 - 使用最新文档的推荐设置和实验性功能
// 参考 https://github.com/neondatabase/serverless/blob/main/CONFIG.md
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = false; // 设置为false以避免SSL验证问题
neonConfig.pipelineTLS = false; // 关闭pipeline TLS以减少连接问题
neonConfig.forceDisablePgSSL = true; // 强制禁用SSL
neonConfig.wsProxy = undefined; // 确保不使用代理

// 使用实验性的 HTTP fetch 功能来避免WebSocket死锁
// 这是 v1.0.0 中的新功能，可能会解决死锁问题
neonConfig.poolQueryViaFetch = true; // 重要：使用HTTP fetch而不是WebSocket

// 优化WebSocket连接
neonConfig.coalesceWrites = false; // 禁用写入合并以减少复杂性

// 使用环境变量中的数据库URL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  log("警告: DATABASE_URL未设置，将使用内存模式", "error");
  // 不抛出错误，而是继续使用内存模式
}

// 创建连接池
// 使用最低限度的配置来减少潜在问题
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 3, // 极低的连接数，避免连接过多
  idleTimeoutMillis: 30000, // 30秒空闲超时
  connectionTimeoutMillis: 10000, // 10秒连接超时
  keepAlive: true, // 保持连接活动
  maxUses: 100 // 一个连接最多使用100次后释放以防止内存泄漏
});

// 监听连接池错误，使用更好的错误恢复机制
pool.on('error', (err: ErrorWithMessage) => {
  isConnected = false; // 标记为断开
  log(`数据库连接池发生错误: ${err.message}`, "error");
  
  // 所有错误都尝试重连，而不只是特定类型
  if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
    connectionAttempts++;
    const delay = Math.min(RECONNECT_DELAY_MS * connectionAttempts, 30000); // 最多30秒
    log(`将在${delay/1000}秒后尝试重新连接数据库 (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`);
    
    setTimeout(() => {
      retryDatabaseConnection().catch(e => {
        log(`数据库重连失败: ${e?.message || '未知错误'}`, "error");
      });
    }, delay);
  } else {
    log(`已达到最大重试次数(${MAX_CONNECTION_ATTEMPTS})，数据库可能不可用，但应用将继续在降级模式下运行`);
  }
});

// 添加一个独立的重连函数，使用指数退避策略
async function retryDatabaseConnection() {
  try {
    await backOff(
      async () => {
        const result = await testDatabaseConnection();
        if (!result) throw new Error("连接测试失败");
        return result;
      },
      {
        numOfAttempts: 3,
        startingDelay: 1000,
        timeMultiple: 2,
        retry: (e, attemptNumber) => {
          log(`数据库重连尝试 ${attemptNumber} 失败: ${e.message}`);
          return true; // 总是重试
        }
      }
    );
    
    // 重置计数并标记为已连接
    connectionAttempts = 0;
    isConnected = true;
    log('数据库重新连接成功！', "info");
  } catch (e: any) {
    log(`所有重连尝试均失败: ${e?.message || "未知错误"}`, "error");
    throw e;
  }
}

// 改进的连接测试函数
async function testDatabaseConnection() {
  let client = null;
  try {
    // 使用更短的超时时间来快速失败
    const connectionPromise = pool.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('连接超时(5秒)')), 5000)
    );
    
    client = await Promise.race([connectionPromise, timeoutPromise]) as any;
    
    // 执行简单查询验证连接
    const result = await client.query('SELECT NOW()');
    log(`数据库连接成功! 当前时间: ${result.rows[0].now}`);
    isConnected = true;
    return true;
  } catch (error: any) {
    isConnected = false;
    if (error?.message?.includes('timeout')) {
      log(`数据库连接测试超时`, "error");
    } else {
      log(`数据库连接测试失败: ${error?.message || '未知错误'}`, "error");
    }
    throw error;
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        log(`警告: 释放数据库连接时出错: ${(releaseError as Error).message}`);
      }
    }
  }
}

// 获取连接状态的辅助函数 - 供其他模块使用
export function getDatabaseConnectionStatus() {
  return {
    isConnected,
    connectionAttempts,
    maxAttempts: MAX_CONNECTION_ATTEMPTS
  };
}

// 异步测试连接，不阻塞应用启动
testDatabaseConnection().catch(e => {
  log(`初始数据库连接测试异常: ${e.message}`, "error");
  log("应用将以降级模式启动，某些数据库功能可能不可用", "warn");
});

// 创建Drizzle ORM实例，增加错误处理和重试逻辑
export const db = drizzle({ 
  client: pool, 
  schema,
  logger: {
    logQuery: (query, params) => {
      if (process.env.NODE_ENV !== 'production') {
        // 简化日志，避免太长的查询占用日志空间
        const truncatedQuery = query.length > 100 ? query.substring(0, 100) + "..." : query;
        const truncatedParams = params && params.length > 5 ? 
          JSON.stringify([...params.slice(0, 3), "...(more params)"]) : 
          JSON.stringify(params);
        
        log(`Query: ${truncatedQuery} - Params: ${truncatedParams}`);
      }
    }
  }
});

// 导出sql函数，用于原生SQL查询
export { sql };
