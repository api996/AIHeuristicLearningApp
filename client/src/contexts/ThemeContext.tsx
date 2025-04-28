/**
 * 主题上下文
 * 全局主题状态管理，确保跨页面保持主题设置一致性
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// 字体大小类型
export type FontSize = 'small' | 'medium' | 'large';

// 主题类型
export type Theme = 'light' | 'dark' | 'system';

// 主题上下文类型
interface ThemeContextType {
  fontSize: FontSize;
  theme: Theme;
  setFontSize: (size: FontSize) => void;
  setTheme: (theme: Theme) => void;
}

// 创建上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 主题提供者组件属性
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 从localStorage初始化状态，默认为中等字体和系统主题
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const savedSize = localStorage.getItem('font-size') as FontSize;
    return savedSize || 'medium';
  });
  
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'system';
  });

  // 应用字体大小设置
  const applyFontSize = (size: FontSize) => {
    // 移除所有字体大小类
    document.documentElement.classList.remove('text-sm', 'text-md', 'text-lg');

    // 应用新字体大小
    switch (size) {
      case "small":
        document.documentElement.classList.add('text-sm');
        break;
      case "medium":
        document.documentElement.classList.add('text-md');
        break;
      case "large":
        document.documentElement.classList.add('text-lg');
        break;
    }

    // 保存设置到本地存储
    localStorage.setItem('font-size', size);
  };

  // 应用主题设置到DOM
  const applyTheme = (newTheme: Theme) => {
    // 移除所有主题类
    document.documentElement.classList.remove('light', 'dark');

    // 应用新主题
    if (newTheme === "system") {
      // 根据系统偏好设置主题
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add('light');
      }
    } else {
      // 直接应用指定主题
      document.documentElement.classList.add(newTheme);
    }

    // 保存设置到本地存储
    localStorage.setItem('theme', newTheme);
  };

  // 提供设置方法
  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  // 初始应用设置
  useEffect(() => {
    applyFontSize(fontSize);
    applyTheme(theme);

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    // 添加监听器
    mediaQuery.addEventListener('change', handleChange);

    // 清理函数
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [fontSize, theme]);

  // 上下文值
  const contextValue = {
    fontSize,
    theme,
    setFontSize,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// 自定义hook，方便使用主题上下文
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};