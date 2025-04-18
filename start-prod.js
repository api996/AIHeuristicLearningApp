#!/usr/bin/env node
/**
 * 生产环境启动入口
 */
console.log('[INFO] 启动生产环境应用...');
console.log('[INFO] 时间:', new Date().toISOString());

// ESM 导入应用
import './dist/index.js';
