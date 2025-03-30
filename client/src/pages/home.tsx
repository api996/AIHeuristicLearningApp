import { useEffect } from "react";
import { useLocation } from "wouter";
import { AIChat } from "@/components/ui/ai-chat";

export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      console.log('[Home] No user session found, redirecting to login');
      setLocation("/login");
      return;
    }

    try {
      const userData = JSON.parse(user);
      if (!userData.userId) {
        console.log('[Home] Invalid user data, redirecting to login');
        localStorage.removeItem("user");
        setLocation("/login");
      }
    } catch (e) {
      console.error('[Home] Error parsing user data:', e);
      localStorage.removeItem("user");
      setLocation("/login");
    }
  }, [setLocation]);

  // 只有在localStorage中有用户数据时才渲染AIChat组件
  const user = localStorage.getItem("user");
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <AIChat />
    </div>
  );
}