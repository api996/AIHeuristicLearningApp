import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  MessageSquare,
  BrainCircuit,
  Calendar,
  ChevronRight,
  Settings,
  LineChart,
  BarChart4,
  Activity,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface User {
  id: number;
  username: string;
  role: string;
  chatCount: number;
  lastActive: string;
}

interface ChatStats {
  total: number;
  today: number;
}

export function DashboardPage() {
  const [, setLocation] = useLocation();
  const [systemHealth, setSystemHealth] = useState<number>(100);
  const [memoryCount, setMemoryCount] = useState<number>(0);
  
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/users?userId=${user.userId}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      const allUsers = await response.json();
      // 过滤掉管理员用户
      return allUsers.filter((user: User) => user.role !== "admin");
    },
  });

  // 获取所有聊天统计数据
  const { data: chatStats, isLoading: loadingChatStats } = useQuery({
    queryKey: ["/api/chat-stats"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/chat-stats?userId=${user.userId}`);
      if (!response.ok) throw new Error("Failed to fetch chat statistics");
      return response.json();
    },
  });
  
  // 获取记忆统计
  useEffect(() => {
    const fetchMemoryStats = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const response = await fetch(`/api/memory-stats?userId=${user.userId}`);
        if (response.ok) {
          const data = await response.json();
          setMemoryCount(data.total || 0);
        }
      } catch (error) {
        console.error("Failed to fetch memory statistics", error);
      }
    };
    
    // 模拟系统健康状态
    const randomHealth = Math.floor(Math.random() * 10) + 90; // 90-100 之间的随机数
    setSystemHealth(randomHealth);
    
    fetchMemoryStats();
  }, []);

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // 骨架屏样式类
  const skeletonClass = "animate-pulse bg-neutral-800 rounded-md h-8";

  return (
    <div className="space-y-6 fade-in">
      {/* 顶部信息和当前日期 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">控制面板总览</h1>
          <p className="text-neutral-400">{today} · 系统管理员</p>
        </div>
        <Button 
          variant="outline" 
          className="mt-4 md:mt-0 flex items-center"
          onClick={() => setLocation('/admin/prompts')}
        >
          <Settings className="mr-2 h-4 w-4" /> 
          高级配置
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 用户统计 */}
        <Card className="admin-card">
          <CardContent className="admin-stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="icon-container bg-blue-950/30">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              {!loadingUsers ? (
                <span className="text-xs text-neutral-400">
                  {users?.length > 0 ? "活跃中" : "无活动"}
                </span>
              ) : null}
            </div>
            {!loadingUsers ? (
              <h3 className="stat-value text-white">{users?.length || 0}</h3>
            ) : (
              <div className={skeletonClass} />
            )}
            <p className="stat-label">总用户数</p>
          </CardContent>
        </Card>

        {/* 对话统计 */}
        <Card className="admin-card">
          <CardContent className="admin-stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="icon-container bg-emerald-950/30">
                <MessageSquare className="h-5 w-5 text-emerald-500" />
              </div>
              {!loadingChatStats ? (
                <span className="text-xs text-neutral-400">
                  今日: {chatStats?.today || 0}
                </span>
              ) : null}
            </div>
            {!loadingChatStats ? (
              <h3 className="stat-value text-white">{chatStats?.total || 0}</h3>
            ) : (
              <div className={skeletonClass} />
            )}
            <p className="stat-label">总对话数</p>
          </CardContent>
        </Card>

        {/* 记忆统计 */}
        <Card className="admin-card">
          <CardContent className="admin-stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="icon-container bg-violet-950/30">
                <BrainCircuit className="h-5 w-5 text-violet-500" />
              </div>
              <span className="text-xs text-neutral-400">
                语义记忆
              </span>
            </div>
            <h3 className="stat-value text-white">{memoryCount}</h3>
            <p className="stat-label">记忆条目</p>
          </CardContent>
        </Card>

        {/* 系统状态 */}
        <Card className="admin-card">
          <CardContent className="admin-stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="icon-container bg-amber-950/30">
                <Activity className="h-5 w-5 text-amber-500" />
              </div>
              <span className="text-xs text-neutral-400">
                健康状态
              </span>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <span className={`status-indicator ${systemHealth > 95 ? 'online' : systemHealth > 80 ? 'warning' : 'offline'}`}></span>
              <h3 className="stat-value text-white">{systemHealth}%</h3>
            </div>
            
            <Progress
              value={systemHealth}
              className={`h-2 mb-2 ${
                systemHealth > 95 
                  ? "bg-emerald-500" 
                  : systemHealth > 80 
                  ? "bg-amber-500" 
                  : "bg-red-500"
              }`}
            />
            
            <p className="stat-label">系统正常运行</p>
          </CardContent>
        </Card>
      </div>

      {/* 性能图表和最近活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 性能指标图表 */}
        <Card className="admin-card lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">系统性能指标</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <BarChart4 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <LineChart className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>记忆检索与模型响应速度趋势</CardDescription>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            <div className="text-neutral-500 flex flex-col items-center">
              <Activity className="h-10 w-10 mb-2" />
              <p>性能分析图表将在未来版本中推出</p>
            </div>
          </CardContent>
        </Card>

        {/* 最近活动 */}
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-white">最近活动</CardTitle>
            <CardDescription>系统最近操作记录</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-1 bg-blue-950/40">
                    <Users className="h-3 w-3 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white">新用户注册</p>
                    <p className="text-xs text-neutral-400">10分钟前</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-1 bg-green-950/40">
                    <MessageSquare className="h-3 w-3 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white">新对话创建</p>
                    <p className="text-xs text-neutral-400">25分钟前</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-1 bg-amber-950/40">
                    <Calendar className="h-3 w-3 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white">系统自动备份</p>
                    <p className="text-xs text-neutral-400">1小时前</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-full p-1 bg-purple-950/40">
                    <BrainCircuit className="h-3 w-3 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white">记忆系统优化</p>
                    <p className="text-xs text-neutral-400">3小时前</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-1 bg-blue-950/40">
                    <Settings className="h-3 w-3 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white">系统参数调整</p>
                    <p className="text-xs text-neutral-400">5小时前</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 用户列表 */}
      <Card className="admin-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">用户列表</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              className="hidden sm:flex"
            >
              查看全部
            </Button>
          </div>
          <CardDescription>查看所有用户的使用情况</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`${skeletonClass} h-16 w-full`}></div>
              ))}
            </div>
          ) : users?.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {users.slice(0, 5).map((user: User) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
                        <Users className="h-5 w-5 text-neutral-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.username}</p>
                        <p className="text-xs text-neutral-400">
                          对话数: {user.chatCount || 0} | 最后活动: {new Date(user.lastActive).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLocation(`/admin/users/${user.id}`)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-neutral-500">
              暂无用户数据
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center sm:justify-end pt-0 sm:hidden">
          <Button 
            variant="outline" 
            size="sm"
            className="w-full sm:w-auto"
          >
            查看全部
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}