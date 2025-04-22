/**
 * D3.js加载修复程序
 * 这个文件用于确保D3.js在应用启动时正确加载，并在页面刷新后保持可用
 * 它解决了在界面刷新后d3对象未定义导致UI样式崩溃的问题
 * 
 * @module d3-load-fix
 * @typescript
 */

// 创建一个可靠的D3加载程序
const ensureD3Loaded = (function() {
  // 跟踪尝试次数
  let attempts = 0;
  const maxAttempts = 20; // 增加尝试次数
  let isLoading = false;
  let loadSuccess = false;
  
  // 加载d3.js的函数
  async function loadD3() {
    if (isLoading || loadSuccess || typeof window === 'undefined') return;
    
    isLoading = true;
    console.log('开始加载D3.js库...');
    
    try {
      // 检查d3是否已经加载
      if (window.d3) {
        console.log('D3.js已加载，正在初始化补丁...');
        initializeD3Patches();
        loadSuccess = true;
        isLoading = false;
        return true;
      }
      
      // 如果没有，尝试动态加载d3
      const loadScript = () => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
          script.integrity = 'sha384-RnVlgLn9MKvQVPCR0tcBS/IJtgwIoLXXoXax+7WRpLBsk4i9aiNEJ2t6nQwyBl4K';
          script.crossOrigin = 'anonymous';
          script.onload = () => {
            console.log('D3.js加载成功');
            resolve(true);
          };
          script.onerror = () => {
            console.warn('D3.js加载失败，尝试使用非SRI版本');
            
            // 如果SRI加载失败，尝试非SRI版本
            const fallbackScript = document.createElement('script');
            fallbackScript.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
            fallbackScript.onload = () => {
              console.log('D3.js非SRI版本加载成功');
              resolve(true);
            };
            fallbackScript.onerror = () => {
              console.error('D3.js加载失败');
              reject(new Error('D3.js加载失败'));
            };
            document.head.appendChild(fallbackScript);
          };
          document.head.appendChild(script);
        });
      };
      
      // 尝试加载d3
      const loaded = await loadScript();
      
      if (loaded && window.d3) {
        initializeD3Patches();
        loadSuccess = true;
        console.log('D3.js加载并初始化成功');
      } else {
        console.warn('D3.js加载成功但全局对象未定义');
      }
    } catch (error) {
      console.error('D3.js加载过程中发生错误:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // 初始化D3补丁
  function initializeD3Patches() {
    if (!window.d3) {
      console.warn('无法初始化D3补丁: d3对象未定义');
      return false;
    }
    
    try {
      // 创建全局_d3Selection对象
      window._d3Selection = window._d3Selection || {
        event: null,
        transform: { k: 1, x: 0, y: 0 }
      };
      
      // 创建兼容性d3Selection对象
      window.d3Selection = window.d3Selection || {
        d3: window.d3,
        event: null,
        mouse: function(container) {
          if (this.event && this.event.x !== undefined && this.event.y !== undefined) {
            return [this.event.x, this.event.y];
          }
          return [0, 0];
        },
        setEvent: function(event) {
          this.event = event;
        },
        transform: { k: 1, x: 0, y: 0 }
      };
      
      // 修复d3.zoom
      if (window.d3.zoom) {
        const originalZoom = window.d3.zoom;
        window.d3.zoom = function() {
          try {
            const zoom = originalZoom.apply(this, arguments);
            const originalOn = zoom.on;
            zoom.on = function(typenames, callback) {
              if (callback) {
                return originalOn.call(this, typenames, function(event) {
                  try {
                    event = event || {};
                    event.transform = event.transform || { k: 1, x: 0, y: 0 };
                    window._d3Selection.event = window._d3Selection.event || {};
                    window._d3Selection.event.transform = event.transform;
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
      }
      
      console.log('D3补丁已成功应用');
      return true;
    } catch (error) {
      console.error('D3补丁初始化错误:', error);
      return false;
    }
  }
  
  // 返回加载函数
  return function() {
    // 如果已经成功加载，直接返回
    if (loadSuccess && window.d3) return Promise.resolve(true);
    
    // 如果已经尝试太多次，放弃
    if (attempts >= maxAttempts) {
      console.error(`已尝试${maxAttempts}次加载D3.js，放弃加载`);
      return Promise.resolve(false);
    }
    
    attempts++;
    
    // 立即尝试一次加载
    const loadPromise = loadD3();
    
    // 如果需要，设置轮询检查
    if (!window.d3) {
      const checkInterval = setInterval(() => {
        if (window.d3) {
          clearInterval(checkInterval);
          initializeD3Patches();
          loadSuccess = true;
          console.log('D3.js检测到通过其他方式加载，正在初始化补丁');
        } else if (attempts < maxAttempts) {
          attempts++;
          loadD3();
        } else {
          clearInterval(checkInterval);
          console.warn(`已尝试${maxAttempts}次加载D3.js，停止尝试`);
        }
      }, 300);
      
      // 确保在页面卸载时清除定时器
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          clearInterval(checkInterval);
        });
      }
    }
    
    return loadPromise;
  };
})();

// 导出加载函数
export { ensureD3Loaded };

// 立即执行一次加载尝试
ensureD3Loaded();

// 监听DOM加载完成事件
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureD3Loaded);
  } else {
    // 如果DOM已经加载完成，立即执行
    setTimeout(ensureD3Loaded, 0);
  }
  
  // 在window加载完成后再次尝试
  window.addEventListener('load', ensureD3Loaded);
}

export default ensureD3Loaded;