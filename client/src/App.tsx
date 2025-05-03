import React, { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
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
// 导入认证状态验证工具
import { ensureAuthConsistency, getLocalUser } from "./lib/authVerifier";
// 导入UI组件
import { Loader2 } from "lucide-react";
// 导入useToast钩子
import { useToast } from "@/hooks/use-toast";

// 创建认证上下文
// 用于在全局范围内管理和共享认证状态
type AuthContextType = {
  user: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false
});

// 使用上下文Hook
export const useAuth = () => React.useContext(AuthContext);

function Router() {
  // 获取认证状态
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // 不是登录页且还在加载认证状态时显示加载器
  if (isLoading && !location.includes('/login')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-foreground text-lg">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

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
  // 认证状态
  const [user, setUser] = useState<any | null>(getLocalUser());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // 在应用启动时清除查询缓存，防止未登录状态下的缓存数据
  queryClient.clear();
  
  // 验证认证状态
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        console.log(`[App] 开始验证认证状态，当前路径: ${location}`);
        
        // 检查是否在登录页
        const isLoginPage = location === '/login';
        if (isLoginPage) {
          console.log('[App] 当前在登录页面，跳过认证检查');
          setIsLoading(false);
          return;
        }
        
        // 验证前后端认证状态一致性
        console.log('[App] 开始调用ensureAuthConsistency检查前后端会话状态');
        const verifiedUser = await ensureAuthConsistency();
        
        // 如果验证失败且不在登录页，重定向到登录页
        if (!verifiedUser && !isLoginPage) {
          console.log('[App] 验证失败，用户未登录或会话已过期');
          toast({
            title: "需要登录",
            description: "您的登录状态已失效或不存在，请重新登录",
            variant: "destructive"
          });
          // 清除本地存储的任何用户数据
          localStorage.removeItem('user');
          console.log('[App] 重定向到登录页面');
          setLocation('/login');
        } else if (verifiedUser) {
          console.log(`[App] 验证成功，用户ID: ${verifiedUser.id}, 角色: ${verifiedUser.role}`);
        }
        
        setUser(verifiedUser);
      } catch (error) {
        console.error('[App] 验证认证状态时出错:', error);
        // 发生错误时，清除用户状态并重定向到登录页
        setUser(null);
        localStorage.removeItem('user'); // 清除本地存储的用户数据
        
        if (location !== '/login') {
          console.log('[App] 验证出错，重定向到登录页面');
          setLocation('/login');
        }
      } finally {
        console.log('[App] 认证验证过程完成');
        setIsLoading(false);
      }
    };
    
    verifyAuth();
  }, [location, toast, setLocation]);
  
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

  // 计算是否已认证
  const isAuthenticated = !!user;

  // 提供认证上下文值
  const authContextValue = {
    user,
    isLoading,
    isAuthenticated
  };

  return (
    <QueryClientProvider client={queryClient}>
      {/* 添加认证上下文提供者 */}
      <AuthContext.Provider value={authContextValue}>
        {/* 添加主题提供者，确保跨页面状态一致性 */}
        <ThemeProvider>
          {/* 添加主题加载器，确保主题变量正确设置 */}
          <ThemeLoader />
          {/* 添加背景容器，实现自定义背景图片 */}
          <BackgroundContainer>
            <Router />
            <Toaster />
          </BackgroundContainer>
        </ThemeProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export default App;