/**
 * D3.js补丁 - 简化版
 * 
 * 这个文件修复D3.js在SimpleKnowledgeGraph组件中使用d3-drag和d3-zoom时的兼容性问题
 * 通过全局对象初始化解决D3实例在不同模块间共享的问题
 */

// 在主文件加载时立即执行初始化
(function() {
  // 确保在浏览器环境中运行
  if (typeof window === 'undefined') return;
  
  // 创建全局函数，确保它可以在组件内部访问
  window.loadD3AndApplyPatch = function() {
    try {
      // 创建全局d3Selection和_d3Selection对象
      if (!window._d3Selection) {
        window._d3Selection = {
          d3: window.d3, // 保存D3实例引用
          event: null,
          transform: { k: 1, x: 0, y: 0 }
        };
        console.log("D3直接补丁已加载 - 全局_d3Selection对象已创建");
      }
      
      if (!window.d3Selection) {
        window.d3Selection = {
          d3: window.d3, // 保存D3实例引用
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
      
      // 标记补丁已初始化
      window._d3PatchInitialized = true;
      
      return true;
    } catch (e) {
      console.warn("D3补丁初始化错误:", e);
      return false;
    }
  };
  
  // 如果window.d3还不存在，设置一个监听器等待D3加载
  if (!window.d3) {
    console.warn("D3补丁警告: d3对象未定义，无法应用补丁");
    
    // 尝试每500毫秒检查一次，共尝试10次
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      if (window.d3) {
        clearInterval(interval);
        window.loadD3AndApplyPatch();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn("D3补丁警告: 多次尝试后d3对象仍未定义，无法应用补丁");
      }
    }, 500);
  } else {
    // D3已存在，直接初始化
    window.loadD3AndApplyPatch();
  }
})();

// 导出空对象 - 主要功能已通过全局函数提供
export default {};