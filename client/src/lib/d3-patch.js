/**
 * D3.js 库补丁文件
 * 确保D3库在各种环境下正确加载，支持iPad和高分辨率屏幕
 */

// 创建全局补丁对象
window._d3Patch = window._d3Patch || {
  loaded: false,
  retryCount: 0,
  maxRetries: 3
};

// 导出加载检查函数
export const ensureD3Loaded = () => {
  return new Promise((resolve) => {
    if (window.d3) {
      resolve(true);
      return;
    }
    
    // 如果D3未加载，尝试加载
    loadD3Library().then(success => {
      resolve(success);
    });
  });
};

// 加载D3库
function loadD3Library() {
  return new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = "https://d3js.org/d3.v7.min.js";
      script.async = true;
      
      script.onload = function() {
        window._d3Patch.loaded = true;
        applyD3Patches();
        resolve(true);
      };
      
      script.onerror = function() {
        window._d3Patch.retryCount++;
        if (window._d3Patch.retryCount < window._d3Patch.maxRetries) {
          setTimeout(() => loadD3Library().then(resolve), 1000);
        } else {
          resolve(false);
        }
      };
      
      document.head.appendChild(script);
    } catch (err) {
      resolve(false);
    }
  });
}

// 应用D3补丁
function applyD3Patches() {
  if (!window.d3) return;
  
  // 修复触摸事件
  if (typeof window.d3.select === 'function') {
    const originalSelect = window.d3.select;
    window.d3.select = function() {
      const selection = originalSelect.apply(this, arguments);
      enhanceSelection(selection);
      return selection;
    };
  }
  
  if (typeof window.d3.selectAll === 'function') {
    const originalSelectAll = window.d3.selectAll;
    window.d3.selectAll = function() {
      const selection = originalSelectAll.apply(this, arguments);
      enhanceSelection(selection);
      return selection;
    };
  }
  
  // 检测是否为iPad，应用专用修复
  if (isIPadDevice()) {
    applyIPadSpecificFixes();
  }
}

// 增强选择集
function enhanceSelection(selection) {
  if (!selection || !selection.on) return selection;
  
  // 保存原始on方法
  const originalOn = selection.on;
  
  // 增强on方法，自动添加触摸事件支持
  selection.on = function(typenames, listener, capture) {
    if (typenames && typeof typenames === 'string' && listener) {
      // 为鼠标事件添加对应的触摸事件
      const touchMapping = {
        'mousedown': 'touchstart',
        'mousemove': 'touchmove',
        'mouseup': 'touchend',
        'click': 'touchend'
      };
      
      const touchEvent = touchMapping[typenames];
      if (touchEvent) {
        // 包装触摸事件监听器，使其模拟鼠标事件
        const touchListener = function(event) {
          if (event.touches && event.touches[0]) {
            // 创建模拟鼠标事件
            const touch = event.touches[0];
            const simulatedEvent = {
              ...event,
              clientX: touch.clientX,
              clientY: touch.clientY,
              pageX: touch.pageX,
              pageY: touch.pageY,
              screenX: touch.screenX,
              screenY: touch.screenY
            };
            
            // 调用原始监听器
            listener.call(this, simulatedEvent);
          }
        };
        
        // 添加触摸事件监听器
        originalOn.call(this, touchEvent, touchListener, capture);
      }
    }
    
    // 调用原始方法
    return originalOn.apply(this, arguments);
  };
  
  return selection;
}

// 检测iPad设备
function isIPadDevice() {
  const userAgent = navigator.userAgent.toLowerCase();
  return /ipad/.test(userAgent) || 
         (/macintosh/.test(userAgent) && 'ontouchend' in document);
}

// 应用iPad专用修复
function applyIPadSpecificFixes() {
  // 添加触摸优化样式
  const style = document.createElement('style');
  style.textContent = `
    svg {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }
    .d3-force-graph-container {
      touch-action: pan-x pan-y;
    }
    .d3-force-graph {
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(style);
  
  // 监听窗口大小变化，触发SVG更新
  window.addEventListener('resize', function() {
    if (window.d3) {
      document.querySelectorAll('svg').forEach(svg => {
        // 触发重新渲染
        const event = new Event('resize-svg');
        svg.dispatchEvent(event);
      });
    }
  });
  
  console.log("已应用iPad设备D3.js优化");
}

// DOM加载完成后检查D3状态
document.addEventListener('DOMContentLoaded', function() {
  if (window.d3 && !window._d3Patch.loaded) {
    window._d3Patch.loaded = true;
    applyD3Patches();
    console.log("检测到D3.js已加载，应用补丁");
  }
});

// 导出实用函数
export default {
  isLoaded: () => !!window.d3,
  applyPatches: applyD3Patches,
  ensureLoaded: ensureD3Loaded
};