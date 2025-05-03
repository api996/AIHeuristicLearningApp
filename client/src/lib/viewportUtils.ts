/**
 * Viewport height utilities for responsive design
 * 
 * These functions handle viewport height issues by setting CSS variables
 * that can be used throughout the application for responsive layouts.
 */

/**
 * Updates CSS variable --vh to represent 1% of the actual viewport height
 * This can be used as calc(var(--vh, 1vh) * 100) in CSS
 */
export function updateViewportHeight(): void {
  if (!window.visualViewport) {
    // 没有visualViewport API时的回退方案
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    return;
  }
  
  // 使用更精确的visualViewport API
  const vh = window.visualViewport.height * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  
  // 设置更多有用的CSS变量供响应式布局使用
  document.documentElement.style.setProperty('--vw', `${window.visualViewport.width * 0.01}px`);
  document.documentElement.style.setProperty('--viewport-height', `${window.visualViewport.height}px`);
  document.documentElement.style.setProperty('--viewport-offset', `${window.visualViewport.offsetTop}px`);
  
  // 横竖屏状态检测 - 这个功能保留因为它是基于媒体查询的，不是设备检测
  if (window.matchMedia("(orientation: portrait)").matches) {
    document.documentElement.classList.add('portrait');
    document.documentElement.classList.remove('landscape');
  } else {
    document.documentElement.classList.add('landscape');
    document.documentElement.classList.remove('portrait');
  }
  
  // 简化的键盘检测，不基于特定设备
  const windowHeight = window.innerHeight;
  const viewportHeight = window.visualViewport.height;
  const heightDifference = windowHeight - viewportHeight;
  
  // 获取焦点状态
  const isInputFocused = Boolean(document.activeElement && 
                        (document.activeElement.tagName === 'INPUT' || 
                         document.activeElement.tagName === 'TEXTAREA' ||
                         (document.activeElement as HTMLElement).getAttribute('contenteditable') === 'true'));
  
  // 通用键盘检测逻辑，不区分设备类型
  const isKeyboardVisible = Boolean(isInputFocused && heightDifference > 100);
  
  // 设置键盘相关的CSS变量
  if (isKeyboardVisible && heightDifference > 0) {
    // 设置通用键盘高度变量
    document.documentElement.style.setProperty('--keyboard-height', `${heightDifference}px`);
    document.documentElement.style.setProperty('--content-bottom-padding', '80px');
  }
    
  // 将键盘状态信息添加到文档类中
  if (isKeyboardVisible) {
    document.documentElement.classList.add('keyboard-open');
    document.documentElement.dataset.keyboardHeight = `${heightDifference}px`;
  } else {
    document.documentElement.classList.remove('keyboard-open');
    document.documentElement.dataset.keyboardHeight = '0';
  }
}

/**
 * Setup all viewport height related event listeners
 */
export function setupViewportHeightListeners(): () => void {
  // Initial calculation on mount
  updateViewportHeight();
  
  // Listen to various viewport change events
  window.visualViewport?.addEventListener('resize', updateViewportHeight);
  window.visualViewport?.addEventListener('scroll', updateViewportHeight);
  window.addEventListener('resize', updateViewportHeight);
  window.addEventListener('orientationchange', updateViewportHeight);
  
  // Return cleanup function for useEffect
  return () => {
    window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
    window.removeEventListener('resize', updateViewportHeight);
    window.removeEventListener('orientationchange', updateViewportHeight);
  };
}

/**
 * Scroll an element to the bottom
 * @param element Element to scroll
 * @param smooth Whether to use smooth scrolling
 */
export function scrollToBottom(element: HTMLElement | null, smooth = true): void {
  if (!element) return;
  
  element.scrollTo({
    top: element.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/**
 * Helper to determine if we should scroll to bottom automatically
 * Only auto-scroll if user is already near the bottom
 * @param element Container element to check
 * @param threshold Threshold in pixels to consider "near bottom"
 */
export function isNearBottom(element: HTMLElement | null, threshold = 100): boolean {
  if (!element) return false;
  
  const { scrollTop, scrollHeight, clientHeight } = element;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

/**
 * 优化触摸交互的辅助函数 (通用版本)
 * @param element 需要优化触摸交互的元素
 */
export function enhanceTouchInteraction(element: HTMLElement | null): void {
  if (!element) return;
  
  // 应用通用触摸优化样式
  const touchStyles: Record<string, string> = {
    touchAction: 'manipulation',
    WebkitOverflowScrolling: 'touch',
  };
  
  // 应用样式
  Object.entries(touchStyles).forEach(([key, value]) => {
    (element.style as any)[key] = value;
  });
  
  // 为元素添加通用优化类
  element.classList.add('touch-optimized');
}