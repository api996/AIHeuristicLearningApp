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