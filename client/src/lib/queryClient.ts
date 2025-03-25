
import { QueryClient } from '@tanstack/react-query';

// 创建查询客户端
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5分钟
    },
  },
});

// API请求工具函数
export async function apiRequest(method: string, url: string, data?: any) {
  const isAuthRequired = url.includes('/api/chats') || 
                         url.includes('/api/chat') || 
                         url.includes('/api/users');
                         
  // 检查是否需要认证的路径且用户未登录
  if (isAuthRequired && !localStorage.getItem('user')) {
    console.log(`[API] ${method} ${url} - 未登录，阻止请求`);
    return new Response(JSON.stringify({ 
      success: false, 
      message: "用户未登录" 
    }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  return fetch(url, options);
}

// 重置查询客户端
export function resetQueryClient() {
  queryClient.clear();
}

import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
