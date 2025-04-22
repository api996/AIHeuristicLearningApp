import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 直接在主入口文件导入关键CSS样式，确保它们在构建中被包含
import "./components/ui/mobile-fixes.css";
import "./components/ui/ipad-fixes.css";
import "./components/ui/button-styles.css";
import "./components/ui/icon-fixes.css"; // 导入图标大小修复

// 导入D3加载修复和补丁文件
import { ensureD3Loaded } from "./lib/d3-load-fix";
import "./lib/d3-patch.js";

// 预加载管理员组件，确保它们被包含在构建中
import { preloadAdminComponents } from "./admin-components";

// 在应用启动前确保D3.js已加载
ensureD3Loaded().then(loaded => {
  if (loaded) {
    console.log("D3.js库已成功加载和初始化，可视化组件将正常运行");
  }
});

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
