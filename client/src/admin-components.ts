/**
 * 管理员组件预加载文件
 * 此文件的唯一目的是确保所有管理员相关组件在生产构建中被包含
 * 被主入口文件(main.tsx)引用
 */

// 导入所有管理员组件
import "./components/admin/ContentModerationSettings";
import "./components/admin/PromptEditorPage";
import "./components/admin/PromptTemplateManager";
import "./components/admin/SystemSettings";

// 导入管理员页面
import "./pages/admin-dashboard";

// 预加载管理员相关功能的函数 - 仅为了确保这些代码被包含在构建中
export function preloadAdminComponents() {
  console.log("管理员组件已预加载");
  return true;
}

export default preloadAdminComponents;