#!/usr/bin/env node
/**
 * 生产环境启动入口
 * 包含兼容性修复和环境初始化
 */
console.log('[INFO] 启动生产环境应用...');
console.log('[INFO] 时间:', new Date().toISOString());

// 预加载关键模块
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import expressSession from 'express-session';
import pgSessionInit from 'connect-pg-simple';

// 设置全局变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
globalThis.__filename = __filename;
globalThis.__dirname = __dirname;
globalThis.__path = path;
globalThis.__fs = fs;

// 初始化会话存储
const PgSession = pgSessionInit(expressSession);
globalThis.PgSession = PgSession; 
globalThis.MemoryStore = expressSession.MemoryStore;

console.log('[INFO] 环境初始化完成，加载应用...');

// ESM 导入应用
import './dist/index.js';
