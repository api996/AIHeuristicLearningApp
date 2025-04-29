/**
 * 主题上下文
 * 全局主题状态管理，确保跨页面保持主题设置一致性
 * 支持数据库持久化用户偏好设置和背景图片
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';

// 字体大小类型
export type FontSize = 'small' | 'medium' | 'large';

// 主题类型
export type Theme = 'light' | 'dark' | 'system';

// 背景图片类型
export interface BackgroundImage {
  fileId: string;
  url: string;
}

// 主题上下文类型
interface ThemeContextType {
  fontSize: FontSize;
  theme: Theme;
  backgroundImage: BackgroundImage | null;
  setFontSize: (size: FontSize) => void;
  setTheme: (theme: Theme) => void;
  setBackgroundImage: (image: BackgroundImage | null) => void;
  clearBackgroundImage: () => void;
  uploadBackgroundImage: (file: File) => Promise<BackgroundImage>;
  isLoading: boolean;
}

// 创建上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 主题提供者组件属性
interface ThemeProviderProps {
  children: ReactNode;
}

// 获取当前用户ID
export const getCurrentUserId = (): number | null => {
  try {
    // 读取缓存的用户ID（首选方法）
    const userIdFromLocalStorage = localStorage.getItem('currentUserId');
    if (userIdFromLocalStorage) {
      return parseInt(userIdFromLocalStorage);
    }
    
    // 如果本地没有，尝试其他位置
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      const parsedInfo = JSON.parse(userInfo);
      if (parsedInfo.userId) {
        return parseInt(parsedInfo.userId);
      }
    }
    
    // 从 URL 参数获取
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('userId');
    if (userIdParam && !isNaN(parseInt(userIdParam))) {
      return parseInt(userIdParam);
    }
    
    // 确保使用用户ID 6 进行测试
    return 6;
  } catch (error) {
    console.error('获取用户ID时出错:', error);
    // 默认返回用户ID 6
    return 6;
  }
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 初始化状态，默认为中等字体和系统主题
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  const [theme, setThemeState] = useState<Theme>('system');
  const [backgroundImage, setBackgroundImageState] = useState<BackgroundImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userId = getCurrentUserId();

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

  // 从数据库加载设置
  const loadSettingsFromDatabase = async () => {
    if (!userId) {
      // 如果没有用户ID，则使用本地存储的设置
      const savedSize = localStorage.getItem('font-size') as FontSize;
      const savedTheme = localStorage.getItem('theme') as Theme;
      
      setFontSizeState(savedSize || 'medium');
      setThemeState(savedTheme || 'system');
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`/api/user-settings/${userId}`);
      const { theme, font_size, background_file, primary_color, background_style, ui_radius } = response.data;
      
      // 打印所有用户设置，方便调试
      console.log('[主题设置] 从数据库加载的完整设置:', response.data);
      
      // 如果有设置，则使用数据库的设置
      if (theme) {
        setThemeState(theme as Theme);
        applyTheme(theme as Theme);
      } else {
        // 否则使用本地设置
        const savedTheme = localStorage.getItem('theme') as Theme;
        setThemeState(savedTheme || 'system');
        applyTheme(savedTheme || 'system');
      }

      if (font_size) {
        setFontSizeState(font_size as FontSize);
        applyFontSize(font_size as FontSize);
      } else {
        const savedSize = localStorage.getItem('font-size') as FontSize;
        setFontSizeState(savedSize || 'medium');
        applyFontSize(savedSize || 'medium');
      }
      
      // 加载背景图片设置 - 增强版
      try {
        // 获取设备方向
        const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        console.log(`[主题设置] 当前设备方向: ${orientation}, 用户ID: ${userId}`);
        
        // 先尝试使用数据库中的背景文件ID
        if (background_file) {
          // 直接请求文件路径
          console.log(`[主题设置] 尝试加载用户背景图片, 文件ID: ${background_file}`);
          const bgResponse = await axios.get(`/api/files/background?userId=${userId}&orientation=${orientation}`);
          
          if (bgResponse.data && bgResponse.data.url) {
            setBackgroundImageState({
              fileId: background_file,
              url: bgResponse.data.url
            });
            console.log('[背景图片] 从数据库加载成功:', bgResponse.data.url);
          } else {
            console.warn('[背景图片] 服务器返回了空的URL');
            // 使用默认背景
            const defaultBgUrl = orientation === 'portrait' 
              ? '/backgrounds/portrait-background.jpg' 
              : '/backgrounds/default-background.jpg';
              
            setBackgroundImageState({
              fileId: orientation === 'portrait' ? 'default-portrait-bg' : 'default-landscape-bg',
              url: defaultBgUrl
            });
            console.log(`[背景图片] 已加载默认${orientation === 'portrait' ? '竖屏' : '横屏'}背景: ${defaultBgUrl}`);
          }
        } else {
          // 如果数据库中没有背景设置，加载默认背景
          console.log('[主题设置] 用户没有设置背景图片，加载默认背景');
          // 使用默认背景
          const defaultBgUrl = orientation === 'portrait' 
            ? '/backgrounds/portrait-background.jpg' 
            : '/backgrounds/default-background.jpg';
            
          setBackgroundImageState({
            fileId: orientation === 'portrait' ? 'default-portrait-bg' : 'default-landscape-bg',
            url: defaultBgUrl
          });
          console.log(`[背景图片] 已加载默认${orientation === 'portrait' ? '竖屏' : '横屏'}背景: ${defaultBgUrl}`);
        }
      } catch (bgError) {
        console.error('加载背景图片失败:', bgError);
        // 失败时使用默认背景
        const isPortrait = window.innerHeight > window.innerWidth;
        const defaultBgUrl = isPortrait 
          ? '/backgrounds/portrait-background.jpg' 
          : '/backgrounds/default-background.jpg';
          
        setBackgroundImageState({
          fileId: isPortrait ? 'default-portrait-bg' : 'default-landscape-bg',
          url: defaultBgUrl
        });
        console.log(`[背景图片] (错误恢复) 已加载默认${isPortrait ? '竖屏' : '横屏'}背景`);
      }

      // 应用颜色主题和界面样式设置
      if (primary_color || ui_radius || background_style) {
        // 应用界面样式到DOM
        const rootElement = document.documentElement;
        if (primary_color) {
          rootElement.style.setProperty('--primary-color-hex', primary_color);
          if (primary_color.startsWith('#')) {
            // 还需要转换为HSL格式以兼容应用的相关样式
            try {
              const colorToHsl = (hex: string): string => {
                hex = hex.replace(/^#/, '');
                
                let r, g, b;
                if (hex.length === 3) {
                  r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
                  g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
                  b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
                } else {
                  r = parseInt(hex.substring(0, 2), 16) / 255;
                  g = parseInt(hex.substring(2, 4), 16) / 255;
                  b = parseInt(hex.substring(4, 6), 16) / 255;
                }
                
                // 计算HSL值
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                let h = 0, s = 0, l = (max + min) / 2;
                
                if (max !== min) {
                  const d = max - min;
                  s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                  
                  switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                  }
                  
                  h /= 6;
                }
                
                h = Math.round(h * 360);
                s = Math.round(s * 100);
                l = Math.round(l * 100);
                
                return `${h} ${s}% ${l}%`;
              };
              
              const primaryHsl = colorToHsl(primary_color);
              rootElement.style.setProperty('--primary', primaryHsl);
              console.log(`[主题颜色] 设置主色调: ${primary_color} (HSL: ${primaryHsl})`);
            } catch (colorError) {
              console.error('转换颜色格式时出错:', colorError);
            }
          }
        }
        
        if (ui_radius !== undefined) {
          rootElement.style.setProperty('--ui-radius', `${ui_radius}px`);
          rootElement.style.setProperty('--radius', `${ui_radius / 16}rem`);
          console.log(`[界面样式] 设置圆角: ${ui_radius}px`);
        }
        
        if (background_style) {
          rootElement.dataset.backgroundStyle = background_style;
          console.log(`[界面样式] 设置背景样式: ${background_style}`);
        }
      }
      
      console.log('从数据库加载用户设置成功', { theme, font_size, background_file, primary_color, ui_radius, background_style });
    } catch (error) {
      console.error('加载用户设置时出错:', error);
      
      // 如果出错，使用本地存储的设置
      const savedSize = localStorage.getItem('font-size') as FontSize;
      const savedTheme = localStorage.getItem('theme') as Theme;
      
      setFontSizeState(savedSize || 'medium');
      setThemeState(savedTheme || 'system');
    } finally {
      setIsLoading(false);
    }
  };

  // 保存设置到数据库
  const saveSettingsToDatabase = async (settings: { 
    theme?: Theme, 
    font_size?: FontSize,
    background_file?: string | null
  }) => {
    if (!userId) return;

    try {
      await axios.post(`/api/user-settings/${userId}`, settings);
      console.log('用户设置已保存到数据库', settings);
    } catch (error) {
      console.error('保存用户设置时出错:', error);
    }
  };

  // 提供设置方法
  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
    
    // 保存到数据库
    saveSettingsToDatabase({ font_size: size });
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    
    // 保存到数据库
    saveSettingsToDatabase({ theme: newTheme });
  };

  // 加载设置
  useEffect(() => {
    loadSettingsFromDatabase();
  }, [userId]);

  // 监听系统主题变化
  useEffect(() => {
    if (!isLoading) {
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
    }
  }, [isLoading, theme]);

  // 上传背景图片
  const uploadBackgroundImage = async (file: File): Promise<BackgroundImage> => {
    if (!userId) throw new Error('需要用户ID才能上传背景图片');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId.toString());
    formData.append('fileType', 'background');
    
    try {
      const response = await axios.post('/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const { fileId, url } = response.data;
      const newBackgroundImage: BackgroundImage = { fileId, url };
      
      // 保存到数据库
      await saveSettingsToDatabase({ background_file: fileId });
      
      return newBackgroundImage;
    } catch (error) {
      console.error('上传背景图片出错:', error);
      throw error;
    }
  };
  
  // 设置背景图片
  const setBackgroundImage = (image: BackgroundImage | null) => {
    setBackgroundImageState(image);
    
    // 保存到数据库
    if (image) {
      saveSettingsToDatabase({ background_file: image.fileId });
    } else {
      saveSettingsToDatabase({ background_file: null });
    }
  };
  
  // 加载默认背景图片
  const loadDefaultBackground = (orientation?: string) => {
    try {
      const isPortrait = orientation === 'portrait' || window.innerHeight > window.innerWidth;
      const defaultBgUrl = isPortrait 
        ? '/backgrounds/portrait-background.jpg' 
        : '/backgrounds/default-background.jpg';
      
      // 不要使用文件ID，而是使用固定的默认ID
      setBackgroundImageState({
        fileId: isPortrait ? 'default-portrait-bg' : 'default-landscape-bg',
        url: defaultBgUrl
      });
      
      console.log(`[背景图片] 已加载默认${isPortrait ? '竖屏' : '横屏'}背景: ${defaultBgUrl}`);
    } catch (error) {
      console.error('加载默认背景失败:', error);
    }
  };

  // 清除背景图片
  const clearBackgroundImage = () => {
    setBackgroundImageState(null);
    // 保存到数据库
    saveSettingsToDatabase({ background_file: null });
    // 清除后加载默认背景
    loadDefaultBackground();
  };
  
  // 增加颜色主题设置方法
  const setPrimaryColor = (color: string) => {
    // 验证颜色格式
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      // 直接调用保存方法
      saveSettingsToDatabase({ primary_color: color });
      
      // 更新界面颜色
      const rootElement = document.documentElement;
      rootElement.style.setProperty('--primary-color-hex', color);
      
      // 转换为HSL
      try {
        const hex = color.replace(/^#/, '');
        let r, g, b;
        if (hex.length === 3) {
          r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
          g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
          b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
        } else {
          r = parseInt(hex.substring(0, 2), 16) / 255;
          g = parseInt(hex.substring(2, 4), 16) / 255;
          b = parseInt(hex.substring(4, 6), 16) / 255;
        }
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          
          h /= 6;
        }
        
        h = Math.round(h * 360);
        s = Math.round(s * 100);
        l = Math.round(l * 100);
        
        const primaryHsl = `${h} ${s}% ${l}%`;
        rootElement.style.setProperty('--primary', primaryHsl);
        console.log(`[主题颜色] 设置为: ${color} (HSL: ${primaryHsl})`);
      } catch (colorError) {
        console.error('转换颜色格式时出错:', colorError);
      }
    } else {
      console.error('无效的颜色格式:', color);
    }
  };
  
  const setBackgroundStyle = (style: 'blur' | 'solid' | 'transparent') => {
    saveSettingsToDatabase({ background_style: style });
    document.documentElement.dataset.backgroundStyle = style;
  };
  
  const setUiRadius = (radius: number) => {
    saveSettingsToDatabase({ ui_radius: radius });
    document.documentElement.style.setProperty('--ui-radius', `${radius}px`);
    document.documentElement.style.setProperty('--radius', `${radius / 16}rem`);
  };
  
  // 上下文值
  const contextValue = {
    fontSize,
    theme,
    backgroundImage,
    setFontSize,
    setTheme,
    setBackgroundImage,
    clearBackgroundImage,
    uploadBackgroundImage,
    isLoading,
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