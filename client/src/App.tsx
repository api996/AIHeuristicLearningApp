import React, { useEffect, useState } from "react";
import { AuthVerifier } from "@/components/auth-verifier";
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
import GraphTest from "@/pages/graph-test";
// 导入统一的主题工具（支持新旧版本切换）
import { ThemeProvider, BackgroundContainer } from "./utils/theme-migration";
// 导入主题加载器，确保主题在生产环境中正确加载
import ThemeLoader from "./lib/theme-loader";
// 导入D3加载修复工具，确保D3.js正确加载
import { ensureD3Loaded } from "./lib/d3-load-fix";
// 导入传统D3补丁文件，作为兼容性后备
import "./lib/d3-patch";
// 导入直接补丁文件，确保_d3Selection全局对象可用
import "./lib/d3-direct-patch";
// 导入视口工具，只使用CSS变量设置功能
import { setupViewportHeightListeners } from "@/lib/viewportUtils";
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
      <Route path="/graph-test" component={GraphTest} />
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // 在应用启动时清除查询缓存，防止未登录状态下的缓存数据
  queryClient.clear();
  
  // 在应用启动时设置视口监听器，仅处理CSS变量，不再检测设备类型
  useEffect(() => {
    // 初始化viewport高度监听器，保留这个功能因为它处理CSS变量
    const cleanup = setupViewportHeightListeners();
    
    // 不再检测设备类型或添加特定设备的类，采用通用响应式布局
    console.log("已启动视口监听器，设置CSS变量");
    
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

  // 初始化应用全局状态
  const [isAppInitialized, setIsAppInitialized] = useState(false);
  
  // 在组件挂载时标记应用已初始化
  useEffect(() => {
    console.log('[App] 开始验证认证状态，当前路径:', window.location.pathname);
    
    // 设置一个短暂停，确保其他组件都已准备好
    const timer = setTimeout(() => {
      console.log('[App] 应用已初始化');
      setIsAppInitialized(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* 添加主题提供者，确保跨页面状态一致性 */}
      <ThemeProvider>
        {/* 添加主题加载器，确保主题变量正确设置 */}
        <ThemeLoader />
        {/* 添加背景容器，实现自定义背景图片 */}
        <BackgroundContainer>
          {isAppInitialized ? (
            // 使用AuthVerifier应用验证器，确保前后端认证状态一致
            <React.Suspense fallback={<div>Loading...</div>}>
              <AuthVerifier>
                <Router />
              </AuthVerifier>
            </React.Suspense>
          ) : <div>初始化应用中...</div>}
          <Toaster />
        </BackgroundContainer>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;