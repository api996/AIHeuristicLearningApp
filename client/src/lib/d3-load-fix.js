/**
 * D3.js 库加载修复文件
 * 
 * 这个文件解决了在iPad和浏览器刷新后D3.js库不正确加载的问题
 * 主要处理两个问题：
 * 1. 在页面刷新后确保D3库重新正确加载
 * 2. 确保SVG元素在iPad上正确渲染和响应触摸事件
 */

// 指示当前D3加载状态
let d3Loaded = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// 创建全局D3补丁对象
window._d3Selection = window._d3Selection || {};
console.log("D3直接补丁已加载 - 全局_d3Selection对象已创建");

// 初始化加载
function initD3Load() {
  console.log("开始加载D3.js库...");
  
  // 检查D3是否已存在
  if (window.d3) {
    applyD3Patch();
    return;
  }
  
  // 尝试使用非SRI版本加载
  loadNonSRID3();
}

// 加载非SRI版本
function loadNonSRID3() {
  try {
    // 创建脚本元素
    const script = document.createElement('script');
    script.src = "https://d3js.org/d3.v7.min.js";
    script.async = true;
    
    script.onload = function() {
      console.log("D3.js非SRI版本加载成功");
      d3Loaded = true;
      applyD3Patch();
    };
    
    script.onerror = function() {
      console.warn("D3.js加载失败，某些可视化功能可能不可用");
      retryD3Load();
    };
    
    document.head.appendChild(script);
  } catch (err) {
    console.warn("D3.js加载失败，尝试使用非SRI版本");
    retryD3Load();
  }
}

// 重试加载
function retryD3Load() {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    console.warn("D3.js初始加载失败，将继续尝试后台加载");
    setTimeout(loadNonSRID3, 1000);
  }
}

// 应用D3补丁
function applyD3Patch() {
  if (!window.d3) {
    console.warn("D3补丁警告: d3对象未定义，无法应用补丁");
    return;
  }
  
  try {
    // 备份原始方法
    window._d3Selection.original = {
      select: window.d3.select,
      selectAll: window.d3.selectAll
    };
    
    // 增强select方法，确保触摸事件支持
    window.d3.select = function(selector) {
      const selection = window._d3Selection.original.select(selector);
      enhanceSelection(selection);
      return selection;
    };
    
    // 增强selectAll方法
    window.d3.selectAll = function(selector) {
      const selection = window._d3Selection.original.selectAll(selector);
      enhanceSelection(selection);
      return selection;
    };
    
    // 检测设备类型
    if (isIPad()) {
      console.log("检测到iPad设备，应用触摸事件修复");
      applyIPadSpecificFixes();
    }
    
    console.log("D3补丁已成功应用");
    setTimeout(() => {
      console.log("D3.js加载并初始化成功");
    }, 500);
  } catch (err) {
    console.error("应用D3补丁时出错:", err);
  }
}

// 增强选择集以支持触摸事件
function enhanceSelection(selection) {
  if (!selection || !selection.on) return;
  
  // 保存原始on方法
  const originalOn = selection.on;
  
  // 增强on方法以自动添加触摸事件支持
  selection.on = function(typenames, listener, capture) {
    if (typenames && typeof typenames === 'string') {
      // 对于mousedown、mousemove和mouseup自动添加触摸事件替代
      if (typenames === 'mousedown' && listener) {
        originalOn.call(this, 'touchstart', listener, capture);
      } else if (typenames === 'mousemove' && listener) {
        originalOn.call(this, 'touchmove', listener, capture);
      } else if (typenames === 'mouseup' && listener) {
        originalOn.call(this, 'touchend', listener, capture);
      }
    }
    
    // 调用原始方法
    return originalOn.apply(this, arguments);
  };
}

// 应用iPad专用修复
function applyIPadSpecificFixes() {
  // 确保SVG元素响应触摸事件
  const style = document.createElement('style');
  style.textContent = `
    svg { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    svg * { touch-action: manipulation; }
  `;
  document.head.appendChild(style);
  
  // 监听窗口大小变化，确保正确缩放
  window.addEventListener('resize', function() {
    if (window.d3) {
      const svgs = document.querySelectorAll('svg');
      svgs.forEach(svg => {
        // 触发重新渲染
        const event = new Event('resize-svg');
        svg.dispatchEvent(event);
      });
    }
  });
}

// 检测是否为iPad设备
function isIPad() {
  const userAgent = navigator.userAgent.toLowerCase();
  return /ipad/.test(userAgent) || 
         (/macintosh/.test(userAgent) && 'ontouchend' in document);
}

// 启动加载
initD3Load();

// 确保在DOM加载完成后检查D3状态
document.addEventListener('DOMContentLoaded', function() {
  if (!d3Loaded) {
    console.log("D3.js检测到通过其他方式加载，正在初始化补丁");
    
    if (window.d3) {
      applyD3Patch();
    } else {
      // 如果DOM加载完但D3仍未加载，再次尝试加载
      initD3Load();
    }
  }
});

// 在页面加载完成后再次检查，确保处理延迟加载的情况
window.addEventListener('load', function() {
  setTimeout(() => {
    if (window.d3) {
      console.log("D3.js库已成功加载和初始化");
      d3Loaded = true;
      applyD3Patch();
      
      // 触发增强SVG交互性的事件
      console.log("D3.js已加载，应用增强功能");
      enhanceSVGInteractions();
    }
  }, 1000);
});

// 增强SVG元素的触摸交互
function enhanceSVGInteractions() {
  try {
    const svgs = document.querySelectorAll('svg');
    if (svgs.length > 0) {
      console.log("已增强SVG元素的触摸交互");
      svgs.forEach(svg => {
        svg.style.touchAction = 'manipulation';
        svg.style.webkitTapHighlightColor = 'transparent';
      });
    }
  } catch (err) {
    console.warn("增强SVG交互时出错:", err);
  }
}

// 导出D3加载状态
export default {
  isLoaded: () => d3Loaded,
  applyPatch: applyD3Patch,
  forceReload: initD3Load
};