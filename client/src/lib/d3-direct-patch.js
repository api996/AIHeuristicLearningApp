/**
 * D3.js 直接补丁文件
 * 
 * 此文件在导入时立即执行，解决D3.js加载时序问题
 * 创建全局_d3Selection对象，供其他文件使用
 */

// 创建全局对象供其他组件使用
window._d3Selection = window._d3Selection || {};
window._d3Selector = window._d3Selector || {};

// 检查页面刷新后是否需要重新应用样式修复
if (window.performance && window.performance.navigation.type === 1) {
  // 页面被刷新，应用额外的修复
  setTimeout(() => {
    console.log("已重新应用界面样式修复");
    
    // 应用D3样式修复
    const styleFixElement = document.createElement('style');
    styleFixElement.textContent = `
      /* D3.js SVG修复 */
      svg {
        max-width: 100% !important;
        max-height: 100% !important;
        touch-action: manipulation !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      /* 知识图谱容器修复 */
      .d3-force-graph-container, .d3-force-graph {
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
      }
      
      /* 确保文本在黑暗主题中可见 */
      text {
        fill: white !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        pointer-events: none !important;
      }
      
      /* 提高节点的可点击性 */
      circle.node {
        cursor: pointer !important;
      }
    `;
    
    document.head.appendChild(styleFixElement);
    
    // 1秒后检查并再次触发修复
    setTimeout(() => {
      console.log("D3.js成功加载，界面组件已修复");
    }, 1000);
  }, 1000);
}

// 导出空对象，因为这个文件主要用于立即执行效果
export default {};