/**
 * 视口工具函数
 * 用于检测设备类型，设置视口高度，并处理iOS特有的UI挑战
 * 
 * 这是从TypeScript版本的文件简化而来的JavaScript版本，
 * 保留了关键功能但略去了类型定义
 */

/**
 * 检测当前设备是否为iPad
 * 检测Safari和iOS设备的方法
 */
export function isIpadDevice() {
  // iPad检测规则:
  // 1. 用户代理包含iPad，或
  // 2. 用户代理包含Macintosh且设备支持触控
  const userAgent = navigator.userAgent;
  const isIpadOS = /iPad/.test(userAgent);
  const isMacWithTouch = /Macintosh/.test(userAgent) && 
                         navigator.maxTouchPoints && 
                         navigator.maxTouchPoints > 1;
                         
  return isIpadOS || isMacWithTouch;
}

/**
 * 检测iOS设备
 */
export function isIOSDevice() {
  const userAgent = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) || 
         (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * 检测移动设备
 */
export function isMobileDevice() {
  const userAgent = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

/**
 * 检测Safari浏览器
 */
export function isSafariBrowser() {
  const userAgent = navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(userAgent);
}

/**
 * 设置CSS变量以正确处理视口高度
 * 解决iOS上的100vh问题 
 */
function setViewportHeight() {
  // 获取实际视口高度
  const vh = window.innerHeight * 0.01;
  
  // 设置CSS变量
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  
  // 设置其他有用的视口变量
  document.documentElement.style.setProperty('--window-width', `${window.innerWidth}px`);
  document.documentElement.style.setProperty('--window-height', `${window.innerHeight}px`);
}

/**
 * 在键盘显示/隐藏时调整布局
 */
function handleKeyboardVisibility() {
  if (!isIOSDevice()) return;
  
  // iOS上键盘显示会触发resize事件
  const viewportHeight = window.innerHeight;
  const windowHeight = window.outerHeight;
  
  // 检测键盘是否可能打开 - 视口高度明显小于窗口高度
  if (viewportHeight < windowHeight * 0.8) {
    document.documentElement.classList.add('keyboard-open');
  } else {
    document.documentElement.classList.remove('keyboard-open');
  }
}

/**
 * 监听触摸事件，优化滚动体验
 */
function setupTouchListeners() {
  if (!isIOSDevice() && !isMobileDevice()) return;
  
  // 添加被动触摸事件监听器，提高滚动性能
  document.addEventListener('touchstart', function() {}, { passive: true });
  document.addEventListener('touchmove', function(e) {
    // 允许默认滚动行为，除非元素有特殊标记
    if (e.target.closest('.prevent-scroll')) {
      e.preventDefault();
    }
  }, { passive: false });
}

/**
 * 设置视口高度监听器，响应视口大小变化
 */
export function setupViewportHeightListeners() {
  if (typeof window === 'undefined') return;
  
  // 初始设置
  setViewportHeight();
  
  // 检测设备类型并应用相应的CSS类
  if (isIOSDevice()) {
    document.documentElement.classList.add('ios-device');
  }
  
  if (isMobileDevice()) {
    document.documentElement.classList.add('mobile-device');
  }
  
  if (isSafariBrowser()) {
    document.documentElement.classList.add('safari-browser');
  }
  
  if (isIpadDevice()) {
    document.documentElement.classList.add('ipad-device');
    console.log("检测到iPad设备，应用iPad专用布局优化");
  }
  
  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    setViewportHeight();
    handleKeyboardVisibility();
  });
  
  // 监听设备方向变化
  window.addEventListener('orientationchange', () => {
    // 添加短延迟，等待方向变化完成
    setTimeout(() => {
      setViewportHeight();
      
      // 更新方向类
      if (window.matchMedia("(orientation: portrait)").matches) {
        document.documentElement.classList.remove('landscape');
        document.documentElement.classList.add('portrait');
      } else {
        document.documentElement.classList.remove('portrait');
        document.documentElement.classList.add('landscape');
      }
    }, 100);
  });
  
  // 设置触摸监听器
  setupTouchListeners();
  
  // 触发一次方向检测
  if (window.matchMedia("(orientation: portrait)").matches) {
    document.documentElement.classList.add('portrait');
  } else {
    document.documentElement.classList.add('landscape');
  }
  
  // 返回清理函数
  return () => {
    // 移除事件监听器
    window.removeEventListener('resize', setViewportHeight);
    window.removeEventListener('orientationchange', () => {});
  };
}

/**
 * 增强触摸交互，优化移动设备体验
 * 这个函数在D3加载完成后调用，用于优化触摸设备的交互体验
 */
export function enhanceTouchInteraction() {
  try {
    // 增强SVG元素的触摸交互
    document.querySelectorAll('svg').forEach(svg => {
      svg.style.touchAction = 'manipulation';
      
      // 为交互元素增加触摸友好性
      svg.querySelectorAll('circle, rect, path, line').forEach(el => {
        el.style.touchAction = 'manipulation';
        
        // 增大触摸目标区域
        if (el.tagName === 'circle' && el.getAttribute('r')) {
          const currentR = parseFloat(el.getAttribute('r'));
          if (currentR < 10) {
            // 设置更大的点击区域
            el.setAttribute('data-original-r', currentR.toString());
            el.setAttribute('data-touch-r', (currentR * 2).toString());
            
            // 监听触摸开始，暂时增大半径
            el.addEventListener('touchstart', () => {
              el.setAttribute('r', el.getAttribute('data-touch-r'));
            });
            
            // 监听触摸结束，恢复原始半径
            el.addEventListener('touchend', () => {
              el.setAttribute('r', el.getAttribute('data-original-r'));
            });
          }
        }
      });
    });
    
    console.log("已增强SVG元素的触摸交互");
    return true;
  } catch (error) {
    console.error("增强触摸交互时出错:", error);
    return false;
  }
}

/**
 * 将元素滚动到底部
 * @param {HTMLElement} element 需要滚动的元素
 * @param {boolean} smooth 是否使用平滑滚动
 */
export function scrollToBottom(element, smooth = true) {
  if (!element) return;
  
  element.scrollTo({
    top: element.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/**
 * 判断元素是否接近底部
 * 仅当用户已经在接近底部时才自动滚动
 * @param {HTMLElement} element 容器元素
 * @param {number} threshold 判断"接近底部"的阈值（像素）
 * @returns {boolean} 是否接近底部
 */
export function isNearBottom(element, threshold = 100) {
  if (!element) return false;
  
  const { scrollTop, scrollHeight, clientHeight } = element;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

/**
 * 优化HTML元素的触摸交互
 * @param {HTMLElement} element 需要优化的元素
 */
export function optimizeTouchElement(element) {
  if (!element) return;
  
  // 设置触摸相关的样式
  element.style.touchAction = 'manipulation';
  element.style.WebkitOverflowScrolling = 'touch';
  element.style.WebkitUserSelect = 'none';
  element.style.userSelect = 'none';
  element.style.WebkitTouchCallout = 'none';
  
  // 添加触摸优化类
  element.classList.add('touch-optimized');
  
  // 根据设备类型添加特定的类
  if (isIpadDevice()) {
    element.classList.add('ipad-touch-target');
  } else if (isMobileDevice()) {
    element.classList.add('mobile-touch-target');
  }
}

// 导出所有实用函数
export default {
  isIpadDevice,
  isIOSDevice,
  isMobileDevice,
  isSafariBrowser,
  setupViewportHeightListeners,
  enhanceTouchInteraction,
  scrollToBottom,
  isNearBottom,
  optimizeTouchElement
};