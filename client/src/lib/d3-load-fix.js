/**
 * D3.js加载修复脚本
 * 确保D3.js正确加载，并提供加载失败时的备用解决方案
 */

/**
 * 检查D3.js是否已成功加载
 * @return {boolean} 是否加载成功
 */
function isD3Loaded() {
  return typeof window.d3 !== 'undefined' && window.d3 !== null;
}

/**
 * 尝试动态加载D3.js
 * @return {Promise<boolean>} 加载是否成功
 */
async function loadD3Dynamically() {
  return new Promise((resolve) => {
    if (isD3Loaded()) {
      console.log("D3.js已加载");
      resolve(true);
      return;
    }
    
    try {
      console.log("尝试动态加载D3.js库");
      
      // 创建脚本标签
      const script = document.createElement('script');
      script.src = 'https://d3js.org/d3.v7.min.js';
      script.async = true;
      
      // 设置成功回调
      script.onload = () => {
        console.log("D3.js库加载成功");
        if (isD3Loaded()) {
          resolve(true);
        } else {
          console.warn("D3.js库似乎已加载，但全局变量不可用");
          resolve(false);
        }
      };
      
      // 设置失败回调
      script.onerror = () => {
        console.error("无法加载D3.js库");
        resolve(false);
      };
      
      // 添加到文档中
      document.head.appendChild(script);
    } catch (error) {
      console.error("加载D3.js时发生错误:", error);
      resolve(false);
    }
  });
}

/**
 * 应用最小化的D3.js替代方案，确保基本API可用
 */
function applyMinimalD3Polyfill() {
  // 引入外部替代方案
  if (typeof window.d3 === 'undefined' || window.d3 === null) {
    console.log("应用最小化D3.js替代方案");
    
    window.d3 = window.d3 || {};
    
    // 基本选择器方法
    if (!window.d3.select) {
      window.d3.select = function(selector) {
        const element = document.querySelector(selector);
        return element ? wrapElement(element) : null;
      };
    }
    
    if (!window.d3.selectAll) {
      window.d3.selectAll = function(selector) {
        const elements = document.querySelectorAll(selector);
        return wrapElements(elements);
      };
    }
    
    // 缩放行为
    if (!window.d3.zoom) {
      window.d3.zoom = function() {
        return {
          on: () => ({}),
          scaleExtent: () => ({ on: () => ({}) })
        };
      };
    }
    
    // 拖拽行为
    if (!window.d3.drag) {
      window.d3.drag = function() {
        return {
          on: () => ({})
        };
      };
    }
    
    // 创建元素包装器
    function wrapElement(element) {
      if (!element) return null;
      
      return {
        node: () => element,
        append: (tag) => {
          const newElement = document.createElement(tag);
          element.appendChild(newElement);
          return wrapElement(newElement);
        },
        attr: (name, value) => {
          if (typeof value === 'function') {
            element.setAttribute(name, value());
          } else {
            element.setAttribute(name, value);
          }
          return wrapElement(element);
        },
        style: (name, value) => {
          if (typeof value === 'function') {
            element.style[name] = value();
          } else {
            element.style[name] = value;
          }
          return wrapElement(element);
        },
        text: (value) => {
          element.textContent = value;
          return wrapElement(element);
        },
        on: (eventName, handler) => {
          element.addEventListener(eventName, handler);
          return wrapElement(element);
        },
        remove: () => {
          element.parentNode?.removeChild(element);
          return null;
        }
      };
    }
    
    // 创建元素集合包装器
    function wrapElements(nodeList) {
      return {
        nodes: () => Array.from(nodeList),
        each: (callback) => {
          Array.from(nodeList).forEach((element, i) => {
            callback.call(element, element.__data__ || {}, i);
          });
          return wrapElements(nodeList);
        }
      };
    }
  }
  
  return window.d3 !== undefined;
}

/**
 * 增强触摸交互，优化移动设备体验
 */
export function enhanceTouchInteraction() {
  if (!isD3Loaded()) return;
  
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
 * 确保D3.js加载并应用修复
 */
export async function ensureD3Loaded() {
  // 如果已加载，直接返回
  if (isD3Loaded()) {
    console.log("D3.js已加载，应用增强功能");
    enhanceTouchInteraction();
    return true;
  }
  
  // 尝试动态加载
  console.log("D3.js未加载，尝试动态加载");
  const loadSuccess = await loadD3Dynamically();
  
  if (loadSuccess) {
    console.log("D3.js加载成功，应用增强功能");
    enhanceTouchInteraction();
    return true;
  }
  
  // 如果动态加载失败，应用替代方案
  console.log("D3.js加载失败，应用替代方案");
  const polyfillSuccess = applyMinimalD3Polyfill();
  
  if (polyfillSuccess) {
    console.log("成功应用D3.js替代方案");
    return true;
  }
  
  console.error("无法加载或替代D3.js");
  return false;
}

export default {
  ensureD3Loaded,
  enhanceTouchInteraction
};