import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AIChat } from "@/components/ui/ai-chat";
import { BackgroundUploader } from "@/components/background-uploader";
import { Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useAuth } from "../App"; // 导入认证上下文
import { clearAuthAndRedirect } from "@/lib/authVerifier"; // 导入登出方法

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth(); // 使用认证上下文
  const [backgroundUrl, setBackgroundUrl] = useState<string>("/backgrounds/default-background.png");

  useEffect(() => {
    console.log('[Home] 认证状态:', { isAuthenticated, isLoading });
    
    // 如果认证状态已加载完成且未认证，重定向到登录页
    if (!isLoading && !isAuthenticated) {
      console.log('[Home] 用户未认证，重定向到登录页');
      setLocation("/login");
      return;
    }
    
    // 如果用户已认证且是管理员，重定向到管理页面
    if (!isLoading && isAuthenticated && user?.role === 'admin') {
      console.log('[Home] 管理员用户，重定向到管理控制台');
      setLocation("/admin");
      return;
    }
    
    // 如果认证状态已加载完成且已认证，获取背景图片
    if (!isLoading && isAuthenticated && user) {
      console.log('[Home] 用户已认证，ID:', user.id);
      
      // 获取用户背景图片
      fetchUserBackground();
      
      // 监听背景图片更新事件
      const handleBackgroundUpdated = (event: any) => {
        console.log('[Home] 收到背景图片更新事件:', event.detail);
        if (event.detail && event.detail.url) {
          const newBgUrl = event.detail.url;
          // 添加缓存破坏参数
          const cacheBuster = newBgUrl.includes('?') ? `&t=${new Date().getTime()}` : `?t=${new Date().getTime()}`;
          console.log('[Home] 更新背景图片:', newBgUrl);
          setBackgroundUrl(newBgUrl + cacheBuster);
        }
      };
      
      // 添加自定义事件监听器
      window.addEventListener('background-updated', handleBackgroundUpdated);
      
      // 组件卸载时移除事件监听
      return () => {
        window.removeEventListener('background-updated', handleBackgroundUpdated);
      };
    }
  }, [isAuthenticated, isLoading, user, setLocation]);
  
  // 获取用户背景图片
  const fetchUserBackground = async () => {
    try {
      // 现在使用认证上下文中的用户数据
      if (!user || !user.id) {
        console.error('[Home] 获取背景图片失败: 未找到有效的用户ID');
        throw new Error("未找到有效的用户ID");
      }
      
      const userId = user.id;
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
        let fullImageUrl = response.data.url.startsWith('http') 
          ? response.data.url 
          : `${baseUrl}${response.data.url}`;
        
        // 检查URL是否包含用户ID参数，如果没有则添加
        if (fullImageUrl.includes('/api/files/') && !fullImageUrl.includes('userId=')) {
          const separator = fullImageUrl.includes('?') ? '&' : '?';
          fullImageUrl += `${separator}userId=${userId}`;
        }
        
        console.log('[Home] 设置背景图片:', fullImageUrl);
        
        // 添加时间戳或随机参数防止缓存
        const cacheBuster = fullImageUrl.includes('?') ? `&t=${new Date().getTime()}` : `?t=${new Date().getTime()}`;
        setBackgroundUrl(fullImageUrl + cacheBuster);
      }
    } catch (error) {
      console.error('[Home] 获取背景图片失败:', error);
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
  
  // 处理登出 - 使用authVerifier中的clearAuthAndRedirect方法
  const handleLogout = () => {
    console.log('[Home] 执行登出操作');
    clearAuthAndRedirect();
  };

  // 只有在已认证且有用户数据时才渲染内容
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-foreground text-lg">Loading...</p>
      </div>
    );
  }

  // 未认证或没有用户数据时不渲染内容
  if (!isAuthenticated || !user) {
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
        <AIChat userData={user} />
      </div>
    </div>
  );
}