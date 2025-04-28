import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from "./vite";

// 扩展Error类型的声明，使TypeScript不会报错
interface ErrorWithMessage {
  message: string;
}

// 修复WebSocket连接错误
// 在生产环境中，我们需要特别处理
const isProduction = process.env.NODE_ENV === 'production';

// 配置Neon WebSocket连接
// 在生产模式下，使用更简单的WebSocket配置避免TypeError
neonConfig.webSocketConstructor = ws;

// 不使用可能导致问题的配置
// 在生产模式下，我们使用默认值
// 避免使用额外配置，这些配置在不同版本间可能不兼容

// 使用环境变量中的数据库URL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// 配置连接池，根据环境使用不同的配置
export const pool = new Pool(isProduction ? 
  // 生产环境使用最简化配置，避免额外属性可能引起的问题
  { 
    connectionString: DATABASE_URL 
  } : 
  // 开发环境可以使用更多配置
  {
    connectionString: DATABASE_URL,
    max: 5, // 进一步降低最大连接数，避免超出限制
    idleTimeoutMillis: 20000, // 降低连接最大空闲时间
    connectionTimeoutMillis: 10000, // 增加连接超时时间
    allowExitOnIdle: false, // 禁止空闲时退出
    keepAlive: true, // 保持连接活跃
    keepAliveInitialDelayMillis: 10000 // 保持连接的初始延迟时间
  }
);

// 连接尝试计数
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;

// 监听连接池错误，防止连接问题导致整个应用崩溃
pool.on('error', (err: unknown) => {
  const error = err as ErrorWithMessage;
  log(`数据库连接池错误，但应用将继续运行: ${error.message}`);
  
  // 如果是连接终止或网络错误，尝试重新连接
  if (error.message.includes('terminating connection') || 
      error.message.includes('network') || 
      error.message.includes('connection') ||
      error.message.includes('timeout')) {
    
    // 限制重连次数
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      connectionAttempts++;
      log(`尝试重新连接数据库 (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`);
      
      // 延迟一段时间后重新测试连接
      setTimeout(() => {
        testDatabaseConnection()
          .then(() => {
            connectionAttempts = 0; // 重置计数器
            log('数据库重新连接成功');
          })
          .catch(e => log(`数据库重新连接失败: ${e.message}`));
      }, RECONNECT_DELAY_MS);
    } else {
      log(`达到最大重连次数 (${MAX_CONNECTION_ATTEMPTS})，不再尝试自动重连`);
    }
  }
});

// 测试数据库连接是否正常
async function testDatabaseConnection() {
  let client = null;
  try {
    // 设置超时保护，避免永久阻塞
    const connectionPromise = pool.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('连接超时')), 10000)
    );
    
    // 竞争：连接或超时，哪个先发生就接受哪个结果
    client = await Promise.race([connectionPromise, timeoutPromise]) as any;
    
    // 执行简单查询验证连接
    const result = await client.query('SELECT NOW()');
    log(`数据库连接成功! 当前时间: ${result.rows[0].now}`);
    return true;
  } catch (error: any) {
    log(`数据库连接测试失败: ${error?.message || '未知错误'}`);
    // 将错误传播到调用方，这样重连逻辑能够知道连接失败
    throw error;
  } finally {
    // 安全释放连接
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        log(`警告: 释放数据库连接时出错: ${(releaseError as Error).message}`);
      }
    }
  }
}

// 异步测试连接，不阻塞应用启动
testDatabaseConnection().catch(e => log(`数据库连接测试异常: ${e.message}`));

export const db = drizzle({ 
  client: pool, 
  schema,
  // 添加防护措施
  logger: {
    logQuery: (query, params) => {
      // 在生产环境中只记录错误
      if (process.env.NODE_ENV !== 'production') {
        log(`Query: ${query} - Params: ${JSON.stringify(params)}`);
      }
    }
  }
});

// 导出sql函数，用于原生SQL查询
export { sql };
