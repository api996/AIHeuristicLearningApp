/**
 * Viewport height utilities to solve iOS/mobile browser height issues
 * 
 * These functions handle the real viewport height issues especially for:
 * - iOS Safari (when address bar hides/shows)
 * - Virtual keyboards
 * - Orientation changes
 * - Bottom browser toolbars
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
  
  // 设置更多有用的CSS变量
  document.documentElement.style.setProperty('--vw', `${window.visualViewport.width * 0.01}px`);
  document.documentElement.style.setProperty('--viewport-height', `${window.visualViewport.height}px`);
  document.documentElement.style.setProperty('--viewport-offset', `${window.visualViewport.offsetTop}px`);
  
  // 更精确地检测键盘状态 - 多种条件组合检测
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const windowHeight = window.innerHeight;
  const viewportHeight = window.visualViewport.height;
  
  // 键盘弹出的检测逻辑：
  // 1. 视窗高度明显小于窗口高度（键盘占用了空间）
  // 2. 视窗相对于顶部有偏移（在iOS上，键盘弹出时视窗会上移）
  const heightDifference = windowHeight - viewportHeight;
  // 不同设备的键盘高度不同，降低阈值以确保更准确地检测
  const significantHeightChange = heightDifference > 100; 
  const hasTopOffset = window.visualViewport.offsetTop > 0;
  
  const isKeyboardVisible = significantHeightChange || (isIOS && hasTopOffset);
  
  // 动态计算键盘高度以供CSS使用
  // 这可以让输入框保持在键盘上方的固定位置，填充黑色区域
  if (isKeyboardVisible && heightDifference > 0) {
    // 对iOS设备特殊处理，使用实际测量的高度差值加上补偿值
    if (isIOS) {
      // 为iOS设备使用更精确的计算，避免黑色区域
      const keyboardEstimatedHeight = heightDifference + (hasTopOffset ? 40 : 10);
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardEstimatedHeight}px`);
      // 设置额外的高度变量用于调整内容区域
      document.documentElement.style.setProperty('--content-adjust', `${Math.min(80, heightDifference/2)}px`);
    } else {
      // 非iOS设备使用标准计算
      const keyboardEstimatedHeight = heightDifference + 20;
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardEstimatedHeight}px`);
      document.documentElement.style.setProperty('--content-adjust', '0px');
    }
  } else {
    // 键盘关闭时重置变量
    document.documentElement.style.setProperty('--keyboard-height', '0px');
    document.documentElement.style.setProperty('--content-adjust', '0px');
  }
    
  // 将键盘状态信息添加到文档类中，以便CSS可以相应调整
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
  
  // 检测是否为iOS设备，iOS的键盘状态下使用不同的滚动策略
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isKeyboardOpen = document.documentElement.classList.contains('keyboard-open');
  
  // 如果是iOS设备并且键盘已打开，使用定时器确保在布局更新后滚动
  if (isIOS && isKeyboardOpen) {
    // 立即滚动一次，然后在短暂延迟后再次滚动以确保内容完全显示
    element.scrollTop = element.scrollHeight;
    
    // 使用RAF和setTimeout组合来确保在DOM完全更新后滚动
    requestAnimationFrame(() => {
      setTimeout(() => {
        element.scrollTop = element.scrollHeight;
      }, 50);
    });
  } else {
    // 普通设备使用标准滚动
    element.scrollTo({
      top: element.scrollHeight,
      behavior: smooth && !isKeyboardOpen ? 'smooth' : 'auto'
    });
  }
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