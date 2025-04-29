/**
 * 背景容器
 * 在页面上显示自定义背景图片
 */
import React, { ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface BackgroundContainerProps {
  children: ReactNode;
}

export function BackgroundContainer({ children }: BackgroundContainerProps) {
  const { backgroundImage } = useTheme();

  // 尝试使用默认背景图片如果没有设置自定义背景
  const defaultBackground = "/backgrounds/default-background.jpg";
  
  // 判断是否为移动设备或竖屏模式
  const isPortrait = window.innerHeight > window.innerWidth;
  const portraitBackground = "/backgrounds/portrait-background.jpg";
  
  // 确定要使用的背景图片路径
  const getBackgroundUrl = () => {
    if (backgroundImage && backgroundImage.url) {
      return backgroundImage.url;
    }
    
    // 根据方向选择默认背景
    return isPortrait ? portraitBackground : defaultBackground;
  };
  
  // 调试信息
  console.log(`背景容器: 使用背景图片 ${getBackgroundUrl()}, 主题状态: ${backgroundImage ? '自定义' : '默认'}`);
  
  // 获取背景样式
  const backgroundStyle = document.documentElement.dataset.backgroundStyle || 'blur';
  
  // 根据不同的样式模式设置对应的CSS
  const getOverlayStyle = () => {
    switch (backgroundStyle) {
      case 'solid':
        return 'bg-background/90'; // 隐藏背景图片较多
      case 'transparent':
        return 'bg-background/30'; // 半透明模式
      case 'blur':
      default:
        return 'backdrop-blur-sm bg-background/75'; // 默认模糊背景
    }
  };
  
  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat transition-all duration-300"
      style={{
        backgroundImage: `url(${getBackgroundUrl()})`,
        // 不使用主题背景色，避免黑色覆盖背景图片
        // backgroundColor: "var(--background)",
        // backgroundBlendMode: "overlay",
        backgroundAttachment: "fixed",
      }}
      data-theme-style={backgroundStyle}
    >
      <div className={`min-h-screen w-full ${getOverlayStyle()}`}>
        {children}
      </div>
    </div>
  );
}
