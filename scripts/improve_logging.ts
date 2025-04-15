
#!/usr/bin/env tsx

/**
 * 日志优化脚本
 * 用于改进服务的日志输出，特别是处理大型向量数据的打印
 */

import { log } from '../server/vite';

// 修复日志函数
function improveLogging() {
  log('开始优化日志输出...');
  
  // 重写全局日志函数以改进向量处理
  const originalConsoleLog = console.log;
  
  console.log = function(...args: any[]) {
    // 处理参数中可能包含的向量
    const safeArgs = args.map(arg => {
      if (typeof arg === 'string') {
        // 检查是否包含向量的JSON字符串
        if (arg.includes('[') && arg.includes(']') && arg.length > 1000) {
          // 尝试解析并简化
          try {
            const obj = JSON.parse(arg);
            return JSON.stringify(simplifyObject(obj));
          } catch {
            // 如果不是有效JSON，截断超长字符串
            if (arg.length > 500) {
              return arg.substring(0, 500) + '... [截断了' + (arg.length - 500) + '字符]';
            }
            return arg;
          }
        }
      } else if (Array.isArray(arg) && arg.length > 50 && arg.every(item => typeof item === 'number')) {
        // 处理数字数组（可能是向量）
        return `[向量: 长度=${arg.length}, 前5个元素=[${arg.slice(0, 5).join(', ')}], ...]`;
      } else if (typeof arg === 'object' && arg !== null) {
        // 处理对象
        return simplifyObject(arg);
      }
      return arg;
    });
    
    originalConsoleLog.apply(console, safeArgs);
  };
  
  log('日志输出优化完成');
}

// 简化对象，处理嵌套对象中的向量
function simplifyObject(obj: any): any {
  if (!obj) return obj;
  
  // 处理数组
  if (Array.isArray(obj)) {
    // 检查是否为向量（数字数组）
    if (obj.length > 50 && obj.every(item => typeof item === 'number')) {
      return `[向量: 长度=${obj.length}, 前5个元素=[${obj.slice(0, 5).join(', ')}], ...]`;
    }
    
    // 处理普通数组
    return obj.map(item => simplifyObject(item));
  }
  
  // 处理对象
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, any> = {};
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // 处理嵌套对象
        result[key] = simplifyObject(obj[key]);
        
        // 特殊处理embedding字段
        if (key === 'embedding' || key === 'vectorData' || key === 'vector') {
          const value = obj[key];
          if (Array.isArray(value) && value.length > 20) {
            result[key] = `[向量: 长度=${value.length}, 前5个元素=[${value.slice(0, 5).join(', ')}], ...]`;
          }
        }
      }
    }
    
    return result;
  }
  
  return obj;
}

// 立即执行
improveLogging();
log('日志优化脚本已加载');
