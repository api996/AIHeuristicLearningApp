/**
 * D3补丁文件 
 * 用于解决react-d3-graph与最新版d3不兼容的问题
 */

// 为window对象添加d3类型定义
declare global {
  interface Window {
    d3: any;
  }
}

// 在加载时执行此文件
if (typeof window !== 'undefined') {
  // 添加d3.event垫片，修复"_d3Selection.event.transform"错误
  // 这是因为在较新版本的D3中，event被移到了d3.event中
  const d3 = window.d3;
  if (d3 && !d3.event) {
    d3.event = null;
    
    // 劫持d3选择器，修复事件处理
    const originalD3Select = d3.select;
    const originalD3SelectAll = d3.selectAll;
    
    // 劫持d3.select方法，为其添加事件处理能力
    d3.select = function(...args: any[]) {
      const selection = originalD3Select.apply(this, args);
      patchSelection(selection);
      return selection;
    };
    
    // 劫持d3.selectAll方法，为其添加事件处理能力
    d3.selectAll = function(...args: any[]) {
      const selection = originalD3SelectAll.apply(this, args);
      patchSelection(selection);
      return selection;
    };
    
    // 为selection添加事件处理垫片
    const patchSelection = (selection: any) => {
      if (!selection || typeof selection !== 'object') return;
      
      const originalOn = selection.on;
      if (originalOn && typeof originalOn === 'function') {
        selection.on = function(typenames: any, callback: any) {
          if (callback) {
            const wrappedCallback = function(this: any, ...args: any[]) {
              d3.event = d3.event || {};
              d3.event.transform = d3.event.transform || { k: 1, x: 0, y: 0 };
              const result = callback.apply(this, args);
              return result;
            };
            return originalOn.call(this, typenames, wrappedCallback);
          }
          return originalOn.call(this, typenames);
        };
      }
    };
    
    // 添加默认的变换对象
    d3.event = {
      transform: { k: 1, x: 0, y: 0 }
    };
    
    console.log("D3补丁已加载 - 修复d3.event缺失问题");
  }
}

export {};