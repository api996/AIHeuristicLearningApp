import { useEffect } from 'react';
import { useRoutes } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { Background } from '@/components/ui/background';
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import routes from './routes'; // Import your route configuration
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import Home from "@/pages/home";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import UserDetails from "@/pages/user-details";
import ChatDetails from "@/pages/chat-details";
import NotFound from "@/pages/not-found";

// 路由组件
function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users/:id" component={UserDetails} />
      <Route path="/admin/chats/:id" component={ChatDetails} />
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

// 应用主组件
function App() {
  // 在应用启动时清除查询缓存，防止未登录状态下的缓存数据
  queryClient.clear();

  // 从localStorage获取背景图片
  const savedBgImage = localStorage.getItem('background-image');

  return (
    <QueryClientProvider client={queryClient}>
      <Background customImage={savedBgImage || undefined}>
        <Router />
        <Toaster />
      </Background>
    </QueryClientProvider>
  );
}

export default App;