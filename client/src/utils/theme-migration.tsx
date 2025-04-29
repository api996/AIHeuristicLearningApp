/**
 * 主题系统迁移工具
 * 帮助应用从旧版主题系统平滑迁移到新版统一主题服务
 */

import React from 'react';
import { ThemeProvider as OldThemeProvider } from '@/contexts/ThemeContext'; 
import { ThemeProvider as NewThemeProvider } from '@/contexts/NewThemeContext';
import { BackgroundContainer as OldBackgroundContainer } from '@/components/ui/background-container';
import { BackgroundContainer as NewBackgroundContainer } from '@/components/ui/new-background-container';

// 配置标记 - 可以通过环境变量或特性开关控制
// 当前设置为使用旧版主题系统，减少风险同时继续实施其他统一改进
// 完成所有更改后可以改为true使用新系统
export const USE_NEW_THEME_SYSTEM = false;

/**
 * 支持切换的主题提供者
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 根据配置选择使用哪个主题提供者
  return USE_NEW_THEME_SYSTEM ? (
    <NewThemeProvider>{children}</NewThemeProvider>
  ) : (
    <OldThemeProvider>{children}</OldThemeProvider>
  );
}

/**
 * 支持切换的背景容器
 */
export function BackgroundContainer({ children }: { children: React.ReactNode }) {
  // 根据配置选择使用哪个背景容器
  return USE_NEW_THEME_SYSTEM ? (
    <NewBackgroundContainer>{children}</NewBackgroundContainer>
  ) : (
    <OldBackgroundContainer>{children}</OldBackgroundContainer>
  );
}

// 统一的useTheme钩子
// 注意: 直接导出对应上下文的useTheme函数
export { useTheme } from '@/contexts/ThemeContext';
