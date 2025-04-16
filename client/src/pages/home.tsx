import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AIChat } from "@/components/ui/ai-chat";
import { Navbar } from "@/components/ui/navbar"; // 导入导航栏组件

export default function Home() {
  const [, setLocation] = useLocation();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      console.log('[Home] No user session found, redirecting to login');
      setLocation("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(user);
      if (!parsedUser.userId) {
        console.log('[Home] Invalid user data, redirecting to login');
        localStorage.removeItem("user");
        setLocation("/login");
        return;
      }

      // 管理员应该被重定向到管理控制台
      if (parsedUser.role === 'admin') {
        console.log('[Home] Admin user detected, redirecting to admin dashboard');
        setLocation("/admin");
        return;
      }

      setUserData(parsedUser);
    } catch (e) {
      console.error('[Home] Error parsing user data:', e);
      localStorage.removeItem("user");
      setLocation("/login");
    }
  }, [setLocation]);

  // 只有在有有效用户数据时才渲染内容
  if (!userData) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar /> {/* 添加导航栏组件，显示个人中心 */}
      <div className="flex-1">
        <AIChat userData={userData} />
      </div>
    </div>
  );
}