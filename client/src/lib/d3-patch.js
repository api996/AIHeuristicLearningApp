/**
 * D3.js库兼容性补丁
 * 解决D3.js与React组件交互时的常见问题
 */

(function() {
  if (typeof window === 'undefined') return;
  
  // 在DOM加载完成后应用补丁
  function applyPatch() {
    // 检查D3对象是否存在
    if (typeof window.d3 === 'undefined') {
      console.warn('D3补丁警告: d3对象未定义，无法应用补丁');
      
      // 定期检查D3是否已加载
      const checkInterval = setInterval(() => {
        if (typeof window.d3 !== 'undefined') {
          console.log('D3对象现已可用，应用补丁');
          clearInterval(checkInterval);
          completePatch();
        }
      }, 200);
      
      // 在5秒后停止检查，避免无限循环
      setTimeout(() => clearInterval(checkInterval), 5000);
      
      return;
    }
    
    completePatch();
  }
  
  // 完成补丁应用过程
  function completePatch() {
    if (typeof window.d3 === 'undefined') return;
    
    // 创建/更新全局_d3Selection对象
    window._d3Selection = window.d3.selection;
    
    // 修复Safari和iOS特定的SVG渲染问题
    fixSvgInSafari();
    
    // 修复触摸设备上的事件处理
    fixTouchEvents();
    
    console.log('D3补丁已成功应用');
  }
  
  // 修复Safari和iOS特定的SVG渲染问题
  function fixSvgInSafari() {
    // 检测Safari浏览器
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isSafari) {
      console.log('检测到Safari浏览器，应用SVG渲染修复');
      
      // 观察SVG元素，确保它们在Safari中正确渲染
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.tagName === 'svg') {
                // 修复Safari中的SVG渲染问题
                node.setAttribute('width', node.getAttribute('width') || '100%');
                node.setAttribute('height', node.getAttribute('height') || '100%');
                node.style.display = 'block';
              }
            });
          }
        });
      });
      
      // 配置并启动观察器
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  
  // 修复触摸设备上的事件处理
  function fixTouchEvents() {
    // 检测是否为触摸设备
    const isTouchDevice = 'ontouchstart' in window || 
                         navigator.maxTouchPoints > 0 || 
                         navigator.msMaxTouchPoints > 0;
    
    if (isTouchDevice) {
      console.log('检测到触摸设备，应用触摸事件修复');
      
      // 对document添加被动事件监听器，提高性能
      document.addEventListener('touchstart', function() {}, { passive: true });
      document.addEventListener('touchmove', function() {}, { passive: true });
      
      // 监听后续添加的svg元素，优化它们的触摸交互
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.tagName === 'svg') {
                // 为svg元素添加触摸友好的属性
                node.style.touchAction = 'manipulation';
                
                // 为其子元素添加触摸友好的属性
                const touchElements = node.querySelectorAll('circle, rect, path, line');
                touchElements.forEach(el => {
                  el.style.touchAction = 'manipulation';
                  
                  // 增大触摸目标区域，提高可用性
                  if (el.tagName === 'circle' && parseFloat(el.getAttribute('r')) < 10) {
                    el.setAttribute('r', '10');
                  }
                });
              }
            });
          }
        });
      });
      
      // 配置并启动观察器
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  
  // 在DOM加载完成后执行补丁
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPatch);
  } else {
    applyPatch();
  }
  
  // 监听自定义的d3Loaded事件
  window.addEventListener('d3Loaded', completePatch);
})();