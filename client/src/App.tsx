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
import PromptEditor from "@/pages/prompt-editor";
import NotFound from "@/pages/not-found";
// 导入D3补丁文件，修复D3兼容性问题
import "./lib/d3-patch";
// 导入直接补丁文件，确保_d3Selection全局对象可用
import "./lib/d3-direct-patch";

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
      <Route path="/knowledge-graph-detail" component={KnowledgeGraphDetail} />
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // 在应用启动时清除查询缓存，防止未登录状态下的缓存数据
  queryClient.clear();

  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;