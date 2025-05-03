/**
 * 统一主题服务
 * 管理所有与用户偏好设置相关的业务逻辑
 */

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

// 背景样式
export type BackgroundStyle = 'blur' | 'solid' | 'transparent';

// 完整用户设置类型
export interface UserThemeSettings {
  theme: Theme;
  fontSize: FontSize;
  primaryColor: string;
  backgroundStyle: BackgroundStyle;
  uiRadius: number;
  backgroundFile?: string | null;
  backgroundImage?: BackgroundImage | null;
}

// 默认设置
const DEFAULT_SETTINGS: UserThemeSettings = {
  theme: 'system',
  fontSize: 'medium',
  primaryColor: '#0deae4',
  backgroundStyle: 'blur',
  uiRadius: 8,
  backgroundFile: null,
  backgroundImage: null
};

/**
 * 获取当前用户ID
 */
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
    
    // 默认返回测试用户ID 6
    return 6;
  } catch (error) {
    console.error('获取用户ID时出错:', error);
    // 默认使用测试用户ID
    return 6;
  }
};

/**
 * 将十六进制颜色转换为HSL格式
 */
export const hexToHSL = (hex: string): string => {
  if (!hex.startsWith('#')) {
    hex = `#${hex}`;
  }
  
  // 移除#前缀
  hex = hex.replace(/^#/, '');
  
  // 解析RGB值
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
  
  // 转换为CSS HSL格式
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h} ${s}% ${l}%`;
};

/**
 * 统一主题服务类
 */
class ThemeService {
  private userId: number | null = null;
  private settings: UserThemeSettings = { ...DEFAULT_SETTINGS };
  private loadPromise: Promise<UserThemeSettings> | null = null;
  
  constructor() {
    this.userId = getCurrentUserId();
  }
  
  /**
   * 取得当前用户设置
   */
  public async getSettings(): Promise<UserThemeSettings> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadSettingsFromDatabase();
    }
    return this.loadPromise;
  }
  
  /**
   * 从数据库加载用户设置
   */
  private async loadSettingsFromDatabase(): Promise<UserThemeSettings> {
    if (!this.userId) {
      // 如果没有用户ID，则使用本地存储的设置
      const savedSize = localStorage.getItem('font-size') as FontSize;
      const savedTheme = localStorage.getItem('theme') as Theme;
      
      const localSettings = { ...DEFAULT_SETTINGS };
      if (savedSize) localSettings.fontSize = savedSize;
      if (savedTheme) localSettings.theme = savedTheme;
      
      this.settings = localSettings;
      return localSettings;
    }

    try {
      const response = await axios.get(`/api/user-settings/${this.userId}`);
      const {
        theme, 
        font_size, 
        background_file, 
        primary_color, 
        background_style, 
        ui_radius 
      } = response.data;
      
      // 接收到的数据汇总
      console.log('[主题服务] 从数据库加载的设置:', response.data);
      
      // 构建新的设置对象
      const newSettings: UserThemeSettings = { ...DEFAULT_SETTINGS };
      
      // 如果有数据库中的设置，则使用数据库的设置
      if (theme) newSettings.theme = theme as Theme;
      if (font_size) newSettings.fontSize = font_size as FontSize;
      if (primary_color) newSettings.primaryColor = primary_color;
      if (background_style) newSettings.backgroundStyle = background_style as BackgroundStyle;
      if (ui_radius !== undefined) newSettings.uiRadius = ui_radius;
      if (background_file) newSettings.backgroundFile = background_file;
      
      // 加载背景图片设置 - 增强版
      try {
        // 获取设备方向
        const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        console.log(`[主题服务] 当前设备方向: ${orientation}, 用户ID: ${this.userId}`);
        
        // 先尝试使用数据库中的背景文件ID
        if (background_file) {
          // 直接请求文件路径
          console.log(`[主题服务] 尝试加载用户背景图片, 文件ID: ${background_file}`);
          const bgResponse = await axios.get(`/api/files/background?userId=${this.userId}&orientation=${orientation}`);
          
          if (bgResponse.data && bgResponse.data.url) {
            newSettings.backgroundImage = {
              fileId: background_file,
              url: bgResponse.data.url
            };
            console.log('[背景图片] 从数据库加载成功:', bgResponse.data.url);
          } else {
            console.warn('[背景图片] 服务器返回了空的URL');
            // 使用默认背景
            newSettings.backgroundImage = this.getDefaultBackgroundImage(orientation);
          }
        } else {
          // 如果数据库中没有背景设置，加载默认背景
          console.log('[主题服务] 用户没有设置背景图片，加载默认背景');
          newSettings.backgroundImage = this.getDefaultBackgroundImage(orientation);
        }
      } catch (bgError) {
        console.error('加载背景图片失败:', bgError);
        // 失败时使用默认背景
        const isPortrait = window.innerHeight > window.innerWidth;
        newSettings.backgroundImage = this.getDefaultBackgroundImage(isPortrait ? 'portrait' : 'landscape');
      }
      
      // 应用新设置
      this.settings = newSettings;
      
      // 返回新设置
      console.log('从数据库加载用户设置成功', newSettings);
      return newSettings;
      
    } catch (error) {
      console.error('加载用户设置时出错:', error);
      
      // 如果出错，使用默认设置
      const localSettings = { ...DEFAULT_SETTINGS };
      const savedSize = localStorage.getItem('font-size') as FontSize;
      const savedTheme = localStorage.getItem('theme') as Theme;
      
      if (savedSize) localSettings.fontSize = savedSize;
      if (savedTheme) localSettings.theme = savedTheme;
      
      // 加载默认背景图片
      const isPortrait = window.innerHeight > window.innerWidth;
      localSettings.backgroundImage = this.getDefaultBackgroundImage(isPortrait ? 'portrait' : 'landscape');
      
      this.settings = localSettings;
      return localSettings;
    }
  }
  
  /**
   * 保存设置到数据库
   */
  public async saveSettings(settings: Partial<UserThemeSettings>): Promise<UserThemeSettings> {
    if (!this.userId) {
      // 如果没有用户ID，则只保存到本地存储
      if (settings.theme) localStorage.setItem('theme', settings.theme);
      if (settings.fontSize) localStorage.setItem('font-size', settings.fontSize);
      
      // 更新当前设置
      this.settings = { ...this.settings, ...settings };
      return this.settings;
    }

    try {
      // 构建要保存的数据对象，注意转换为下划线命名
      const saveData: Record<string, any> = {};
      if (settings.theme !== undefined) saveData.theme = settings.theme;
      if (settings.fontSize !== undefined) saveData.font_size = settings.fontSize;
      if (settings.primaryColor !== undefined) saveData.primary_color = settings.primaryColor;
      if (settings.backgroundStyle !== undefined) saveData.background_style = settings.backgroundStyle;
      if (settings.uiRadius !== undefined) saveData.ui_radius = settings.uiRadius;
      
      // 背景文件特殊处理
      if (settings.backgroundFile !== undefined) {
        saveData.background_file = settings.backgroundFile;
      } else if (settings.backgroundImage?.fileId) {
        // 如果没有提供 backgroundFile 但有 backgroundImage.fileId
        saveData.background_file = settings.backgroundImage.fileId;
      }

      // 保存到数据库
      const response = await axios.post(`/api/user-settings/${this.userId}`, saveData);
      console.log('用户设置已保存到数据库', settings);
      
      // 更新当前设置
      this.settings = { ...this.settings, ...settings };
      
      // 重置载入承诺，下次调用时将重新从数据库加载
      this.loadPromise = null;
      return this.settings;
    } catch (error) {
      console.error('保存用户设置时出错:', error);
      throw error;
    }
  }
  
  /**
   * 获取默认背景图片
   */
  private getDefaultBackgroundImage(orientation: string | boolean): BackgroundImage {
    const isPortrait = orientation === 'portrait' || !!orientation;
    const defaultBgUrl = isPortrait 
      ? '/backgrounds/portrait-background.jpg' 
      : '/backgrounds/default-background.jpg';
    
    return {
      fileId: isPortrait ? 'default-portrait-bg' : 'default-landscape-bg',
      url: defaultBgUrl
    };
  }
  
  /**
   * 上传背景图片
   */
  public async uploadBackgroundImage(file: File): Promise<BackgroundImage> {
    if (!this.userId) throw new Error('需要用户ID才能上传背景图片');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', this.userId.toString());
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
      await this.saveSettings({ 
        backgroundFile: fileId,
        backgroundImage: newBackgroundImage 
      });
      
      return newBackgroundImage;
    } catch (error) {
      console.error('上传背景图片出错:', error);
      throw error;
    }
  }
  
  /**
   * 应用主题设置到DOM
   */
  public applySettingsToDOM(settings: UserThemeSettings): void {
    // 应用字体大小
    this.applyFontSize(settings.fontSize);
    
    // 应用主题
    this.applyTheme(settings.theme);
    
    // 应用界面样式
    this.applyUiStyles(settings);
  }
  
  /**
   * 给知识图谱页面应用深色主题
   */
  public applyDarkThemeToKnowledgeGraph(): void {
    const currentPath = window.location.pathname;
    const isKnowledgeGraphPage = 
      currentPath.includes('knowledge-graph') || 
      currentPath.includes('graph-view') ||
      currentPath.includes('topic-visualization');
      
    if (isKnowledgeGraphPage) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      console.log('知识图谱页面：强制使用深色主题');
    }
  }
  
  /**
   * 应用字体大小设置
   */
  private applyFontSize(size: FontSize): void {
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
  }

  /**
   * 应用主题设置到DOM
   */
  private applyTheme(theme: Theme): void {
    // 先调用公共方法
    this.applyThemeToDOM(theme);
    
    // 最后还要判断知识图谱页面并强制深色
    this.applyDarkThemeToKnowledgeGraph();
  }
  
  /**
   * 公共方法：应用主题到DOM
   */
  public applyThemeToDOM(theme: Theme): void {
    // 移除所有主题类
    document.documentElement.classList.remove('light', 'dark');

    // 应用新主题
    if (theme === "system") {
      // 根据系统偏好设置主题
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add('light');
      }
    } else {
      // 直接应用指定主题
      document.documentElement.classList.add(theme);
    }

    // 保存设置到本地存储
    localStorage.setItem('theme', theme);
  }

  /**
   * 应用界面样式设置
   */
  private applyUiStyles(settings: UserThemeSettings): void {
    const rootElement = document.documentElement;
    
    // 应用主色调
    if (settings.primaryColor) {
      rootElement.style.setProperty('--primary-color-hex', settings.primaryColor);
      
      if (settings.primaryColor.startsWith('#')) {
        try {
          const primaryHsl = hexToHSL(settings.primaryColor);
          rootElement.style.setProperty('--primary', primaryHsl);
          console.log(`[主题颜色] 设置主色调: ${settings.primaryColor} (HSL: ${primaryHsl})`);
        } catch (colorError) {
          console.error('转换颜色格式时出错:', colorError);
        }
      }
    }
    
    // 应用圆角
    if (settings.uiRadius !== undefined) {
      rootElement.style.setProperty('--ui-radius', `${settings.uiRadius}px`);
      rootElement.style.setProperty('--radius', `${settings.uiRadius / 16}rem`);
      console.log(`[界面样式] 设置圆角: ${settings.uiRadius}px`);
    }
    
    // 应用背景样式
    if (settings.backgroundStyle) {
      rootElement.dataset.backgroundStyle = settings.backgroundStyle;
      console.log(`[界面样式] 设置背景样式: ${settings.backgroundStyle}`);
    }
  }
}

// 单例实例
export const themeService = new ThemeService();
