import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AIChat } from "@/components/ui/ai-chat";

export default function Home() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState(() => {
    const userInfoStr = localStorage.getItem("userInfo");
    if (!userInfoStr) return null;
    try {
      const userInfo = JSON.parse(userInfoStr);
      if (!userInfo || !userInfo.userId || !userInfo.token) return null; // Added token check
      return userInfo;
    } catch (e) {
      console.error("解析用户信息失败:", e);
      localStorage.removeItem("userInfo");
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      setLocation("/login");
      return;
    }
    setIsAuthenticated(true); // Set isAuthenticated based on user state
  }, [user, setLocation]);

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
      <AIChat user={user} /> {/* Pass user data to AIChat */}
    </div>
  );
}