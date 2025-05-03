/**
 * 安全日志模块
 * 提供可靠的日志记录功能，避免EPIPE错误
 */

import * as fs from 'fs';
import * as path from 'path';

// 日志文件路径
export const logFile = path.join(process.cwd(), 'mcp_search.log');

/**
 * 安全的日志函数，避免EPIPE错误
 * 同时将记录打印到控制台和写入文件
 * @param message 日志消息
 * @param level 日志级别 ('info', 'warn', 'error')
 */
export function safeLog(message: string, level: string = 'info') {
  try {
    // 尝试打印到控制台，但捕获可能的EPIPE错误
    try {
      if (level === 'error') {
        console.error(message);
      } else if (level === 'warn') {
        console.warn(message);
      } else {
        console.log(message);
      }
    } catch (consoleError) {
      // 忽略控制台错误，继续尝试写入文件
    }
    
    // 尝试写入到文件
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `${timestamp} [${level}] ${message}\n`;
      
      // 异步写入文件，不阻塞主进程
      fs.appendFile(logFile, logMessage, { encoding: 'utf8' }, () => {});
    } catch (fileError) {
      // 忽略文件写入错误
    }
  } catch (e) {
    // 完全沉默错误，避免任何可能引起EPIPE的输出
  }
}

/**
 * 确保日志目录存在
 */
export function ensureLogDirectory() {
  try {
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return true;
  } catch (e) {
    // 忽略错误
    return false;
  }
}
