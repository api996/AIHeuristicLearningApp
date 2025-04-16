import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AIChat } from "@/components/ui/ai-chat";
import { BackgroundUploader } from "@/components/background-uploader";
import { Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

export default function Home() {
  const [, setLocation] = useLocation();
  const [userData, setUserData] = useState<any>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string>("/backgrounds/default-background.png");

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
      
      // 获取用户背景图片
      fetchUserBackground();
    } catch (e) {
      console.error('[Home] Error parsing user data:', e);
      localStorage.removeItem("user");
      setLocation("/login");
    }
  }, [setLocation]);
  
  // 获取用户背景图片
  const fetchUserBackground = async () => {
    try {
      const response = await axios.get('/api/files/background');
      if (response.data && response.data.url) {
        setBackgroundUrl(response.data.url);
      }
    } catch (error) {
      console.error('获取背景图片失败:', error);
      // 使用默认背景
    }
  };
  
  // 处理登出
  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  // 只有在有有效用户数据时才渲染内容
  if (!userData) {
    return null;
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: `url('${backgroundUrl}')` }}
    >
      {/* 半透明遮罩，提高文字对比度 */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      {/* 顶部工具栏 */}
      <div className="relative z-10 p-4 flex justify-between items-center">
        {/* 左侧用户信息 */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full bg-white/10 backdrop-blur-sm">
            <User className="text-white" size={20} />
          </Button>
          <span className="text-white font-medium">{userData.username || '用户'}</span>
        </div>
        
        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-2">
          <BackgroundUploader 
            userId={userData.userId} 
            onBackgroundChange={(url) => setBackgroundUrl(url)}
          />
          <Button variant="ghost" size="icon" className="rounded-full bg-white/10 backdrop-blur-sm" onClick={handleLogout}>
            <Settings className="text-white" size={20} />
          </Button>
        </div>
      </div>
      
      {/* 主要内容 */}
      <div className="relative z-10">
        <AIChat userData={userData} />
      </div>
    </div>
  );
}