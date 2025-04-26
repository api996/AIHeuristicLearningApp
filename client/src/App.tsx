import React, { useEffect } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import Home from "@/pages/home";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import UserDetails from "@/pages/user-details";
import ChatDetails from "@/pages/chat-details";
import LearningPath from "@/pages/learning-path";
import MemorySpace from "@/pages/memory-space";
import KnowledgeGraphDetail from "@/pages/knowledge-graph-detail";
import KnowledgeGraphView from "@/pages/knowledge-graph-view";
import MemoryGraph from "@/pages/MemoryGraph";
import PromptEditor from "@/pages/prompt-editor";
import NotFound from "@/pages/not-found";
// 导入D3加载修复工具，确保D3.js正确加载
import { ensureD3Loaded } from "./lib/d3-load-fix";
// 导入传统D3补丁文件，作为兼容性后备
import "./lib/d3-patch";
// 导入直接补丁文件，确保_d3Selection全局对象可用
import "./lib/d3-direct-patch";
// 导入视口工具，检测设备类型并设置CSS变量
import { setupViewportHeightListeners, isIpadDevice } from "@/lib/viewportUtils";
// 导入全局触摸交互优化样式
import "@/components/ui/touch-interaction.css";
// 导入iPad和移动设备相关的修复样式
import "@/components/ui/ipad-fixes.css";
import "@/components/ui/memory-space-fixes.css";
import "@/components/ui/knowledge-graph-fixes.css";
import "@/components/ui/learning-path-fixes.css";
import "@/components/admin/admin-ipad-fixes.css";
// 新增iPhone设备专用修复样式
import "@/components/admin/admin-iphone-fixes.css";
// 导入Dialog弹窗修复样式
import "@/components/ui/dialog-fixes.css";

function Router() {
  // 使用简单的路由配置，让各个组件内部自己处理授权逻辑
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users/:id" component={UserDetails} />
      <Route path="/admin/chats/:id" component={ChatDetails} />
      <Route path="/admin/prompts" component={PromptEditor} />
      <Route path="/learning-path" component={LearningPath} />
      <Route path="/memory-space" component={MemorySpace} />
      <Route path="/memory-graph" component={MemoryGraph} />
      <Route path="/knowledge-graph-detail" component={KnowledgeGraphDetail} />
      <Route path="/knowledge-graph-view/:userId" component={KnowledgeGraphView} />
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // 在应用启动时清除查询缓存，防止未登录状态下的缓存数据
  queryClient.clear();
  
  // 在应用启动时设置视口监听器，检测设备类型并设置相应的CSS类和变量
  useEffect(() => {
    // 初始化设备检测并返回清理函数
    const cleanup = setupViewportHeightListeners();
    
    // 检测iPad设备并添加类
    if (isIpadDevice()) {
      document.documentElement.classList.add('ipad-device');
      console.log("检测到iPad设备，已应用专用样式优化");
    }
    
    console.log("已启动全局视口监听器，进行设备识别和CSS优化");
    
    // 确保D3.js加载
    ensureD3Loaded().then((success: boolean) => {
      if (success) {
        console.log("D3.js库已成功加载和初始化");
      } else {
        console.warn("D3.js加载失败，某些可视化功能可能不可用");
      }
    });
    
    // 组件卸载时清理
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;