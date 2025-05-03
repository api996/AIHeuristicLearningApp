/**
 * 通用工具函数
 */

/**
 * 格式化日志输出
 * @param message 日志消息
 * @param type 日志类型
 */
export function log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
  const date = new Date().toLocaleTimeString();
  
  // 根据日志类型选择颜色
  let color = '\x1b[0m'; // 默认，白色
  let prefix = '[info]';
  
  switch (type) {
    case 'info':
      color = '\x1b[36m'; // 青色
      prefix = '[info]';
      break;
    case 'warn':
      color = '\x1b[33m'; // 黄色
      prefix = '[warn]';
      break;
    case 'error':
      color = '\x1b[31m'; // 红色
      prefix = '[error]';
      break;
    case 'success':
      color = '\x1b[32m'; // 绿色
      prefix = '[success]';
      break;
  }
  
  // 输出带颜色的日志
  console.log(`${color}${date} ${prefix} ${message}\x1b[0m`);
}

/**
 * 生成随机ID
 * @returns 生成的随机ID
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

/**
 * 延迟函数
 * @param ms 延迟的毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 转义正则表达式特殊字符
 * @param string 需要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将对象转换为查询字符串
 * @param params 参数对象
 * @returns 查询字符串
 */
export function objectToQueryString(params: Record<string, any>): string {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => {
      if (Array.isArray(params[key])) {
        return params[key]
          .map((val: any) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
          .join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
    })
    .join('&');
}

/**
 * 去除HTML标签
 * @param html HTML字符串
 * @returns 纯文本
 */
export function stripHtml(html: string): string {
  return html.replace(/<\/?[^>]+(>|$)/g, '');
}