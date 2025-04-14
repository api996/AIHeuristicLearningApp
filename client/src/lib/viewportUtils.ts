/**
 * Viewport height utilities to solve iOS/iPad/mobile browser height issues
 * 
 * These functions handle the real viewport height issues especially for:
 * - iOS Safari (when address bar hides/shows)
 * - iPad Safari and iPadOS keyboard behaviors
 * - Virtual keyboards on all mobile devices
 * - Orientation changes
 * - Bottom browser toolbars
 * - Black space issues when keyboard appears
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
  
  // 更精确地检测键盘状态 - 多种条件组合检测，特别针对iPad
  const isIOS = /iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isIPad = /iPad/.test(navigator.userAgent) || 
                 (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
  const isTablet = isIPad || (window.innerWidth >= 768 && window.innerWidth <= 1366 && 'ontouchend' in document);
  const windowHeight = window.innerHeight;
  const viewportHeight = window.visualViewport.height;
  
  // 始终为设备添加对应的类，无论键盘是否弹出
  if (isIPad) {
    document.documentElement.classList.add('ipad-device');
    console.log("检测到iPad设备，应用iPad专用布局优化");
  } else if (isTablet) {
    document.documentElement.classList.add('tablet-device');
    console.log("检测到平板设备，应用平板专用布局优化");
  } else if (isIOS) {
    document.documentElement.classList.add('iphone-device');
    console.log("检测到iPhone设备，应用移动布局优化");
  } else if ('ontouchend' in document) {
    document.documentElement.classList.add('mobile-device');
    console.log("检测到移动设备，应用移动布局优化");
  } else {
    document.documentElement.classList.add('desktop-device');
    console.log("检测到桌面设备，应用桌面布局优化");
  }
  
  // 横竖屏状态检测
  if (window.matchMedia("(orientation: portrait)").matches) {
    document.documentElement.classList.add('portrait');
    document.documentElement.classList.remove('landscape');
  } else {
    document.documentElement.classList.add('landscape');
    document.documentElement.classList.remove('portrait');
  }
  
  // 键盘弹出的检测逻辑 - 增强版：
  // 1. 视窗高度明显小于窗口高度（键盘占用了空间）
  // 2. 视窗相对于顶部有偏移（在iOS上，键盘弹出时视窗会上移）
  // 3. iPad上特殊处理，因为iPad键盘行为与iPhone和Android不同
  //    iPad特别考虑了软键盘的高度和系统的偏移量
  const heightDifference = windowHeight - viewportHeight;
  
  // 获取更精确的焦点状态
  const isInputFocused = document.activeElement && 
                        (document.activeElement.tagName === 'INPUT' || 
                         document.activeElement.tagName === 'TEXTAREA' ||
                         (document.activeElement as HTMLElement).getAttribute('contenteditable') === 'true');
  
  // 计算相对原始窗口高度的百分比变化
  // 这对于判断键盘状态非常有效
  const heightChangePercent = (heightDifference / windowHeight) * 100;
  
  // 针对iPad和iPhone的专门优化
  let isKeyboardVisible = false;
  
  if (isIPad) {
    console.log("检测到iPad设备，应用iPad布局优化");
    // iPad触发键盘检测的阈值更低，但需要确认有输入框焦点
    // iPad mini/Air/Pro横屏和竖屏键盘高度差异很大
    const isPadPortrait = window.matchMedia("(orientation: portrait)").matches;
    const padThreshold = isPadPortrait ? 15 : 10; // 竖屏和横屏阈值不同
    
    // 结合多个信号提高检测准确性
    isKeyboardVisible = isInputFocused && (
      // 1. 检测明显的高度变化
      heightChangePercent > padThreshold ||
      // 2. 检测视口偏移 - iPad特有
      window.visualViewport.offsetTop > 5 ||
      // 3. 结合设备方向的额外判断
      (isPadPortrait && heightDifference > 200) || 
      (!isPadPortrait && heightDifference > 100)
    );
  } else if (isIOS) {
    // iPhone检测逻辑
    isKeyboardVisible = isInputFocused && (
      heightChangePercent > 20 || // iPhone高度变化通常更大
      window.visualViewport.offsetTop > 10  // iPhone视窗通常会明显上移
    );
  } else {
    // Android等其他设备
    isKeyboardVisible = isInputFocused && heightChangePercent > 20;
  }
  
  // 动态计算键盘高度以供CSS使用
  // 这可以让输入框保持在键盘上方的固定位置，填充黑色区域
  if (isKeyboardVisible && heightDifference > 0) {
    // 针对不同设备计算不同的键盘高度和补偿值
    let keyboardEstimatedHeight;
    
    if (isIPad) {
      // iPad需要更精确的高度计算和额外的补偿，以解决黑色空间问题
      keyboardEstimatedHeight = heightDifference + 40; // 更大的补偿值
      
      // 设置iPad专用的额外CSS变量
      document.documentElement.style.setProperty('--ipad-keyboard-offset', `${window.visualViewport.offsetTop}px`);
    } else if (isIOS) {
      // iPhone等iOS设备的计算
      keyboardEstimatedHeight = Math.max(270, heightDifference + 20);
    } else {
      // Android和其他设备
      keyboardEstimatedHeight = heightDifference + 10;
    }
    
    // 设置键盘高度CSS变量
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardEstimatedHeight}px`);
    
    // 设置额外的辅助变量
    document.documentElement.style.setProperty('--content-bottom-padding', 
      isIPad ? `${keyboardEstimatedHeight + 16}px` : '80px');
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