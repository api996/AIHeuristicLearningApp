/**
 * 视口工具函数
 * 处理视口尺寸、设备类型检测和CSS变量设置
 */

// 检测是否为iPad设备
export function isIpadDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return /ipad/.test(userAgent) || 
         (/macintosh/.test(userAgent) && 'ontouchend' in document);
}

// 检测是否为移动设备
export function isMobileDevice(): boolean {
  return /iphone|ipod|android|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec/i.test(navigator.userAgent.toLowerCase());
}

// 设置视口高度CSS变量
export function setupViewportHeightListeners() {
  // 第一次运行时设置
  setViewportHeight();
  
  if (isIpadDevice()) {
    console.log("检测到iPad设备，应用iPad专用布局优化");
    document.documentElement.classList.add('ipad-device');
    
    // 监听iPad虚拟键盘事件
    window.addEventListener('resize', handleIPadKeyboard);
    
    // 监听键盘显示事件（iOS 15+）
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      console.log("检测到iPad设备，应用iPad布局优化");
    }
  }
  
  // 监听窗口调整大小的事件
  window.addEventListener('resize', handleResize);
  
  // 监听设备方向变化的事件
  window.addEventListener('orientationchange', handleResize);
  
  // 返回清理函数
  return () => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    
    if (isIpadDevice()) {
      window.removeEventListener('resize', handleIPadKeyboard);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    }
  };
}

// 设置视口高度
function setViewportHeight() {
  // 获取视口高度
  const vh = window.innerHeight * 0.01;
  // 设置CSS变量
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// 处理resize事件
function handleResize() {
  setViewportHeight();
}

// 处理iPad键盘事件
function handleIPadKeyboard() {
  const originalHeight = window.innerHeight;
  const currentHeight = window.innerHeight;
  
  // 检测是否键盘正在显示
  if (currentHeight < originalHeight * 0.8) {
    // 键盘显示中
    document.documentElement.classList.add('keyboard-visible');
    document.documentElement.classList.remove('keyboard-hidden');
  } else {
    // 键盘隐藏
    document.documentElement.classList.remove('keyboard-visible');
    document.documentElement.classList.add('keyboard-hidden');
    console.log("键盘关闭，恢复正常布局");
  }
}

// 处理visualViewport变化（更准确地检测键盘状态）
function handleVisualViewportChange() {
  if (!window.visualViewport) return;
  
  // 获取视觉视口高度和窗口高度的比例
  const viewportHeight = window.visualViewport.height;
  const windowHeight = window.innerHeight;
  const heightRatio = viewportHeight / windowHeight;
  
  // 如果比例小于0.8，说明键盘可能正在显示
  if (heightRatio < 0.8) {
    document.documentElement.classList.add('keyboard-visible');
    document.documentElement.classList.remove('keyboard-hidden');
    
    // 在iOS上，滚动页面以确保输入框可见
    const focusedElement = document.activeElement as HTMLElement;
    if (focusedElement && (focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'TEXTAREA')) {
      setTimeout(() => {
        focusedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  } else {
    document.documentElement.classList.remove('keyboard-visible');
    document.documentElement.classList.add('keyboard-hidden');
  }
}

// 导出其他实用工具
export const viewport = {
  isIPad: isIpadDevice,
  isMobile: isMobileDevice,
  setup: setupViewportHeightListeners
};