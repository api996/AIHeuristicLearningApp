import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AIChat } from "@/components/ui/ai-chat";

export default function Home() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<{ userId: number; role: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      // 重定向到登录页面
      setLocation("/login");
      return;
    }

    try {
      const userData = JSON.parse(userStr);
      if (!userData.userId) {
        console.error("无效的用户数据");
        localStorage.removeItem("user");
        setLocation("/login");
        return;
      }
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("登录状态解析错误:", error);
      localStorage.removeItem("user");
      setLocation("/login");
    }
  }, [setLocation]);

  // 如果用户未认证，显示加载中
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="text-lg text-white">正在检查登录状态...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <AIChat />
    </div>
  );
}