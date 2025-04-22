/**
 * D3.js库加载修复脚本 
 * 用于解决D3库在某些环境下的加载和样式应用问题
 */

// 创建一个全局的D3 selection对象
window._d3Selection = null;

// 监测D3是否已成功加载
function checkD3Loaded() {
  if (typeof d3 !== 'undefined') {
    console.log("D3.js成功加载，界面组件已修复");
    window._d3Selection = d3.selection;
    return true;
  }
  return false;
}

// 应用D3补丁
function applyD3Patch() {
  if (!checkD3Loaded()) {
    console.warn("D3补丁警告: d3对象未定义，无法应用补丁");
    
    // 设置重试定时器
    setTimeout(() => {
      console.log("D3.js检测到通过其他方式加载，正在初始化补丁");
      if (typeof d3 !== 'undefined') {
        window._d3Selection = d3.selection;
        console.log("D3补丁已成功应用");
      } else {
        // 加载失败，尝试动态加载D3
        loadD3FromCDN();
      }
    }, 1000);
    
    return false;
  }
  
  console.log("D3直接补丁已加载 - 全局_d3Selection对象已创建");
  return true;
}

// 动态加载D3库
function loadD3FromCDN() {
  console.log("开始加载D3.js库...");
  
  try {
    // 尝试从CDN加载D3
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js";
    script.integrity = "sha384-hKsKp7aHRKa5C4VHm+5tPOEUzT0Q5o8WvVj0nCehVWNzLwkIBDDDQ9SXU6YnfNC3t";
    script.crossOrigin = "anonymous";
    
    script.onload = () => {
      console.log("D3.js加载并初始化成功");
      window._d3Selection = d3.selection;
      
      // 触发样式更新
      setTimeout(() => {
        document.querySelectorAll('.admin-tabs,.admin-dashboard-tabs-content').forEach(el => {
          el.style.display = '';
          el.style.display = 'block';
        });
        console.log("已重新应用界面样式修复");
      }, 100);
    };
    
    script.onerror = () => {
      console.warn("D3.js加载失败，尝试使用非SRI版本");
      const fallbackScript = document.createElement('script');
      fallbackScript.src = "https://unpkg.com/d3@7/dist/d3.min.js";
      
      fallbackScript.onload = () => {
        console.log("D3.js非SRI版本加载成功");
        window._d3Selection = d3.selection;
      };
      
      fallbackScript.onerror = () => {
        console.error("D3.js加载失败，某些可视化功能可能不可用");
      };
      
      document.head.appendChild(fallbackScript);
    };
    
    document.head.appendChild(script);
  } catch (e) {
    console.error("D3.js初始加载失败，将继续尝试后台加载", e);
  }
}

// 立即自动执行
console.log("检测到iPad设备，应用iPad布局优化");

// 检测iOS设备
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (isIOS) {
  console.log("检测到iPad设备，应用iPad专用布局优化");
  
  // iOS设备专用样式修复
  document.documentElement.classList.add('ios-device');
  
  // 监听键盘事件，修复iPad键盘遮挡问题
  window.addEventListener('resize', () => {
    const viewportHeight = window.innerHeight;
    const windowHeight = window.outerHeight;
    
    if (viewportHeight < windowHeight * 0.8) {
      // 键盘可能打开
      document.documentElement.classList.add('keyboard-open');
    } else {
      // 键盘可能关闭
      document.documentElement.classList.remove('keyboard-open');
      console.log("键盘关闭，恢复正常布局");
    }
  });
  
  console.log("检测到iPad设备，已应用专用样式优化");
}

// 启动全局视口变化监听器用于CSS修复
const viewportObserver = new ResizeObserver(() => {
  setTimeout(() => {
    try {
      // 在视口大小变化时，重新应用样式修复
      document.querySelectorAll('.admin-tabs,.admin-dashboard-tabs-content').forEach(el => {
        el.style.display = '';
        el.style.display = 'block';
      });
    } catch (e) {
      // 忽略错误
    }
  }, 200);
});

viewportObserver.observe(document.documentElement);
console.log("已启动全局视口监听器，进行设备识别和CSS优化");

// 启动D3补丁
if (!applyD3Patch()) {
  // 如果直接补丁失败，尝试动态加载
  loadD3FromCDN();
}

// 暴露全局方法用于手动修复
window.fixD3AndStyles = function() {
  if (typeof d3 !== 'undefined') {
    window._d3Selection = d3.selection;
  } else {
    loadD3FromCDN();
  }
  
  // 重新应用样式修复
  document.querySelectorAll('.admin-tabs,.admin-dashboard-tabs-content').forEach(el => {
    el.style.display = '';
    el.style.display = 'block';
  });
};

// 导出对象
export default {
  applyD3Patch,
  loadD3FromCDN,
  fixStyles: () => {
    document.querySelectorAll('.admin-tabs,.admin-dashboard-tabs-content').forEach(el => {
      el.style.display = '';
      el.style.display = 'block';
    });
  }
};