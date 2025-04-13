import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import AIChat from "@/components/ui/ai-chat";

export default function Home() {
  const [, setLocation] = useLocation();
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>("user");

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

      setUserId(parsedUser.userId);
      setUserRole(parsedUser.role || "user");
    } catch (e) {
      console.error('[Home] Error parsing user data:', e);
      localStorage.removeItem("user");
      setLocation("/login");
    }
  }, [setLocation]);

  // 只有在有有效用户数据时才渲染内容
  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <AIChat userId={userId} userRole={userRole} />
    </div>
  );
}