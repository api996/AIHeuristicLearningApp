/**
 * 生产环境启动脚本
 * 专门解决ESM模块冲突问题，提供稳定的生产部署
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 预加载session存储依赖
import pgSessionLib from 'connect-pg-simple';
import sessionLib from 'express-session';
const PgSessionStore = pgSessionLib(sessionLib);

// 设置环境变量
process.env.NODE_ENV = 'production';

// 导入并启动主应用程序
import('./dist/index.js').catch(error => {
  console.error('应用程序启动失败:', error);
  process.exit(1);
});