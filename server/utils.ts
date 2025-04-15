
// 输入验证和清理工具函数
import { log } from './vite';

export const utils = {
  /**
   * 验证输入是否为有效整数
   */
  isValidInteger(value: any): boolean {
    if (typeof value === 'number') return Number.isInteger(value);
    if (typeof value !== 'string') return false;
    return /^\d+$/.test(value);
  },

  /**
   * 验证输入是否为有效字符串
   */
  isValidString(value: any, maxLength = 1000): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
  },

  /**
   * 清理可能包含敏感信息的错误消息
   */
  sanitizeErrorMessage(error: any): string {
    const message = error instanceof Error ? error.message : String(error);
    // 移除可能包含敏感信息的部分
    return message.replace(/\b(password|token|key|secret)\b\s*[:=]\s*['"]?[^'"]*['"]?/gi, '$1=***');
  },

  /**
   * 安全解析整数
   */
  safeParseInt(value: any, defaultValue = 0): number {
    if (!this.isValidInteger(value)) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  },

  /**
   * 安全记录包含向量的对象
   * 为避免大型向量污染日志，只显示向量的摘要信息
   */
  logWithEmbeddings(message: string, data: any): void {
    try {
      // 如果数据是字符串，尝试解析为JSON
      const objectToLog = typeof data === 'string' ? JSON.parse(data) : data;
      
      // 创建一个新对象进行日志记录
      const safeLogObject = this.createSafeLogObject(objectToLog);
      
      // 记录日志
      log(`${message}: ${JSON.stringify(safeLogObject)}`);
    } catch (error) {
      // 如果解析失败，记录原始信息
      log(`${message} (无法处理嵌入向量): ${typeof data === 'string' ? data.substring(0, 100) : '[非字符串对象]'}...`);
    }
  },

  /**
   * 递归处理对象，将所有向量替换为摘要信息
   */
  createSafeLogObject(obj: any): any {
    if (!obj) return obj;
    
    // 处理数组
    if (Array.isArray(obj)) {
      // 检查是否为数字数组（可能是向量）
      if (obj.length > 20 && obj.every(item => typeof item === 'number')) {
        return `[向量: 长度=${obj.length}, 前5个元素=[${obj.slice(0, 5).join(', ')}], ...]`;
      }
      
      // 处理普通数组
      return obj.map(item => this.createSafeLogObject(item));
    }
    
    // 处理对象
    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // 检查是否为embedding字段
        if (key === 'embedding' && Array.isArray(value) && value.length > 20) {
          result[key] = `[向量: 长度=${value.length}, 前5个元素=[${value.slice(0, 5).join(', ')}], ...]`;
        } else {
          result[key] = this.createSafeLogObject(value);
        }
      }
      
      return result;
    }
    
    // 返回原始值
    return obj;
  }
};
