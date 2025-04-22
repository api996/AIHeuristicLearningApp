/**
 * 聊天组件滚动修复工具
 * 为各种设备优化的滚动到底部实现
 */

/**
 * 滚动容器到底部
 * @param container 需要滚动的DOM元素
 * @param smooth 是否使用平滑滚动
 */
export function scrollToBottom(container: HTMLElement, smooth: boolean = false): void {
  if (!container) return;
  
  // 应用平滑滚动或立即滚动
  container.scrollTo({
    top: container.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/**
 * 检查是否需要滚动到底部
 * @param container 滚动容器
 * @param threshold 滚动阈值（默认为20px）
 * @returns 是否需要滚动
 */
export function shouldScrollToBottom(container: HTMLElement, threshold: number = 20): boolean {
  if (!container) return false;
  
  // 如果用户已滚动到接近底部，自动滚动到底部
  const { scrollTop, scrollHeight, clientHeight } = container;
  const scrolledToBottom = scrollHeight - scrollTop - clientHeight <= threshold;
  
  return scrolledToBottom;
}

/**
 * 增强触摸交互
 * 为触摸设备优化滚动行为
 * @param element 需要优化的DOM元素
 */
export function enhanceTouchInteraction(element: HTMLElement): void {
  if (!element) return;
  
  // 添加触摸优化类
  element.classList.add('touch-optimized');
  
  // 检测是否为iPad或其他触摸设备
  const isIPad = /iPad/.test(navigator.userAgent) || 
                (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
                
  if (isIPad) {
    element.classList.add('ipad-optimized');
  }
  
  // 添加属性以改善触摸行为
  element.style.webkitOverflowScrolling = 'touch';
  element.style.overscrollBehavior = 'contain';
  element.style.touchAction = 'pan-y';
}

/**
 * 限制函数调用频率
 * @param func 要节流的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T, 
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall < delay) return;
    
    lastCall = now;
    func(...args);
  };
}

/**
 * 应用固定位置滚动
 * 主要针对iPad和iOS设备键盘打开状态
 * @param container 滚动容器
 */
export function applyFixedPositionScrolling(container: HTMLElement): void {
  if (!container) return;
  
  // 处理iOS设备的固定位置滚动问题
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (isIOS) {
    container.style.position = 'fixed';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflowY = 'auto';
  }
}

// 导出所有工具函数
export const scrollUtils = {
  scrollToBottom,
  shouldScrollToBottom,
  enhanceTouchInteraction,
  throttle,
  applyFixedPositionScrolling
};

export default scrollUtils;