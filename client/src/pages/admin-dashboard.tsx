import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  MessageSquare,
  AlertTriangle,
  LogOut,
  ChevronRight,
  Settings,
  Shield,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PromptTemplateManager } from "@/components/admin/PromptTemplateManager";
import { ContentModerationSettings } from "@/components/admin/ContentModerationSettings";
import { SystemSettings } from "@/components/admin/SystemSettings";

interface ChatStats {
  total: number;
  today: number;
}

interface UserStats {
  total: number;
  active: number;
}

interface User {
  id: number;
  username: string;
  role: string;
  chatCount: number;
  lastActive: string;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      setLocation("/login");
      return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== "admin") {
      setLocation("/login");
    }
  }, [setLocation]);

  const { data: users } = useQuery({
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
  const { data: chatStats } = useQuery({
    queryKey: ["/api/chat-stats"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      // 通过一个新的端点获取聊天统计信息
      const response = await fetch(`/api/chat-stats?userId=${user.userId}`);
      if (!response.ok) throw new Error("Failed to fetch chat statistics");
      return response.json();
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  const [activeTab, setActiveTab] = useState("dashboard");
  
  return (
    <div className="min-h-screen bg-black admin-dashboard">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">管理员控制台</h1>
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-red-500 hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="border-b border-neutral-800 bg-neutral-900">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-neutral-800 mt-2">
              <TabsTrigger value="dashboard">控制面板</TabsTrigger>
              <TabsTrigger value="security">安全设置</TabsTrigger>
              <TabsTrigger value="prompts">提示词模板</TabsTrigger>
              <TabsTrigger value="moderation">内容审查</TabsTrigger>
            </TabsList>
            
            {/* Dashboard Tab */}
            <TabsContent value="dashboard">
              {/* Main Content */}
              <main className="py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Stats Cards */}
                  <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                      <CardTitle className="text-white">用户统计</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Users className="h-8 w-8 text-blue-500" />
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">{users?.length || 0}</p>
                          <p className="text-sm text-neutral-400">普通用户数</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                      <CardTitle className="text-white">对话统计</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <MessageSquare className="h-8 w-8 text-green-500" />
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">{chatStats?.total || 0}</p>
                          <p className="text-sm text-neutral-400">总对话数 / 今日: {chatStats?.today || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                      <CardTitle className="text-white">系统状态</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <AlertTriangle className="h-8 w-8 text-yellow-500" />
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">正常</p>
                          <p className="text-sm text-neutral-400">系统运行状态</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Navigation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  {/* Prompt Editor Card */}
                  <Card className="bg-neutral-900 border-neutral-800 hover:border-blue-500 transition-colors cursor-pointer" onClick={() => setLocation('/admin/prompts')}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white">提示词编辑器</CardTitle>
                        <Settings className="h-6 w-6 text-blue-500" />
                      </div>
                      <CardDescription>使用高级编辑器管理多阶段动态提示词系统</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-neutral-400">通过KWLQ教育模型框架优化AI模型输出，实现更精确的对话控制</p>
                      <Button variant="link" className="text-blue-500 p-0 mt-2 flex items-center">
                        进入编辑器 <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* User List */}
                <Card className="mt-8 bg-neutral-900 border-neutral-800">
                  <CardHeader>
                    <CardTitle className="text-white">用户列表</CardTitle>
                    <CardDescription>查看所有用户的使用情况</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {users?.map((user: User) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-4 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-white">{user.username}</p>
                              <p className="text-sm text-neutral-400">
                                对话数: {user.chatCount || 0} | 角色: {user.role}
                              </p>
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
                  </CardContent>
                </Card>
              </main>
            </TabsContent>
            
            {/* Prompts Templates Tab */}
            <TabsContent value="prompts">
              <div className="py-8">
                <div className="container mx-auto px-4 mb-6">
                  <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white">提示词模板管理</CardTitle>
                        <Button 
                          onClick={() => setLocation('/admin/prompts')} 
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Settings className="h-4 w-4 mr-2" /> 
                          高级提示词编辑器
                        </Button>
                      </div>
                      <CardDescription>在这里可以管理不同AI模型的提示词模板，或使用高级编辑器进行更精细的控制</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
                <PromptTemplateManager />
              </div>
            </TabsContent>
            
            {/* Content Moderation Tab */}
            <TabsContent value="moderation">
              <div className="py-8">
                <div className="container mx-auto px-4 mb-6">
                  <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                      <CardTitle className="text-white">内容审查设置</CardTitle>
                      <CardDescription>
                        配置OpenAI Moderation API用于过滤不当内容，保护用户体验和平台安全
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
                <ContentModerationSettings />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}