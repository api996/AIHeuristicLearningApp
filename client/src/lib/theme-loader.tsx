/**
 * 主题加载器组件
 * 确保主题变量在生产环境中正确加载
 */

import { useEffect } from 'react';
import { ensureThemeLoaded } from './theme-detection';

// 导入回退CSS样式，确保在主题未加载时有基础样式
import '../theme-fallback.css';

// 从theme.json导入主题配置
import themeConfig from '../../../theme.json';

// 提供类型定义
interface ThemeConfig {
  variant: 'vibrant' | 'professional' | 'tint';
  primary: string;
  appearance: 'light' | 'dark' | 'system';
  radius: number;
}

export const ThemeLoader = () => {
  useEffect(() => {
    // 初始加载时应用主题增强
    enhanceThemeStyles();
    
    // 测试方法：故意添加延迟确保DOM完全加载后再检查主题
    const themeCheckDelay = setTimeout(() => {
      // 使用主题检测和修复功能
      const appliedFallback = ensureThemeLoaded();
      
      if (appliedFallback) {
        console.log('主题加载器：已应用回退主题样式');
        // 在应用回退样式后再次应用增强
        enhanceThemeStyles();
      } else {
        // 即使主题已正确加载，也应用一些特定的样式增强
        enhanceThemeStyles();
      }
    }, 100);
    
    // 设置间隔检查器，确保在页面导航后样式也能正确应用
    const themeCheckInterval = setInterval(() => {
      const appliedFallback = ensureThemeLoaded();
      if (appliedFallback) {
        enhanceThemeStyles();
      }
    }, 2000); // 每2秒检查一次
    
    // 监听路由变化
    const handleRouteChange = () => {
      // 路由变化时重新应用样式
      setTimeout(() => {
        const appliedFallback = ensureThemeLoaded();
        enhanceThemeStyles();
        console.log('路由变化，重新应用主题样式');
      }, 100);
    };
    
    // 创建一个监听器来监听所有锚标签和按钮点击，可能导致路由变化
    const handlePossibleRouteChange = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isNavigationElement = 
        target.tagName === 'A' || 
        target.tagName === 'BUTTON' || 
        target.closest('a') || 
        target.closest('button') ||
        target.hasAttribute('href') ||
        target.getAttribute('role') === 'link';
        
      if (isNavigationElement) {
        setTimeout(() => {
          const appliedFallback = ensureThemeLoaded();
          enhanceThemeStyles();
          console.log('可能的路由变化，重新应用主题样式');
        }, 200);
      }
    };
    
    // 使用多种方式监听路由变化
    window.addEventListener('popstate', handleRouteChange);
    document.addEventListener('click', handlePossibleRouteChange);
    
    // 清理函数
    return () => {
      clearTimeout(themeCheckDelay);
      clearInterval(themeCheckInterval);
      window.removeEventListener('popstate', handleRouteChange);
      document.removeEventListener('click', handlePossibleRouteChange);
    };
  }, []);
  
  /**
   * 增强主题样式
   * 无论主题是否正确加载，都应用一些额外的样式增强
   */
  const enhanceThemeStyles = () => {
    try {
      // 将TypeScript类型断言应用于导入的主题配置
      const theme = themeConfig as ThemeConfig;
      const root = document.documentElement;
      
      // 设置主色调
      if (theme.primary) {
        const primaryColor = theme.primary.startsWith('#') ? hexToHSL(theme.primary) : '174 59% 49%';
        root.style.setProperty('--primary', primaryColor);
        root.style.setProperty('--primary-foreground', '0 0% 100%');
        
        // 建立不同颜色主题的变体
        // 主色调的浅色版本
        const [h, s, l] = primaryColor.split(' ');
        const hue = parseInt(h);
        
        // 生成主色调的淡色版本
        const lightPrimary = `${hue} ${s} 85%`;
        root.style.setProperty('--primary-light', lightPrimary);
        
        // 生成主色调的深色版本
        const darkPrimary = `${hue} ${s} 30%`;
        root.style.setProperty('--primary-dark', darkPrimary);
        
        // 设置强调色
        const accentHue = (hue + 180) % 360; // 互补色
        root.style.setProperty('--accent', `${accentHue} 80% 60%`);
        root.style.setProperty('--accent-foreground', '0 0% 100%');
        
        // 设置参考颜色 - 用于界面中的中性元素
        const neutralHue = (hue + 90) % 360; // 互补色
        root.style.setProperty('--neutral', `${neutralHue} 10% 50%`);
        root.style.setProperty('--neutral-light', `${neutralHue} 10% 90%`);
        root.style.setProperty('--neutral-dark', `${neutralHue} 10% 20%`);
        
        // 添加到文档的data属性，便于调试
        document.documentElement.dataset.primaryColor = primaryColor;
      }
      
      // 设置圆角
      const radius = typeof theme.radius === 'number' ? `${theme.radius}rem` : '0.75rem';
      root.style.setProperty('--radius', radius);
      
      // 确保圆角变量正确传播到各种组件
      root.style.setProperty('--card-radius', `var(--radius)`);
      root.style.setProperty('--input-radius', `var(--radius)`);
      root.style.setProperty('--button-radius', `var(--radius)`);
      root.style.setProperty('--popover-radius', `var(--radius)`);
      
      // 设置消息气泡的特殊圆角
      root.style.setProperty('--message-border-radius', '1.125rem');
      
      // 设置所有按钮的统一圆角
      root.style.setProperty('--button-border-radius', '0.75rem');
      
      // 应用主题颜色
      if (theme.appearance) {
        if (theme.appearance === 'dark' || 
            (theme.appearance === 'system' && 
             window.matchMedia && 
             window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
      
      console.log('主题加载器：已应用主题样式增强');
    } catch (error) {
      console.error('主题加载器：应用样式增强时出错:', error);
    }
  };
  
  /**
   * 将十六进制颜色转换为HSL格式字符串
   * @param hex 十六进制颜色，例如 "#0deae4"
   * @returns HSL格式字符串，例如 "174 59% 49%"
   */
  const hexToHSL = (hex: string): string => {
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
  
  // 这是一个无UI组件，仅在后台工作
  return null;
};

export default ThemeLoader;