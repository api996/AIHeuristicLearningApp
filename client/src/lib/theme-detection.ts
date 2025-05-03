/**
 * 主题检测工具
 * 检测主题样式变量是否已正确加载
 */

/**
 * 检测主题是否加载完成
 * 基于主题CSS变量是否存在进行检查
 */
export function ensureThemeLoaded(): boolean {
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
    
    // 打印调试信息
    console.group('主题变量检测');
    console.log(report);
    
    if (missingVariables.length > 0) {
      console.warn(`缺失的主题变量: ${missingVariables.join(', ')}`);
    }
    
    if (invalidVariables.length > 0) {
      console.warn(`无效的主题变量: ${invalidVariables.join(', ')}`);
    }
    
    console.groupEnd();
    
    // 判断主题是否已正确加载
    const themeLoaded = missingVariables.length === 0 && invalidVariables.length === 0;
    
    if (themeLoaded) {
      console.log('主题检测: 成功 - 主题已正确加载');
    } else {
      console.warn('主题检测: 失败 - 主题未正确加载');
    }
    
    return themeLoaded;
    
  } catch (error) {
    console.error('检测主题加载状态时出错:', error);
    // 出错时保守处理，返回false
    return false;
  }
}
