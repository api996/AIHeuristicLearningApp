/**
 * 背景容器
 * 在页面上显示自定义背景图片
 */

import React, { ReactNode, useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface BackgroundContainerProps {
  children: ReactNode;
}

export function BackgroundContainer({ children }: BackgroundContainerProps) {
  const { backgroundImage, theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  
  // 缓存背景图片
  useEffect(() => {
    if (backgroundImage?.url) {
      const img = new Image();
      img.src = backgroundImage.url;
      img.onload = () => setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [backgroundImage?.url]);
  
  // 控制背景图片效果
  const getBackgroundStyles = () => {
    if (!backgroundImage) return {};
    
    return {
      backgroundImage: `url(${backgroundImage.url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    };
  };
  
  // 根据主题添加不同的遮罩
  const getOverlayClass = () => {
    if (!backgroundImage) return '';
    
    // 根据主题添加透明度不同的遮罩
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      return 'after:absolute after:inset-0 after:bg-black/70 after:z-[-1]';
    }
    
    return 'after:absolute after:inset-0 after:bg-white/75 after:z-[-1]';
  };
  
  // 应用背景过渡效果
  const bgTransitionClass = 'transition-all duration-1000 ease-in-out';
  
  return (
    <div 
      className={`relative min-h-screen w-full ${getOverlayClass()} ${bgTransitionClass}`}
      style={getBackgroundStyles()}
    >
      <div className="relative z-0">
        {children}
      </div>
    </div>
  );
}
