/**
 * D3.js补丁
 * 
 * 这个文件修复D3.js在一些情境下的兼容性问题，
 * 特别是在SimpleKnowledgeGraph组件中使用d3-drag和d3-zoom时可能出现的问题。
 */

// 动态加载D3和应用补丁的函数
function loadD3AndApplyPatch() {
  // 确保在浏览器环境中运行
  if (typeof window === 'undefined') return;
  
  // 创建全局d3Selection和_d3Selection对象
  if (!window._d3Selection) {
    window._d3Selection = {
      event: null,
      transform: { k: 1, x: 0, y: 0 }
    };
  }
  
  if (!window.d3Selection) {
    window.d3Selection = {
      event: null,
      mouse: function(container) {
        // 如果有自定义事件，使用事件坐标
        if (this.event && this.event.x !== undefined && this.event.y !== undefined) {
          return [this.event.x, this.event.y];
        }
        // 否则返回默认值
        return [0, 0];
      },
      // 保存当前事件和变换
      setEvent: function(event) {
        this.event = event;
      },
      transform: { k: 1, x: 0, y: 0 }
    };
  }
  
  // 如果已经有d3对象了，直接应用补丁
  if (window.d3) {
    applyD3Patch(window.d3);
  } 
  // 否则设置一个监听器来等待d3对象
  else {
    // 每500毫秒检查一次，共尝试10次
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      if (window.d3) {
        clearInterval(interval);
        applyD3Patch(window.d3);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn("D3补丁警告: 多次尝试后d3对象仍未定义，无法应用补丁");
      }
    }, 500);
  }
  
  // 监听DOM变化，检测D3加载
  try {
    const observer = new MutationObserver((mutations) => {
      if (window.d3 && !window._d3PatchApplied) {
        applyD3Patch(window.d3);
        observer.disconnect();
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // 5秒后自动断开观察者
    setTimeout(() => observer.disconnect(), 5000);
  } catch (e) {
    console.warn("设置DOM变化监听失败:", e);
  }
}

// 应用D3补丁的函数
function applyD3Patch(d3) {
  if (!d3 || window._d3PatchApplied) return;
  
  try {
    // 保存d3引用到全局对象
    window._d3Selection.d3 = d3;
    window.d3Selection.d3 = d3;
    
    // 标记补丁已应用
    window._d3PatchApplied = true;
    
    console.log("D3补丁成功应用 - d3对象已注入到全局_d3Selection对象");
    
    // 如果在SimpleKnowledgeGraph组件中有更新d3引用的函数，触发它
    if (typeof window._updateD3Reference === 'function') {
      window._updateD3Reference(d3);
    }
  } catch (e) {
    console.warn("应用D3补丁时出错:", e);
  }
}

// 立即执行补丁加载函数
loadD3AndApplyPatch();

// 导出以便在需要时手动重新加载
// 使用三种导出方式确保兼容性
export { loadD3AndApplyPatch };
export default loadD3AndApplyPatch;
// CommonJS兼容
if (typeof module !== 'undefined') {
  module.exports = { loadD3AndApplyPatch };
}