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
  // Use visualViewport API when available, otherwise fallback to innerHeight
  const vh = (window.visualViewport?.height || window.innerHeight) * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  
  // 在键盘弹出时保持内容可见
  const isKeyboardVisible = window.visualViewport && 
    window.innerHeight > 0 && 
    window.visualViewport.height < window.innerHeight * 0.85;
    
  // 标记键盘状态，以便CSS可以相应调整
  if (isKeyboardVisible) {
    document.documentElement.classList.add('keyboard-open');
  } else {
    document.documentElement.classList.remove('keyboard-open');
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