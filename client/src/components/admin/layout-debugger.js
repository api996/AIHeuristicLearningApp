/**
 * 管理员界面布局调试工具
 * 用于检测并输出超出容器宽度的元素，以方便定位布局问题
 * 使用方法：在开发环境中，将此脚本导入到管理员页面组件中
 */

/**
 * 在页面加载完成后打印所有溢出元素的信息
 * @param {string} selector - 要检查的元素选择器
 */
export function detectOverflowElements(selector = 'div, section, main, .admin-dashboard-container, .admin-dashboard-scrollable, .admin-dashboard-tabs-content') {
  if (typeof window === 'undefined') return; // 服务器端渲染时不执行
  
  window.addEventListener('load', () => {
    setTimeout(() => { // 延迟执行，确保DOM完全渲染
      console.log('🔍 正在检测溢出元素...');
      
      const els = Array.from(document.querySelectorAll(selector));
      const over = els
        .map(el => {
          const cs = getComputedStyle(el);
          return {
            selector: getDomPath(el),
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            minWidth: cs.minWidth,
            overflowX: cs.overflowX
          };
        })
        .filter(o => o.scrollWidth > o.clientWidth);
      
      if (over.length === 0) {
        console.log('✅ 未检测到溢出元素，布局正常!');
      } else {
        console.log('⚠️ 检测到以下溢出元素:');
        console.table(over);
        
        console.log('推荐修复:');
        over.forEach(item => {
          console.log(`为 ${item.selector} 添加: { min-width: 0 !important; overflow-x: visible !important; }`);
        });
      }
    }, 1000);
  });
}

/**
 * 生成元素的DOM路径
 * @param {HTMLElement} el - 要获取路径的元素
 * @returns {string} 元素的选择器路径
 */
function getDomPath(el) {
  const names = [];
  while (el.parentElement) {
    let n = el.tagName.toLowerCase();
    if (el.id) n += `#${el.id}`;
    else if (el.className) {
      const classNames = el.className.trim().split(/\s+/);
      if (classNames.length > 0) {
        n += `.${classNames.join('.')}`;
      }
    }
    names.unshift(n);
    el = el.parentElement;
  }
  return names.join(' > ');
}

/**
 * 添加Eruda移动端调试工具
 * 在移动设备上直接调试DOM和CSS
 */
export function addErudaDebugger() {
  if (typeof window === 'undefined') return; // 服务器端渲染时不执行
  
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  document.body.appendChild(script);
  script.onload = function () { 
    // @ts-ignore
    eruda.init(); 
    console.log('📱 Eruda移动端调试工具已加载，点击右下角图标开始调试');
  };
}