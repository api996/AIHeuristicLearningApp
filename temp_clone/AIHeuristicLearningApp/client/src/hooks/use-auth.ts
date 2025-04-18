import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

interface User {
  userId: number;
  username: string;
  role: "user" | "admin";
}

export const useAuth = () => {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);

  // 初始化时从本地存储加载用户
  useEffect(() => {
    // 同步获取用户信息函数
    const getUserFromStorage = () => {
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
    };

    // 设置用户状态
    const userData = getUserFromStorage();
    setUser(userData);
    
  }, []);

  // 登录
  const login = useCallback((userData: User) => {
    if (!userData || !userData.userId) {
      throw new Error("Invalid user data");
    }
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
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
  };
};