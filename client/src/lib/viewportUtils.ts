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
  const significantHeightChange = heightDifference > 150; // 键盘通常至少150px高
  const hasTopOffset = window.visualViewport.offsetTop > 0;
  
  const isKeyboardVisible = significantHeightChange || (isIOS && hasTopOffset);
    
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