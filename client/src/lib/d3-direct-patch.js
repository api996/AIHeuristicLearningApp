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

console.log("D3直接补丁已加载 - 全局_d3Selection对象已创建");

window.d3.zoom = function() {
            const zoom = originalZoom.apply(this, arguments);

            // 保存原始的on方法
            const originalOn = zoom.on;

            // 安全的事件处理
            zoom.on = function(typenames, callback) {
              if (callback) {
                return originalOn.call(this, typenames, function(event) {
                  // 确保事件对象存在
                  event = event || {};
                  event.transform = event.transform || defaultTransform;

                  // 同步到全局对象
                  window._d3Selection.event.transform = event.transform;
                  window.d3Selection.event.transform = event.transform;

                  return callback.apply(this, arguments);
                });
              }
              return originalOn.apply(this, arguments);
            };

            return zoom;
          };

          // 增强drag事件处理
          if (window.d3.drag) {
            const originalDrag = window.d3.drag;
            window.d3.drag = function() {
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
            };
          }