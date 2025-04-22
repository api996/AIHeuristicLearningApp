/**
 * D3.js库直接补丁
 * 当其他修复方法失败时的应急方案
 */

(function() {
  if (typeof window === 'undefined') return;
  
  // 立即创建一个基本的_d3Selection垫片
  window._d3Selection = window._d3Selection || {
    select: (selector) => {
      const element = typeof selector === 'string' 
        ? document.querySelector(selector) 
        : selector;
        
      return {
        node: () => element,
        append: (tag) => {
          const newElement = document.createElement(tag);
          if (element) element.appendChild(newElement);
          return window._d3Selection.select(newElement);
        },
        attr: (name, value) => {
          if (element && typeof value !== 'undefined') {
            element.setAttribute(name, value);
          }
          return window._d3Selection.select(element);
        },
        style: (name, value) => {
          if (element && typeof value !== 'undefined') {
            element.style[name] = value;
          }
          return window._d3Selection.select(element);
        },
        text: (value) => {
          if (element && typeof value !== 'undefined') {
            element.textContent = value;
          }
          return window._d3Selection.select(element);
        },
        html: (value) => {
          if (element && typeof value !== 'undefined') {
            element.innerHTML = value;
          }
          return window._d3Selection.select(element);
        },
        selectAll: (childSelector) => {
          return window._d3Selection.selectAll(childSelector, element);
        },
        on: (eventName, handler) => {
          if (element) {
            element.addEventListener(eventName, handler);
          }
          return window._d3Selection.select(element);
        },
        remove: () => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
          return window._d3Selection.select(null);
        }
      };
    },
    
    selectAll: (selector, context) => {
      const container = context || document;
      const elements = container.querySelectorAll(selector);
      
      return {
        data: (dataArray) => {
          // 简单的数据绑定实现
          return {
            enter: () => ({
              append: (tag) => {
                const selection = [];
                
                // 为每个数据项创建新元素
                if (dataArray && dataArray.length) {
                  dataArray.forEach((data, i) => {
                    if (i >= elements.length) {
                      const newElement = document.createElement(tag);
                      newElement.__data__ = data;
                      if (container) container.appendChild(newElement);
                      selection.push(newElement);
                    }
                  });
                }
                
                // 返回包含所有新创建元素的选择集
                return {
                  attr: (name, valueFn) => {
                    selection.forEach((element, i) => {
                      const value = typeof valueFn === 'function' 
                        ? valueFn(element.__data__, i) 
                        : valueFn;
                      element.setAttribute(name, value);
                    });
                    return { attr: () => ({}) }; // 链式调用
                  },
                  style: (name, valueFn) => {
                    selection.forEach((element, i) => {
                      const value = typeof valueFn === 'function' 
                        ? valueFn(element.__data__, i) 
                        : valueFn;
                      element.style[name] = value;
                    });
                    return { style: () => ({}) }; // 链式调用
                  }
                };
              },
            }),
            exit: () => ({
              remove: () => {
                // 移除多余的元素
                if (dataArray && dataArray.length < elements.length) {
                  for (let i = dataArray.length; i < elements.length; i++) {
                    const element = elements[i];
                    if (element && element.parentNode) {
                      element.parentNode.removeChild(element);
                    }
                  }
                }
                return {};
              }
            })
          };
        }
      };
    }
  };
  
  // 向全局公开一个最小化的d3对象，当d3加载失败时使用
  if (typeof window.d3 === 'undefined') {
    window.d3 = window.d3 || {
      select: window._d3Selection.select,
      selectAll: window._d3Selection.selectAll,
      // 添加最小的缩放行为
      zoom: () => ({
        on: () => ({}),
        scaleExtent: () => ({ on: () => ({}) })
      }),
      // 添加最小的拖拽行为
      drag: () => ({
        on: () => ({}),
      }),
      // 添加基本的颜色缩放
      scaleOrdinal: () => (d) => '#cccccc',
      // 添加基本的力导向图布局
      forceSimulation: () => ({
        force: () => ({}),
        nodes: () => ({}),
        on: () => ({})
      })
    };
    
    // 设置selection函数
    window.d3.selection = function() {};
  }
  
  console.log('D3直接补丁已加载 - 全局_d3Selection对象已创建');
})();