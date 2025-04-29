/**
 * 主题加载器组件
 * 确保主题变量在生产环境中正确加载
 */

import { useEffect } from 'react';

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
  // 一个简单的检查方法，检查主题CSS变量是否存在
  const checkThemeVariables = () => {
    try {
      const computedStyle = getComputedStyle(document.documentElement);
      const criticalVariables = [
        '--radius',
        '--primary',
        '--background',
        '--foreground',
        '--card',
        '--card-foreground'
      ];
      
      let report = "\n主题变量检测报告:";
      let missingVariables = [];
      
      // 检查每个关键变量是否存在
      criticalVariables.forEach(variable => {
        const value = computedStyle.getPropertyValue(variable).trim();
        report += `\n${variable}: ${value || '空'}`;
        
        if (!value) {
          missingVariables.push(variable);
        }
      });
      
      // 输出调试信息
      console.group('主题变量检测');
      console.log(report);
      console.groupEnd();
      
      const themeLoaded = missingVariables.length === 0;
      if (themeLoaded) {
        console.log('主题检测: 成功 - 主题已正确加载');
      } else {
        console.warn('主题检测: 失败 - 主题未正确加载');
      }
      
      return themeLoaded;
    } catch (error) {
      console.error('检测主题加载状态时出错:', error);
      return false;
    }
  };
  
  // 只应用与颜色无关的样式增强，如圆角和消息气泡
  const enhanceNonThemeStyles = () => {
    try {
      const root = document.documentElement;
      
      // 设置圆角
      const radius = '0.75rem';
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
      
      console.log('主题加载器：已应用非主题相关样式增强');
    } catch (error) {
      console.error('应用非主题样式增强时出错:', error);
    }
  };

  useEffect(() => {
    // 初始加载时只应用非主题相关的样式增强
    enhanceNonThemeStyles();
    
    // 只需在页面加载时执行一次主题检查
    setTimeout(() => {
      checkThemeVariables();
      
      // 检查特定页面，例如知识图谱页面强制使用深色主题
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
    }, 100);
    
    // 监听路由变化 - 简化版本，只关注特定页面的主题处理
    const handleRouteChange = () => {
      // 路由变化时检查是否为特殊页面
      setTimeout(() => {
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
      }, 100);
    };
    
    // 只监听 popstate 事件，简化事件监听
    window.addEventListener('popstate', handleRouteChange);
    
    // 清理函数
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);
  
  // 这是一个无UI组件，仅在后台工作
  return null;
};

export default ThemeLoader;