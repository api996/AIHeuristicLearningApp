/**
 * 简化版主题系统
 * 仅保留基本主题功能，移除高级设置以简化维护
 */

import React from 'react';
import { ThemeProvider as OldThemeProvider } from '@/contexts/ThemeContext'; 
import { BackgroundContainer as OldBackgroundContainer } from '@/components/ui/background-container';

// 我们已经彻底移除了新主题系统相关代码
// 只使用旧版本主题系统的基本功能（明暗主题和字体大小）

/**
 * 简化版主题提供者
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <OldThemeProvider>{children}</OldThemeProvider>;
}

/**
 * 简化版背景容器
 */
export function BackgroundContainer({ children }: { children: React.ReactNode }) {
  return <OldBackgroundContainer>{children}</OldBackgroundContainer>;
}

// 统一的useTheme钩子
export { useTheme } from '@/contexts/ThemeContext';
