// 管理员组件预加载文件
// 此文件的目的是确保所有管理员相关组件在构建时不被树摇优化删除

import { lazy } from 'react';

// 懒加载管理员相关组件
// 仅导入实际存在的组件
const AdminDashboard = lazy(() => import('./pages/admin-dashboard'));
const UserDetails = lazy(() => import('./pages/user-details'));
const ChatDetails = lazy(() => import('./pages/chat-details'));
const PromptEditor = lazy(() => import('./pages/prompt-editor'));

// 实际存在的管理员组件
const ContentModerationSettings = lazy(() => import('./components/admin/ContentModerationSettings'));
const PromptEditorPage = lazy(() => import('./components/admin/PromptEditorPage'));
const PromptTemplateManager = lazy(() => import('./components/admin/PromptTemplateManager'));
const SystemSettings = lazy(() => import('./components/admin/SystemSettings'));

// 预加载函数，确保在构建时保留这些组件
export function preloadAdminComponents() {
  // 这个函数不需要实际执行任何操作
  // 仅通过引用确保这些组件被包含在构建中
  console.log('管理员组件已预加载');
  
  // 返回组件列表，确保它们不被优化掉
  return {
    AdminDashboard,
    UserDetails,
    ChatDetails,
    PromptEditor,
    ContentModerationSettings,
    PromptEditorPage,
    PromptTemplateManager,
    SystemSettings
  };
}

// 导出所有管理员组件，确保它们在构建中被保留
export {
  AdminDashboard,
  UserDetails,
  ChatDetails,
  PromptEditor,
  ContentModerationSettings,
  PromptEditorPage,
  PromptTemplateManager,
  SystemSettings
};