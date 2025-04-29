/**
 * 主题检测工具
 * 用于检测生产环境中主题是否正确加载，并提供回退机制
 */

// 识别在各种环境中的主题打印调试日志
const DEBUG_THEME = true;

/**
 * 增强版的主题检测
 * 拥有更严格的检测机制和调试日志
 * 
 * @returns 布尔值，表示主题是否已正确加载
 */
export const isThemeProperlyLoaded = (): boolean => {
  try {
    const computedStyle = getComputedStyle(document.documentElement);
    
    // 定义需要检测的关键变量
    const criticalVariables = [
      '--radius',
      '--primary',
      '--background',
      '--foreground',
      '--card',
      '--card-foreground'
    ];
    
    // 生成检测报告
    let report = "\n主题变量检测报告:";
    let missingVariables: string[] = [];
    let invalidVariables: string[] = [];
    
    // 检查每个关键变量
    criticalVariables.forEach(variable => {
      const value = computedStyle.getPropertyValue(variable).trim();
      report += `\n${variable}: ${value || '空'}`;  
      
      // 检查变量是否存在
      if (!value) {
        missingVariables.push(variable);
        return;
      }
      
      // 特殊检查：圆角不能为0
      if (variable === '--radius' && 
          (value === '0' || value === '0px' || value === '0rem' || value === '0em')) {
        invalidVariables.push(`${variable} = ${value}`);
      }
    });
    
    // 打印调试信息（如果开启）
    if (DEBUG_THEME) {
      console.group('主题变量检测');
      console.log(report);
      
      if (missingVariables.length > 0) {
        console.warn(`缺失的主题变量: ${missingVariables.join(', ')}`);
      }
      
      if (invalidVariables.length > 0) {
        console.warn(`无效的主题变量: ${invalidVariables.join(', ')}`);
      }
      
      console.groupEnd();
    }
    
    // 判断主题是否已正确加载
    const themeLoaded = missingVariables.length === 0 && invalidVariables.length === 0;
    
    if (DEBUG_THEME) {
      if (themeLoaded) {
        console.log('主题检测: 成功 - 主题已正确加载');
      } else {
        console.warn('主题检测: 失败 - 主题未正确加载');
      }
    }
    
    return themeLoaded;
    
  } catch (error) {
    console.error('检测主题加载状态时出错:', error);
    // 出错时保守处理，返回false
    return false;
  }
};

/**
 * 应用增强版回退主题
 * 当主题未正确加载时，应用更全面的CSS变量
 */
export const applyFallbackTheme = (): void => {
  try {
    const root = document.documentElement;
    
    // 添加标记类，表明正在使用回退主题
    root.classList.add('using-fallback-theme');
    
    // 主题变量设置
    // 基础变量
    root.style.setProperty('--radius', '0.75rem');
    root.style.setProperty('--primary', '174 59% 49%');
    root.style.setProperty('--primary-foreground', '0 0% 100%');
    root.style.setProperty('--background', '0 0% 100%');
    root.style.setProperty('--foreground', '240 10% 3.9%');
    
    // 卡片和弹出窗口
    root.style.setProperty('--card', '0 0% 100%');
    root.style.setProperty('--card-foreground', '240 10% 3.9%');
    root.style.setProperty('--popover', '0 0% 100%');
    root.style.setProperty('--popover-foreground', '240 10% 3.9%');
    
    // 辅助颜色
    root.style.setProperty('--secondary', '240 4.8% 95.9%');
    root.style.setProperty('--secondary-foreground', '240 5.9% 10%');
    root.style.setProperty('--muted', '240 4.8% 95.9%');
    root.style.setProperty('--muted-foreground', '240 3.8% 46.1%');
    root.style.setProperty('--accent', '240 4.8% 95.9%');
    root.style.setProperty('--accent-foreground', '240 5.9% 10%');
    
    // 警示颜色
    root.style.setProperty('--destructive', '0 84.2% 60.2%');
    root.style.setProperty('--destructive-foreground', '0 0% 98%');
    
    // 边框和输入框
    root.style.setProperty('--border', '240 5.9% 90%');
    root.style.setProperty('--input', '240 5.9% 90%');
    root.style.setProperty('--ring', '240 5.9% 10%');
    
    // 圆角传播
    root.style.setProperty('--card-radius', 'var(--radius)');
    root.style.setProperty('--input-radius', 'var(--radius)');
    root.style.setProperty('--button-radius', 'var(--radius)');
    root.style.setProperty('--popover-radius', 'var(--radius)');
    
    // 消息气泡的特殊圆角
    root.style.setProperty('--message-border-radius', '1.125rem');
    
    // 按钮的统一圆角
    root.style.setProperty('--button-border-radius', '0.75rem');
    
    if (DEBUG_THEME) {
      console.log('已应用增强版回退主题样式');
    }
  } catch (error) {
    console.error('应用回退主题时出错:', error);
  }
};

/**
 * 增强版主题检测和修复
 * 检测主题是否正确加载，如果没有，应用回退主题
 * 
 * @returns 布尔值，表示是否已应用回退主题
 */
export const ensureThemeLoaded = (): boolean => {
  // 如果存在主题回退标记，删除它重新检测
  const root = document.documentElement;
  if (root.classList.contains('using-fallback-theme')) {
    root.classList.remove('using-fallback-theme');
  }
  
  // 检查主题是否已正确加载
  const themeLoaded = isThemeProperlyLoaded();
  
  // 如果主题未正确加载，应用回退主题
  if (!themeLoaded) {
    applyFallbackTheme();
    
    // 强制全局应用特定的CSS选择器样式
    document.body.classList.add('theme-fallback-applied');
    
    // 确保全局样式应用
    const styleTag = document.createElement('style');
    styleTag.id = 'theme-fallback-styles';
    styleTag.textContent = `
      /* 全局样式强制修复 */
      body.theme-fallback-applied button,
      body.theme-fallback-applied .btn,
      body.theme-fallback-applied [role="button"],
      body.theme-fallback-applied [type="button"],
      body.theme-fallback-applied [type="submit"] {
        border-radius: 0.75rem !important;
      }

      body.theme-fallback-applied input,
      body.theme-fallback-applied textarea,
      body.theme-fallback-applied select,
      body.theme-fallback-applied .input,
      body.theme-fallback-applied [role="textbox"] {
        border-radius: 0.75rem !important;
      }

      body.theme-fallback-applied .message-bubble,
      body.theme-fallback-applied .message-content,
      body.theme-fallback-applied .chat-message {
        border-radius: 1.125rem !important;
        overflow: hidden;
      }
    `;
    
    // 删除现有的回退样式（如果有）
    const existingStyle = document.getElementById('theme-fallback-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // 添加新样式到页面
    document.head.appendChild(styleTag);
    
    if (DEBUG_THEME) {
      console.log('已应用全局强制回退样式');
    }
    
    return true; // 返回true表示已应用回退主题
  } else {
    // 如果主题正常加载，移除回退样式
    document.body.classList.remove('theme-fallback-applied');
    const existingStyle = document.getElementById('theme-fallback-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
  }
  
  return false; // 返回false表示无需应用回退主题
};