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
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.userId) {
          setUser(parsedUser);
        }
      } catch (error) {
        console.error("Failed to parse user data:", error);
        localStorage.removeItem("user");
      }
    }
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