import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 直接在主入口文件导入关键CSS样式，确保它们在构建中被包含
import "./theme-fallback.css"; // 导入主题备份CSS，解决生产环境中的样式问题
import "./components/ui/mobile-fixes.css";
import "./components/ui/ipad-fixes.css";
import "./components/ui/button-styles.css";
import "./components/ui/icon-fixes.css"; // 导入图标大小修复

// 导入D3加载修复和补丁文件
import { ensureD3Loaded } from "./lib/d3-load-fix";
import "./lib/d3-patch.js";

// 预加载管理员组件，确保它们被包含在构建中
import { preloadAdminComponents } from "./admin-components";

// 在应用启动前确保D3.js已加载，并配置重试机制
(async function initializeD3AndCriticalComponents() {
  try {
    // 先尝试加载D3
    const d3Loaded = await ensureD3Loaded();
    
    if (d3Loaded) {
      console.log("D3.js库已成功加载和初始化，可视化组件将正常运行");
    } else {
      console.warn("D3.js初始加载失败，将继续尝试后台加载");
      
      // 如果首次加载失败，设置重试
      let retryCount = 0;
      const maxRetries = 3;
      
      const retryInterval = setInterval(async () => {
        if (window.d3) {
          clearInterval(retryInterval);
          console.log("D3.js成功加载，界面组件已修复");
          return;
        }
        
        if (retryCount >= maxRetries) {
          clearInterval(retryInterval);
          console.error("D3.js多次加载失败，某些UI组件可能无法正常显示");
          return;
        }
        
        console.log(`正在重试加载D3.js (${retryCount + 1}/${maxRetries})...`);
        retryCount++;
        await ensureD3Loaded();
      }, 2000);
    }
    
    // 确保在快速刷新后重新应用必要的CSS类
    setTimeout(() => {
      if (document.documentElement.classList.contains('ipad-device')) {
        // 重新应用iPad和管理员界面修复
        const styleFixElements = document.querySelectorAll('.tabs-container, [role="tablist"], [role="tab"]');
        styleFixElements.forEach(el => {
          // 触发重新布局
          const element = el as HTMLElement;
          if (element.style) {
            const originalDisplay = element.style.display;
            element.style.display = 'none';
            // 强制重绘
            void element.offsetHeight;
            element.style.display = originalDisplay;
          }
        });
        
        console.log("已重新应用界面样式修复");
      }
    }, 1000);
    
  } catch (error) {
    console.error("初始化关键组件时出错:", error);
  }
})();

// 在开发环境下，预加载管理员组件
if (process.env.NODE_ENV !== 'production') {
  console.log('开发环境：预加载管理员组件');
  preloadAdminComponents();
} else {
  // 在生产环境中，延迟预加载管理员组件，但确保它们被包含在构建中
  setTimeout(() => {
    preloadAdminComponents();
    console.log('生产环境：管理员组件已加载');
  }, 2000);
}

createRoot(document.getElementById("root")!).render(<App />);
