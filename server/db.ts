import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from "./vite";

neonConfig.webSocketConstructor = ws;

// 使用环境变量中的数据库URL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// 配置连接池限制连接数量和超时，减少资源滥用风险
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 连接最大空闲时间
  connectionTimeoutMillis: 2000 // 连接超时
});

export const db = drizzle({ 
  client: pool, 
  schema,
  // 添加防护措施
  logger: {
    logQuery: (query, params) => {
      // 可以在生产环境禁用，或者仅记录可疑查询
      if (process.env.NODE_ENV !== 'production') {
        log(`Query: ${query} - Params: ${JSON.stringify(params)}`);
      }
    }
  }
});
