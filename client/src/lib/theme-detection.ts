/**
 * 主题检测工具
 * 用于检测生产环境中主题是否正确加载，并提供回退机制
 */

/**
 * 验证主题变量是否已正确加载和应用
 * 通过检查关键CSS变量是否存在并有合理值来判断
 * 
 * @returns 布尔值，表示主题是否已正确加载
 */
export const isThemeProperlyLoaded = (): boolean => {
  try {
    const computedStyle = getComputedStyle(document.documentElement);
    
    // 检查关键变量是否存在
    const hasRadius = computedStyle.getPropertyValue('--radius').trim();
    const hasPrimary = computedStyle.getPropertyValue('--primary').trim();
    const hasBackground = computedStyle.getPropertyValue('--background').trim();
    
    // 如果关键变量不存在或为空，说明主题未正确加载
    if (!hasRadius || !hasPrimary || !hasBackground) {
      return false;
    }
    
    // 如果--radius的值为"0"或"0px"，也认为主题未正确加载
    if (hasRadius === '0' || hasRadius === '0px' || hasRadius === '0rem' || hasRadius === '0em') {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('检测主题加载状态时出错:', error);
    // 出错时保守处理，返回false
    return false;
  }
};

/**
 * 应用回退主题CSS变量
 * 当主题未正确加载时，手动设置最基本的主题变量
 */
export const applyFallbackTheme = (): void => {
  try {
    const root = document.documentElement;
    
    // 设置基本圆角
    root.style.setProperty('--radius', '0.75rem');
    
    // 设置基本颜色
    root.style.setProperty('--primary', '174 59% 49%');
    root.style.setProperty('--primary-foreground', '0 0% 100%');
    
    // 设置背景和文本颜色
    root.style.setProperty('--background', '0 0% 100%');
    root.style.setProperty('--foreground', '240 10% 3.9%');
    
    // 设置其他常用变量
    root.style.setProperty('--card', '0 0% 100%');
    root.style.setProperty('--card-foreground', '240 10% 3.9%');
    root.style.setProperty('--popover', '0 0% 100%');
    root.style.setProperty('--popover-foreground', '240 10% 3.9%');
    root.style.setProperty('--secondary', '240 4.8% 95.9%');
    root.style.setProperty('--secondary-foreground', '240 5.9% 10%');
    root.style.setProperty('--muted', '240 4.8% 95.9%');
    root.style.setProperty('--muted-foreground', '240 3.8% 46.1%');
    root.style.setProperty('--accent', '240 4.8% 95.9%');
    root.style.setProperty('--accent-foreground', '240 5.9% 10%');
    root.style.setProperty('--destructive', '0 84.2% 60.2%');
    root.style.setProperty('--destructive-foreground', '0 0% 98%');
    root.style.setProperty('--border', '240 5.9% 90%');
    root.style.setProperty('--input', '240 5.9% 90%');
    root.style.setProperty('--ring', '240 5.9% 10%');
    
    console.log('已应用回退主题样式');
  } catch (error) {
    console.error('应用回退主题时出错:', error);
  }
};

/**
 * 主题检测和修复
 * 检测主题是否正确加载，如果没有，应用回退主题
 * 
 * @returns 布尔值，表示是否已应用回退主题
 */
export const ensureThemeLoaded = (): boolean => {
  // 检查主题是否已正确加载
  const themeLoaded = isThemeProperlyLoaded();
  
  // 如果主题未正确加载，应用回退主题
  if (!themeLoaded) {
    applyFallbackTheme();
    return true; // 返回true表示已应用回退主题
  }
  
  return false; // 返回false表示无需应用回退主题
};