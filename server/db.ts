import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from "./vite";

// 设置WebSocket构造器
neonConfig.webSocketConstructor = ws;
// 增加WebSocket断开重连策略
neonConfig.wsConnectionRetryAttempts = 5;
neonConfig.wsConnectionRetryIntervalMs = 500;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// 配置连接池限制连接数量和超时，减少资源滥用风险 - 保留原有设置
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // 保持原有最大连接数
  idleTimeoutMillis: 30000, // 保持原有空闲超时
  connectionTimeoutMillis: 2000, // 保持原有连接超时
  // 添加额外的健壮性参数
  allowExitOnIdle: false,
  maxUses: 100, // 限制连接被重用的次数，避免资源泄漏
});

// 添加连接错误处理
pool.on('error', (err) => {
  log(`数据库连接池错误: ${err.message}`);
  // 仅记录错误，不进行自动重建以避免意外行为
});

// 健康检查函数
export const checkDbConnection = async () => {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    log(`数据库连接检查失败: ${err.message}`);
    return false;
  }
};

export const db = drizzle({ 
  client: pool, 
  schema,
  // 保留原有防护措施
  logger: {
    logQuery: (query, params) => {
      // 可以在生产环境禁用，或者仅记录可疑查询
      if (process.env.NODE_ENV !== 'production') {
        log(`Query: ${query} - Params: ${JSON.stringify(params)}`);
      }
    }
  }
});
