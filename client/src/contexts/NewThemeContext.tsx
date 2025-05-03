/**
 * 新版主题上下文
 * 使用统一的ThemeService管理主题状态
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { 
  themeService, 
  type FontSize, 
  type Theme, 
  type BackgroundImage, 
  type BackgroundStyle,
  type UserThemeSettings
} from '@/services/ThemeService';

// 主题上下文类型
interface ThemeContextType {
  // 基本设置
  fontSize: FontSize;
  theme: Theme;
  backgroundImage: BackgroundImage | null;
  primaryColor: string;
  backgroundStyle: BackgroundStyle;
  uiRadius: number;
  
  // 设置方法
  setFontSize: (size: FontSize) => void;
  setTheme: (theme: Theme) => void;
  setBackgroundImage: (image: BackgroundImage | null) => void;
  setPrimaryColor: (color: string) => void;
  setBackgroundStyle: (style: BackgroundStyle) => void;
  setUiRadius: (radius: number) => void;
  
  // 背景图片相关
  clearBackgroundImage: () => void;
  uploadBackgroundImage: (file: File) => Promise<BackgroundImage>;
  
  // 状态
  isLoading: boolean;
}

// 创建上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 主题提供者组件属性
interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * 主题提供者组件
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 初始化状态
  const [settings, setSettings] = useState<UserThemeSettings>({
    fontSize: 'medium',
    theme: 'system',
    primaryColor: '#0deae4',
    backgroundStyle: 'blur',
    uiRadius: 8,
    backgroundImage: null
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // 监听设置变化
  useEffect(() => {
    // 应用设置到DOM
    if (!isLoading) {
      themeService.applySettingsToDOM(settings);
    }
  }, [settings, isLoading]);
  
  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const loadedSettings = await themeService.getSettings();
        setSettings(loadedSettings);
        // 应用主题设置到DOM
        themeService.applySettingsToDOM(loadedSettings);
        console.log('[主题提供者] 加载用户设置成功', loadedSettings);
      } catch (error) {
        console.error('[主题提供者] 加载设置出错:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // 监听系统主题变化
  useEffect(() => {
    if (!isLoading && settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        // 当系统主题变化时，重新应用主题
        themeService.applySettingsToDOM(settings);
      };
      
      // 添加监听器
      mediaQuery.addEventListener('change', handleChange);
      
      // 清理函数
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [isLoading, settings.theme]);
  
  // 监听页面路径变化，强制知识图谱页面使用深色主题
  useEffect(() => {
    if (!isLoading) {
      // 检查当前路径是否为知识图谱页面
      themeService.applyDarkThemeToKnowledgeGraph();
      
      // 监听路径变化
      const handleRouteChange = () => {
        themeService.applyDarkThemeToKnowledgeGraph();
      };
      
      // 添加历史记录监听
      window.addEventListener('popstate', handleRouteChange);
      
      // 清理函数
      return () => {
        window.removeEventListener('popstate', handleRouteChange);
      };
    }
  }, [isLoading]);
  
  // 更新设置函数
  const updateSettings = async (newSettings: Partial<UserThemeSettings>) => {
    try {
      // 先本地更新
      setSettings(prev => ({ ...prev, ...newSettings }));
      
      // 然后异步保存到数据库
      await themeService.saveSettings(newSettings);
    } catch (error) {
      console.error('[主题提供者] 保存设置出错:', error);
    }
  };
  
  // 为上下文提供的值
  const contextValue: ThemeContextType = {
    // 当前设置值
    fontSize: settings.fontSize,
    theme: settings.theme,
    backgroundImage: settings.backgroundImage || null,
    primaryColor: settings.primaryColor,
    backgroundStyle: settings.backgroundStyle,
    uiRadius: settings.uiRadius,
    
    // 设置方法
    setFontSize: (size) => updateSettings({ fontSize: size }),
    setTheme: (theme) => updateSettings({ theme }),
    setPrimaryColor: (color) => updateSettings({ primaryColor: color }),
    setBackgroundStyle: (style) => updateSettings({ backgroundStyle: style }),
    setUiRadius: (radius) => updateSettings({ uiRadius: radius }),
    
    // 背景图片相关方法
    setBackgroundImage: (image) => {
      updateSettings({ 
        backgroundImage: image,
        // 如果有新图片，同时更新backgroundFile
        backgroundFile: image ? image.fileId : null
      });
    },
    
    clearBackgroundImage: () => {
      updateSettings({ 
        backgroundImage: null,
        backgroundFile: null
      });
    },
    
    uploadBackgroundImage: async (file) => {
      try {
        const newBackgroundImage = await themeService.uploadBackgroundImage(file);
        setSettings(prev => ({
          ...prev,
          backgroundImage: newBackgroundImage,
          backgroundFile: newBackgroundImage.fileId
        }));
        return newBackgroundImage;
      } catch (error) {
        console.error('[主题提供者] 上传背景图片出错:', error);
        throw error;
      }
    },
    
    // 状态
    isLoading
  };
  
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * 使用主题Hook
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme必须在ThemeProvider内部使用');
  }
  return context;
}
