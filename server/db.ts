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

// 配置Neon WebSocket连接 - 使用0.10.4版本兼容的设置
// 参考 https://github.com/neondatabase/serverless/blob/v0.10.4/CONFIG.md
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = false; // 设置为false以避免SSL验证问题
neonConfig.pipelineTLS = false; // 关闭pipeline TLS以减少连接问题
neonConfig.forceDisablePgSSL = true; // 强制禁用SSL

// 旧版本兼容的连接优化
neonConfig.pipelineConnect = false; // 禁用管道连接以避免死锁
neonConfig.coalesceWrites = true; // 启用写入合并来提高性能

// 使用环境变量中的数据库URL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  log("警告: DATABASE_URL未设置，将使用内存模式", "error");
  // 不抛出错误，而是继续使用内存模式
}

// 创建连接池 - 使用v0.10.4兼容的配置
// 为Replit环境特别优化，减少死锁可能性
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 1, // 最小连接数，减少死锁可能
  idleTimeoutMillis: 15000, // 15秒空闲超时
  connectionTimeoutMillis: 8000, // 8秒连接超时
  keepAlive: false, // 禁用保持连接，减少长连接导致的问题
  maxUses: 50 // 降低单个连接的最大使用次数
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

// 增强的数据库启动逻辑 - 多次尝试连接，然后再降级
(async () => {
  // 初始连接尝试
  try {
    log("尝试建立数据库初始连接...");
    await Promise.race([
      testDatabaseConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("初始连接总超时")), 10000))
    ]);
    log("数据库初始连接成功！服务正常启动");
  } catch (e) {
    // 初始连接失败，进行备份尝试
    log(`初始数据库连接异常: ${(e as Error).message}`, "error");
    
    // 稍后再尝试一次，但不阻塞应用启动
    setTimeout(async () => {
      try {
        log("进行最后一次数据库连接尝试...");
        await testDatabaseConnection();
        log("延迟连接成功！服务恢复正常");
      } catch (retryError) {
        log(`延迟连接仍然失败: ${(retryError as Error).message}`, "error");
        log("应用将以降级模式运行，某些功能可能不可用", "warn");
        
        // 定期在后台尝试重连，但不影响应用功能
        const intervalId = setInterval(async () => {
          try {
            await testDatabaseConnection();
            log("数据库连接已恢复！", "info");
            clearInterval(intervalId);
          } catch (e) {
            // 静默失败，不记录日志，避免日志过多
          }
        }, 60000); // 每分钟尝试一次
      }
    }, 5000);
    
    log("应用已启动，但数据库功能临时不可用", "warn");
  }
})();

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
