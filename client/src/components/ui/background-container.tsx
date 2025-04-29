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

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat transition-all duration-300"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage.url})` : "none",
        backgroundColor: "var(--background)",
        backgroundBlendMode: "overlay",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="min-h-screen w-full backdrop-blur-sm bg-background/75">
        {children}
      </div>
    </div>
  );
}
