import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

interface User {
  userId: number;
  username: string;
  role: "user" | "admin";
}

// 创建一个自定义事件，用于在用户注册后通知所有组件
export const authEvents = {
  userRegistered: new CustomEvent('userRegistered'),
  dispatchUserRegistered: () => {
    document.dispatchEvent(authEvents.userRegistered);
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
    
    // 添加事件监听器
    document.addEventListener('userRegistered', handleUserRegistered);
    
    // 清理函数
    return () => {
      document.removeEventListener('userRegistered', handleUserRegistered);
    };
  }, [updateUserState]);

  // 登录
  const login = useCallback((userData: User) => {
    if (!userData || !userData.userId) {
      throw new Error("Invalid user data");
    }
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    authEvents.dispatchUserRegistered(); // 触发用户注册事件
    setLocation("/");
  }, [setLocation]);

  // 登出
  const logout = useCallback(() => {
    localStorage.removeItem("user");
    setUser(null);
    setLocation("/login");
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