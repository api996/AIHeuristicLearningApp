/**
 * D3.js直接补丁 - 专门解决_d3Selection.event问题
 * 这是一个简单的全局变量补丁，确保react-d3-graph使用的_d3Selection对象存在
 */

// 立即创建全局_d3Selection对象
window._d3Selection = window._d3Selection || {
  event: {
    transform: { k: 1, x: 0, y: 0 }
  }
};

// 默认transform参数
const defaultTransform = { k: 1, x: 0, y: 0 };

// 延迟执行，确保在d3加载后执行补丁
setTimeout(() => {
  // 尝试加载D3库并应用补丁
  try {
    // 确保d3全局对象存在
    if (typeof window.d3 === 'undefined' && typeof d3 !== 'undefined') {
      window.d3 = d3;
    }
    
    console.log("D3直接补丁已加载 - 全局_d3Selection对象已创建");
  } catch (err) {
    console.warn("D3补丁加载失败:", err);
  }
}, 500);

// 添加一个延迟检查，确保d3对象加载完成
setTimeout(() => {
  // 只有当d3已经初始化后才应用补丁
  if (window.d3) {
    // 修补zoom函数
    if (window.d3.zoom) {
      const originalZoom = window.d3.zoom;
      window.d3.zoom = function() {
        try {
          const zoom = originalZoom.apply(this, arguments);
          
          // 保存原始的on方法
          const originalOn = zoom.on;
          
          // 安全的事件处理
          zoom.on = function(typenames, callback) {
            if (callback) {
              return originalOn.call(this, typenames, function(event) {
                try {
                  // 确保事件对象存在
                  event = event || {};
                  event.transform = event.transform || defaultTransform;
                  
                  // 同步到全局对象
                  window._d3Selection.event = window._d3Selection.event || {};
                  window._d3Selection.event.transform = event.transform;
                  
                  // 确保d3Selection也存在
                  if (window.d3Selection) {
                    window.d3Selection.event = window.d3Selection.event || {};
                    window.d3Selection.event.transform = event.transform;
                  }
                  
                  return callback.apply(this, arguments);
                } catch (err) {
                  console.warn("D3缩放事件处理错误:", err);
                  return undefined;
                }
              });
            }
            return originalOn.apply(this, arguments);
          };
          
          return zoom;
        } catch (err) {
          console.warn("D3.zoom包装错误:", err);
          return originalZoom.apply(this, arguments);
        }
      };
    } else {
      console.warn("D3补丁警告: d3.zoom未定义，无法应用补丁");
    }
    
    // 修补drag函数
    if (window.d3.drag) {
      const originalDrag = window.d3.drag;
      window.d3.drag = function() {
        try {
          const drag = originalDrag.apply(this, arguments);
          
          // 保存原始的on方法
          const originalOn = drag.on;
          
          // 安全的事件处理
          drag.on = function(typenames, callback) {
            if (callback) {
              return originalOn.call(this, typenames, function(event, d) {
                try {
                  // 确保事件属性存在
                  event = event || {};
                  
                  // 确保x和y坐标存在
                  if (typenames === 'drag') {
                    event.x = typeof event.x !== 'undefined' ? event.x : (d && d.x ? d.x : 0);
                    event.y = typeof event.y !== 'undefined' ? event.y : (d && d.y ? d.y : 0);
                  }
                  
                  return callback.apply(this, arguments);
                } catch (err) {
                  console.warn("D3拖拽事件处理错误:", err);
                  return undefined;
                }
              });
            }
            return originalOn.apply(this, arguments);
          };
          
          return drag;
        } catch (err) {
          console.warn("D3.drag包装错误:", err);
          return originalDrag.apply(this, arguments);
        }
      };
    }
  } else {
    console.warn("D3补丁警告: d3对象未定义，无法应用补丁");
  }
}, 500); // 500毫秒延迟，确保d3加载完成