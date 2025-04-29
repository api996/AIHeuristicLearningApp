/**
 * 主题系统迁移工具
 * 帮助应用从旧版主题系统平滑迁移到新版统一主题服务
 */

import React, { useMemo } from 'react';
import { ThemeProvider as OldThemeProvider } from '@/contexts/ThemeContext'; 
import { ThemeProvider as NewThemeProvider } from '@/contexts/NewThemeContext';
import { BackgroundContainer as OldBackgroundContainer } from '@/components/ui/background-container';
import { BackgroundContainer as NewBackgroundContainer } from '@/components/ui/new-background-container';

// 配置标记 - 可以通过环境变量或特性开关控制
// 当先选使用新版主题系统，如果有问题可以快速切回旧版
// TODO: 等新版系统稳定后删除这个标记和相关代码
// 通过环境变量控制，如果不存在，默认使用新版主题系统
export const USE_NEW_THEME_SYSTEM = true;

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

/**
 * 统一的useTheme hook
 * 根据当前配置自动使用新旧版本
 */
export function useTheme() {
  // 决定要导入哪个模块
  if (USE_NEW_THEME_SYSTEM) {
    // 导入新版useTheme
    const { useTheme: useNewTheme } = require('@/contexts/NewThemeContext');
    return useNewTheme();
  } else {
    // 导入旧版useTheme
    const { useTheme: useOldTheme } = require('@/contexts/ThemeContext');
    return useOldTheme();
  }
}
