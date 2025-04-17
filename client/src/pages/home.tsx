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
      // 确保使用当前登录用户的ID
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (!currentUser.userId) {
        throw new Error("未登录用户");
      }
      
      const userId = currentUser.userId;
      const baseUrl = window.location.origin;
      
      // 检测当前屏幕方向
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      const apiUrl = `${baseUrl}/api/files/background?userId=${userId}&orientation=${isPortrait ? 'portrait' : 'landscape'}`;
      
      console.log(`[Home] 获取用户背景图片，请求: ${apiUrl}，屏幕方向: ${isPortrait ? '竖屏' : '横屏'}`);
      
      // 添加认证信息确保请求中包含会话信息
      const response = await axios.get(apiUrl, {
        withCredentials: true,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
      
      if (response.data && response.data.url) {
        const fullImageUrl = response.data.url.startsWith('http') 
          ? response.data.url 
          : `${baseUrl}${response.data.url}`;
        console.log('[Home] 设置背景图片:', fullImageUrl);
        
        // 添加时间戳或随机参数防止缓存
        const cacheBuster = `?t=${new Date().getTime()}`;
        setBackgroundUrl(fullImageUrl + cacheBuster);
      }
    } catch (error) {
      console.error('获取背景图片失败:', error);
      // 使用默认背景，根据屏幕方向选择
      const baseUrl = window.location.origin;
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      const defaultBackground = isPortrait
        ? `${baseUrl}/backgrounds/portrait-background.jpg`
        : `${baseUrl}/backgrounds/landscape-background.jpg`;
      console.log(`[Home] 使用默认${isPortrait ? '竖屏' : '横屏'}背景:`, defaultBackground);
      setBackgroundUrl(defaultBackground);
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
      
      {/* 已移除顶部工具栏，使用AI聊天组件中的导航栏 */}
      
      {/* 主要内容 */}
      <div className="relative z-10">
        <AIChat userData={userData} />
      </div>
    </div>
  );
}