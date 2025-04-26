/**
 * 通用工具函数
 */
import { log } from '../vite';
import fetch from 'node-fetch';

/**
 * 带重试机制的fetch函数
 * @param url 请求地址
 * @param options 请求选项
 * @param retries 重试次数
 * @param backoff 初始退避时间(ms)
 * @returns Promise<Response>
 */
export const fetchWithRetry = async (url: string, options: any = {}, retries = 3, backoff = 300) => {
  let lastError: Error | null = null;
  
  // 设置默认超时
  const timeout = options.timeout || 30000;
  let timeoutId: NodeJS.Timeout | null = null;
  
  for (let i = 0; i < retries; i++) {
    const attempt = i + 1;
    
    try {
      log(`API请求第${attempt}次尝试: ${url}`);
      
      // 创建一个可以被中断的请求
      const fetchPromise = fetch(url, options);
      
      // 创建一个超时Promise
      const timeoutPromise = new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`请求超时(${timeout}ms)`));
        }, timeout);
      });
      
      // 竞争Promise
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      // 清除超时计时器
      if (timeoutId) clearTimeout(timeoutId);
      
      if (response.ok) {
        log(`API请求成功，状态码: ${response.status}`);
        return response;
      }
      
      // 处理特定错误状态码
      if (response.status === 504 || response.status === 502 || response.status === 503) {
        lastError = new Error(`服务器错误(${response.status})，第${attempt}次尝试，共${retries}次`);
        const waitTime = backoff * Math.pow(2, i); // 更平滑的退避策略
        log(`服务器错误(${response.status})，${waitTime}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // 其他HTTP错误直接返回，让调用者处理
      log(`API请求返回非成功状态码: ${response.status}`);
      return response;
      
    } catch (error) {
      // 清除超时计时器
      if (timeoutId) clearTimeout(timeoutId);
      
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;
      
      // 判断是否是超时错误
      const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('超时');
      log(`API请求错误 ${isTimeoutError ? '[超时]' : ''} 第${attempt}次尝试: ${errorMessage}`);
      
      // 退避策略
      const waitTime = backoff * Math.pow(2, i);
      log(`等待${waitTime}ms后重试...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // 所有重试都失败
  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  log(`多次尝试后请求失败，放弃: ${errorMessage}`);
  throw lastError || new Error('所有重试尝试都失败了');
};