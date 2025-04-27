/**
 * 主题加载器组件
 * 确保主题变量在生产环境中正确加载
 */

import { useEffect } from 'react';
import { ensureThemeLoaded } from './theme-detection';

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
    // 测试方法：故意添加延迟确保DOM完全加载后再检查主题
    const themeCheckDelay = setTimeout(() => {
      // 使用主题检测和修复功能
      const appliedFallback = ensureThemeLoaded();
      
      if (appliedFallback) {
        console.log('主题加载器：已应用回退主题样式');
      } else {
        // 即使主题已正确加载，也应用一些特定的样式增强
        enhanceThemeStyles();
      }
    }, 100);
    
    return () => {
      clearTimeout(themeCheckDelay);
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
      
      // 确保圆角变量正确传播到各种组件
      root.style.setProperty('--card-radius', `var(--radius)`);
      root.style.setProperty('--input-radius', `var(--radius)`);
      root.style.setProperty('--button-radius', `var(--radius)`);
      root.style.setProperty('--popover-radius', `var(--radius)`);
      
      // 设置消息气泡的特殊圆角
      root.style.setProperty('--message-border-radius', '1.125rem');
      
      // 设置所有按钮的统一圆角
      root.style.setProperty('--button-border-radius', '0.75rem');
      
      console.log('主题加载器：已应用主题样式增强');
    } catch (error) {
      console.error('主题加载器：应用样式增强时出错:', error);
    }
  };
  
  // 这是一个无UI组件，仅在后台工作
  return null;
};

export default ThemeLoader;