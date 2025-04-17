
import { useAuth } from '../hooks/use-auth';

/**
 * 封装的API请求函数，自动包含认证信息
 */
export const apiClient = {
  /**
   * 发送GET请求
   */
  async get(url: string, options: RequestInit = {}) {
    // 确保每个请求都包含凭据
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    return response;
  },
  
  /**
   * 发送POST请求
   */
  async post(url: string, data: any, options: RequestInit = {}) {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
    });
    
    return response;
  },
  
  /**
   * 发送PUT请求
   */
  async put(url: string, data: any, options: RequestInit = {}) {
    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
    });
    
    return response;
  },
  
  /**
   * 发送DELETE请求
   */
  async delete(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    return response;
  },
  
  /**
   * 添加用户ID到URL
   */
  appendUserId(url: string, userId?: number) {
    if (!userId) {
      // 尝试从localStorage获取用户ID
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          userId = user.userId;
        } catch (e) {
          console.error('无法解析用户数据', e);
        }
      }
    }
    
    if (!userId) return url;
    
    // 添加userId查询参数
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}userId=${userId}`;
  }
};
