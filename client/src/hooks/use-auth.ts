import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { clearKnowledgeGraphCache } from "../lib/knowledge-graph-preloader";

interface User {
  userId: number;
  username: string;
  role: "user" | "admin";
}

// 创建一个自定义事件，用于在用户注册后通知所有组件
export const authEvents = {
  // 每次触发时创建新的事件实例，避免重用同一事件对象
  get userRegistered() {
    return new CustomEvent('userRegistered');
  },
  dispatchUserRegistered: () => {
    console.log('[authEvents] 发送用户注册事件');
    document.dispatchEvent(new CustomEvent('userRegistered'));
  }
};

export const useAuth = () => {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);

  // 从本地存储获取用户信息的函数
  const getUserFromStorage = useCallback(() => {
    console.log('[useAuth] 开始从localStorage获取用户数据');
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.userId) {
          console.log('[useAuth] 解析到有效用户数据:', parsedUser.userId, parsedUser.role);
          return parsedUser;
        } else {
          console.log('[useAuth] 用户数据格式无效');
        }
      } catch (error) {
        console.error("[useAuth] 解析用户数据失败:", error);
        localStorage.removeItem("user");
      }
    } else {
      console.log('[useAuth] localStorage中没有找到用户数据');
    }
    return null;
  }, []);

  // 更新用户状态的函数
  const updateUserState = useCallback(() => {
    const userData = getUserFromStorage();
    if (userData) {
      console.log('[useAuth] 用户状态已更新:', userData.userId);
      setUser(userData);
    }
  }, [getUserFromStorage]);

  // 初始化时从本地存储加载用户
  useEffect(() => {
    updateUserState();
    
    // 监听用户注册事件
    const handleUserRegistered = () => {
      console.log('[useAuth] 检测到用户注册事件，更新用户状态');
      updateUserState();
    };
    
    // 监听localStorage变化（跨组件通信的另一种方式）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        console.log('[useAuth] 检测到localStorage用户数据变化');
        updateUserState();
      }
    };
    
    // 添加事件监听器
    document.addEventListener('userRegistered', handleUserRegistered);
    window.addEventListener('storage', handleStorageChange);
    
    // 定期检查用户状态（备用方案）
    const checkInterval = setInterval(() => {
      const currentUser = getUserFromStorage();
      if (JSON.stringify(currentUser) !== JSON.stringify(user)) {
        console.log('[useAuth] 定期检查发现用户状态变化');
        updateUserState();
      }
    }, 2000);
    
    // 清理函数
    return () => {
      document.removeEventListener('userRegistered', handleUserRegistered);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [updateUserState, user, getUserFromStorage]);

  // 登录
  const login = useCallback(async (userData: User) => {
    if (!userData || !userData.userId) {
      throw new Error("Invalid user data");
    }
    
    try {
      // 验证用户会话是否有效，确保前端和后端状态一致
      // 添加 credentials: 'include' 确保发送和接收Cookie
      const response = await fetch(`/api/users/${userData.userId}?userId=${userData.userId}`, {
        credentials: 'include'  // 确保发送Cookie
      });
      
      if (response.ok) {
        // 在设置新用户之前清除所有知识图谱缓存
        clearKnowledgeGraphCache();
        console.log('[useAuth] 登录时清除所有知识图谱缓存');
        
        // 服务器确认用户有效，保存到本地
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
        
        // 添加调试日志
        console.log('[useAuth] 用户登录成功，已保存用户数据:', userData);
        
        // 触发用户注册事件
        authEvents.dispatchUserRegistered(); 
        
        // 设置会话Cookie（可选，用于配合服务端session）
        document.cookie = `userId=${userData.userId}; path=/; max-age=86400`;
        
        // 如果是管理员，直接转到管理界面
        if (userData.role === 'admin') {
          setLocation("/admin");
        } else {
          setLocation("/");
        }
      } else {
        // 服务器无法确认用户，可能会话已过期
        console.error('[useAuth] 用户会话验证失败, 状态码:', response.status);
        throw new Error("用户会话验证失败");
      }
    } catch (error) {
      console.error("[useAuth] 登录验证失败:", error);
      // 清除可能无效的数据
      localStorage.removeItem("user");
      setUser(null);
      // 重定向到登录页
      setLocation("/login");
    }
  }, [setLocation]);

  // 登出
  const logout = useCallback(async () => {
    try {
      // 通知服务器进行登出
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error("服务器登出请求失败:", error);
    } finally {
      // 清除知识图谱缓存
      clearKnowledgeGraphCache();
      console.log('[useAuth] 登出时清除所有知识图谱缓存');
      
      // 无论服务器响应如何，都清除本地状态
      localStorage.removeItem("user");
      setUser(null);
      setLocation("/login");
    }
  }, [setLocation]);

  return {
    userId: user?.userId,
    username: user?.username,
    role: user?.role,
    isLoggedIn: !!user,
    isAdmin: user?.role === "admin",
    login,
    logout,
    refreshUserState: updateUserState, // 导出刷新用户状态的方法
  };
};