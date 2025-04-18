#!/usr/bin/env node
/**
 * 生产环境直接启动脚本
 * 只有纯JS代码，最小化启动冲突
 */
console.log('[INFO] 启动生产环境应用 (直接模式)');
console.log('[INFO] 时间:', new Date().toISOString());

// 确保环境变量正确设置
process.env.NODE_ENV = 'production';

// 运行应用 - 使用动态导入
import('tsx').then(tsx => {
  tsx.runMain('server/index.ts');
});
