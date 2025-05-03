/**
 * 会话管理模块
 * 提供基于PostgreSQL的会话存储，解决内存泄漏问题
 */

const pgSession = require('connect-pg-simple');
const session = require('express-session');
const { Pool } = require('@neondatabase/serverless');

/**
 * 创建并返回PostgreSQL会话存储的配置
 * @param {Object} options 配置选项
 * @returns {Object} 会话配置对象
 */
function createSessionConfig(options = {}) {
  // 从环境变量获取数据库连接信息
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.warn('警告: DATABASE_URL环境变量未设置，使用内存存储(不推荐用于生产环境)');
    return {
      secret: process.env.SESSION_SECRET || 'ai-learning-companion-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24小时
      }
    };
  }
  
  try {
    // 配置数据库连接池
    const pool = new Pool({
      connectionString: DATABASE_URL,
      max: options.maxConnections || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
    
    // 创建PostgreSQL会话存储
    const PgStore = pgSession(session);
    
    // 添加会话支持，使用PostgreSQL存储会话数据
    return {
      store: new PgStore({
        pool,
        tableName: 'session', // 与之前创建的表名匹配
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET || 'ai-learning-companion-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24小时
      }
    };
  } catch (error) {
    console.error(`PostgreSQL会话存储初始化失败: ${error.message}`);
    console.warn('降级到内存存储(不推荐用于生产环境)');
    
    return {
      secret: process.env.SESSION_SECRET || 'ai-learning-companion-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24小时
      }
    };
  }
}

module.exports = {
  createSessionConfig
};