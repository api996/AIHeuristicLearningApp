
// 输入验证和清理工具函数
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
  }
};
