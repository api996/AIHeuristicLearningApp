import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AIChat } from "@/components/ui/ai-chat";

export default function Home() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<{ userId: number; role: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      console.log('No user found in localStorage, redirecting to login');
      setLocation('/login');
      return;
    }
    try {
      const userData = JSON.parse(userStr);
      if (!userData || !userData.userId) {
        console.log('Invalid user data, redirecting to login');
        localStorage.removeItem('user'); // Clear invalid user data
        setLocation('/login');
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error('Failed to parse user data:', error);
      localStorage.removeItem('user'); // Clear corrupted user data
      setLocation('/login');
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