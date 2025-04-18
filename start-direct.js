#!/usr/bin/env node
/**
 * 直接ESM启动脚本
 * 使用 tsx 直接执行 TypeScript，无需预构建和捆绑
 */
console.log('[INFO] 直接ESM模式启动应用...');
console.log('[INFO] 时间:', new Date().toISOString());
console.log('[INFO] 环境:', process.env.NODE_ENV || 'development');

// 使用 tsx 运行 TypeScript 代码 - 使用动态导入
import('tsx').then(tsx => {
  tsx.runMain('server/index.ts');
});
