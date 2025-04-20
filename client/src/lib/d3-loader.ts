/**
 * D3库加载器
 * 确保D3库正确加载并挂载到全局对象
 */

import * as d3 from 'd3';

// 确保window.d3存在
declare global {
  interface Window {
    d3: any;
    _d3Selection: any;
    d3Selection: any;
    loadD3AndApplyPatch?: () => void;
  }
}

/**
 * 初始化D3库并将其挂载到全局对象
 */
export function initD3() {
  try {
    // 确保D3库挂载到window对象
    if (!window.d3) {
      console.log('正在加载D3库并挂载到全局...');
      window.d3 = d3;
    }
    
    return true;
  } catch (err) {
    console.error('D3库初始化失败:', err);
    return false;
  }
}

/**
 * 加载D3并手动应用补丁
 * 用于解决D3类型和挂载问题
 */
export function loadD3AndApplyPatch() {
  const success = initD3();
  
  if (success) {
    console.log('D3库加载成功，已应用补丁');
    
    // 创建d3Selection对象，确保向下兼容
    if (!window._d3Selection) {
      window._d3Selection = d3.select ? d3.select : null;
    }
    
    if (!window.d3Selection) {
      window.d3Selection = d3.select ? d3.select : null;
    }
    
    // 返回d3实例以便直接使用
    return window.d3;
  }
  
  console.error('D3库加载失败，无法应用补丁');
  return null;
}

// 导出d3实例以便直接使用
export const d3Instance = loadD3AndApplyPatch();

// 添加到window对象
if (typeof window !== 'undefined') {
  window.loadD3AndApplyPatch = loadD3AndApplyPatch;
}

export default d3Instance;