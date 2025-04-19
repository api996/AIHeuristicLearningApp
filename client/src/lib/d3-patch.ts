/**
 * D3补丁文件 
 * 用于解决react-d3-graph与最新版d3不兼容的问题
 * 特别处理d3.event和transform属性
 */

// 为window对象添加d3类型定义
declare global {
  interface Window {
    d3: any;
    d3Selection: any;
    _d3Selection: any;
  }
}

// 创建全局_d3Selection对象（react-d3-graph直接引用这个名称）
if (typeof window !== 'undefined') {
  window._d3Selection = {
    event: {
      transform: { k: 1, x: 0, y: 0 }
    }
  };
}

// 在加载时执行此文件
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      // 添加d3.event垫片，修复"_d3Selection.event.transform"错误
      const d3 = window.d3;
      
      if (d3) {
        // 确保d3.event存在
        if (!d3.event) {
          d3.event = {
            transform: { k: 1, x: 0, y: 0 }
          };
        }

        // 修复_d3Selection全局对象
        if (!window.d3Selection) {
          window.d3Selection = {
            event: {
              transform: { k: 1, x: 0, y: 0 }
            }
          };
        }

        // 劫持d3.zoom以确保transform可用
        if (d3.zoom) {
          const originalZoom = d3.zoom;
          d3.zoom = function(this: any) {
            const zoom = originalZoom.apply(this, arguments);
            
            // 保存原始的on方法
            const originalOn = zoom.on;
            
            // 覆盖on方法以确保事件对象可用
            zoom.on = function(typenames: string, callback: any) {
              if (callback) {
                const enhancedCallback = function(this: any) {
                  // 确保d3.event存在
                  d3.event = d3.event || {};
                  
                  // 确保d3.event.transform存在
                  if (!d3.event.transform) {
                    d3.event.transform = { k: 1, x: 0, y: 0 };
                  }
                  
                  // 确保_d3Selection.event存在
                  if (window.d3Selection) {
                    window.d3Selection.event = window.d3Selection.event || {};
                    window.d3Selection.event.transform = d3.event.transform;
                  }
                  
                  // 同步到全局_d3Selection对象
                  if (window._d3Selection) {
                    window._d3Selection.event = window._d3Selection.event || {};
                    window._d3Selection.event.transform = d3.event.transform;
                  }
                  
                  // 调用原始回调
                  return callback.apply(this, arguments);
                };
                
                return originalOn.call(this, typenames, enhancedCallback);
              }
              
              return originalOn.apply(this, arguments);
            };
            
            return zoom;
          };
        }

        // 劫持d3选择器，修复事件处理
        const originalD3Select = d3.select;
        const originalD3SelectAll = d3.selectAll;
        
        // 劫持d3.select方法
        d3.select = function(this: any) {
          const selection = originalD3Select.apply(this, arguments);
          patchSelection(selection);
          return selection;
        };
        
        // 劫持d3.selectAll方法
        d3.selectAll = function(this: any) {
          const selection = originalD3SelectAll.apply(this, arguments);
          patchSelection(selection);
          return selection;
        };
        
        // 为selection添加事件处理垫片
        const patchSelection = (selection: any): void => {
          if (!selection || typeof selection !== 'object') return;
          
          const originalOn = selection.on;
          if (originalOn && typeof originalOn === 'function') {
            selection.on = function(typenames: any, callback: any) {
              if (callback) {
                const wrappedCallback = function(this: any) {
                  // 确保d3.event存在
                  d3.event = d3.event || {};
                  
                  // 确保d3.event.transform存在
                  if (!d3.event.transform) {
                    d3.event.transform = { k: 1, x: 0, y: 0 };
                  }
                  
                  // 确保_d3Selection.event存在
                  if (window.d3Selection) {
                    window.d3Selection.event = window.d3Selection.event || {};
                    window.d3Selection.event.transform = d3.event.transform;
                  }
                  
                  // 应用原始回调
                  return callback.apply(this, arguments);
                };
                
                return originalOn.call(this, typenames, wrappedCallback);
              }
              
              return originalOn.call(this, typenames);
            };
          }
        };
        
        console.log("D3补丁已完全加载 - 修复d3.event和transform问题");
      }
    } catch (error) {
      console.error("D3补丁加载失败:", error);
    }
  }, 500); // 延迟执行以确保D3已完全加载
}

export {};