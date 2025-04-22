/**
 * D3.js修复工具集
 * 提供修复D3.js在iPad和高DPI设备上的渲染和交互问题的工具函数
 */

// D3加载状态
export let d3Loaded = false;

// 检查D3是否已加载
export function isD3Loaded() {
  return typeof window !== 'undefined' && window.d3 !== undefined;
}

// 加载D3库
export async function loadD3() {
  if (isD3Loaded()) {
    d3Loaded = true;
    return true;
  }
  
  try {
    // 尝试加载D3.js库
    await import('d3');
    
    // 检查是否成功加载
    if (isD3Loaded()) {
      console.log("D3.js库已成功加载");
      d3Loaded = true;
      return true;
    } else {
      console.error("D3.js库加载失败，window.d3未定义");
      return false;
    }
  } catch (error) {
    console.error("加载D3.js库时出错:", error);
    return false;
  }
}

// 确保D3已加载
export async function ensureLoaded() {
  if (d3Loaded) return true;
  return await loadD3();
}

// 检测设备类型
export function detectDevice() {
  if (typeof window === 'undefined') return 'unknown';
  
  const isIPad = /iPad/.test(navigator.userAgent) || 
                (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
  
  const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
  
  const isTablet = isIPad || 
                  (window.innerWidth >= 768 && window.innerWidth <= 1366 && 'ontouchend' in document);
  
  const isHighDPI = window.devicePixelRatio >= 2;
  
  if (isIPad) {
    document.documentElement.classList.add('ipad-device');
    console.log("检测到iPad设备，应用iPad专用布局优化");
    return 'ipad';
  } else if (isIPhone) {
    document.documentElement.classList.add('iphone-device');
    console.log("检测到iPhone设备，应用移动布局优化");
    return 'iphone';
  } else if (isTablet) {
    document.documentElement.classList.add('tablet-device');
    console.log("检测到平板设备，应用平板布局优化");
    return 'tablet';
  } else if (isHighDPI) {
    document.documentElement.classList.add('high-dpi-device');
    console.log("检测到高DPI设备，应用高分辨率优化");
    return 'high-dpi';
  }
  
  return 'desktop';
}

// 获取SVG中的所有节点
export function getAllSvgNodes(svgContainer) {
  if (!svgContainer) return [];
  return Array.from(svgContainer.querySelectorAll('.node, circle, .node-circle'));
}

// 修复SVG交互问题
export function fixSvgInteraction(svgElement) {
  if (!svgElement) return;
  
  // 阻止默认的触摸事件行为
  svgElement.addEventListener('touchstart', (e) => {
    if (e.target.closest('circle, .node, .node-circle')) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // 阻止鼠标事件
  svgElement.addEventListener('mousedown', (e) => {
    if (e.target.closest('circle, .node, .node-circle')) {
      e.preventDefault();
    }
  }, { passive: false });
}

// 修复D3力导向图布局
export function fixForceLayout(simulation, svg) {
  if (!simulation || !svg || !window.d3) return;
  
  // 检测设备类型
  const deviceType = detectDevice();
  const isTouch = ['ipad', 'iphone', 'tablet'].includes(deviceType);
  
  // 修改力导向图参数以适应触摸设备
  if (isTouch) {
    // 增加节点之间的距离
    if (simulation.force('link')) {
      simulation.force('link').distance(100);
    }
    
    // 增加电荷力，使节点更分散
    if (simulation.force('charge')) {
      simulation.force('charge').strength(-150);
    }
    
    // 减小中心引力
    if (simulation.force('center')) {
      simulation.force('center').strength(0.08);
    }
    
    // 减少随机性，使布局更稳定
    if (simulation.alphaDecay) {
      simulation.alphaDecay(0.02);
    }
  }
  
  // 处理拖动行为（如果d3已加载）
  if (window.d3 && window.d3.drag) {
    svg.call(window.d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));
      
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }
}

// 导出工具集
const d3PatchUtils = {
  isD3Loaded,
  loadD3,
  ensureLoaded,
  detectDevice,
  getAllSvgNodes,
  fixSvgInteraction,
  fixForceLayout
};

export default d3PatchUtils;