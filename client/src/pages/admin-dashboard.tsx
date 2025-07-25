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
  ThumbsUp,
  GraduationCap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PromptTemplateManager } from "@/components/admin/PromptTemplateManager";
import { ContentModerationSettings } from "@/components/admin/ContentModerationSettings";
import { SystemSettings } from "@/components/admin/SystemSettings";
import { FeedbackAnalytics } from "@/components/admin/FeedbackAnalytics";
import StudentAgentManager from "@/components/admin/StudentAgentManager";
// 导入管理员界面iPad平台特定修复样式
import "@/components/admin/admin-ipad-fixes.css";
import "../styles/admin-dashboard.css";
import { StudentAgentSimulator } from "@/components/admin/StudentAgentSimulator";

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
  // 使用useState来保存解析后的用户ID
  const [userId, setUserId] = useState<number>(1);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      setLocation("/login");
      return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== "admin") {
      setLocation("/login");
      return;
    }

    // 设置用户ID供API调用使用
    if (user.userId) {
      setUserId(user.userId);
    }

    // 为管理员会话标记特殊属性，避免触发记忆系统
    localStorage.setItem("isAdminSession", "true");

    // 在组件卸载时清理
    return () => {
      if (user.role === "admin") {
        localStorage.removeItem("isAdminSession");
      }
    };
  }, [setLocation]);

  const { data: users } = useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users?userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      const allUsers = await response.json();
      // 只显示普通用户，不显示管理员用户
      return allUsers.filter((user: User) => user.role === "user");
    },
    enabled: userId > 0, // 只在userId有效时执行查询
  });

  // 获取所有聊天统计数据
  const { data: chatStats } = useQuery({
    queryKey: ["/api/chat-stats", userId],
    queryFn: async () => {
      // 通过一个新的端点获取聊天统计信息
      const response = await fetch(`/api/chat-stats?userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch chat statistics");
      return response.json();
    },
    enabled: userId > 0, // 只在userId有效时执行查询
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="flex flex-col w-full bg-black admin-dashboard">
      {/* 整合导航栏和标签列表 - 极简版 */}
      <div className="bg-neutral-900 border-b border-neutral-800 admin-header-container">
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-white">管理员控制台</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-500 hover:text-red-400 flex items-center"
            >
              <LogOut className="h-4 w-4 mr-1" />
              <span>退出</span>
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="admin-tabs admin-tabs-container">
            <TabsList className="bg-neutral-800 w-full">
              <TabsTrigger value="dashboard">控制面板</TabsTrigger>
              <TabsTrigger value="security">安全设置</TabsTrigger>
              <TabsTrigger value="feedback">反馈分析</TabsTrigger>
              <TabsTrigger value="prompts">提示词模板</TabsTrigger>
              <TabsTrigger value="moderation">内容审查</TabsTrigger>
              <TabsTrigger value="student-agent">学生智能体</TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="admin-dashboard-tabs-content overflow-scroll">
              {/* Main Content */}
              <main className="flex-1 py-8">
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
                    <CardDescription>查看所有用户的使用情况 (总计: {users?.length || 0}个普通用户)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="user-list-container" style={{maxHeight: 'none'}}>
                      {users?.map((user: User) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 mb-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-white">{user.username}</p>
                            <p className="text-sm text-neutral-400">
                              ID: {user.id} | 对话数: {user.chatCount || 0} | 角色: {user.role}
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
                  </CardContent>
                </Card>
              </main>
            </TabsContent>

            {/* Prompts Templates Tab */}
            <TabsContent value="prompts" className="admin-dashboard-tabs-content overflow-scroll">
              <div className="flex-1 py-8">
                <div className="w-full px-4 mb-6">
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
            {/* Security Settings Tab */}
            <TabsContent value="security" className="admin-dashboard-tabs-content overflow-scroll">
              <div className="flex-1 py-8">
                <div className="w-full px-4 mb-6">
                  <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                      <div className="flex items-center">
                        <Shield className="h-6 w-6 text-yellow-500 mr-2" />
                        <CardTitle className="text-white">系统安全设置</CardTitle>
                      </div>
                      <CardDescription>
                        控制用户访问权限和系统安全设置，保护系统免受高流量或潜在攻击
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
                <SystemSettings />
              </div>
            </TabsContent>

            {/* 反馈分析标签页 */}
            <TabsContent value="feedback" className="admin-dashboard-tabs-content overflow-scroll">
              <div className="flex-1 py-8">
                <div className="w-full px-4 mb-6">
                  <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                      <div className="flex items-center">
                        <ThumbsUp className="h-6 w-6 text-green-500 mr-2" />
                        <CardTitle className="text-white">用户反馈统计分析</CardTitle>
                      </div>
                      <CardDescription>
                        分析用户对不同AI模型回复的反馈数据，优化AI表现和用户体验
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
                <FeedbackAnalytics />
              </div>
            </TabsContent>

            <TabsContent value="moderation" className="admin-dashboard-tabs-content overflow-scroll">
              <div className="flex-1 py-8">
                <div className="w-full px-4 mb-6">
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

            {/* 学生智能体管理选项卡 */}
            <TabsContent value="student-agent" className="admin-dashboard-tabs-content overflow-scroll">
              <div className="flex-1 py-8">
                {/* 学生智能体模拟器 - 最顶部放置模拟器组件 */}
                <div className="w-full px-4 mb-8">
                  <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                      <div className="flex items-center">
                        <GraduationCap className="h-6 w-6 text-purple-500 mr-2" />
                        <CardTitle className="text-white">学生智能体模拟系统</CardTitle>
                      </div>
                      <CardDescription>
                        创建、测试和评估虚拟学生智能体，以验证和改进教学系统的适应性
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
                
                {/* 学生智能体模拟器组件 */}
                <div className="w-full px-4 mb-8">
                  <StudentAgentSimulator />
                </div>
                
                {/* 学生智能体预设管理组件 */}
                <div className="w-full px-4 mt-8">
                  <Card className="bg-neutral-900 border-neutral-800 mb-4">
                    <CardHeader>
                      <CardTitle className="text-white">学生智能体预设管理</CardTitle>
                      <CardDescription>
                        管理不同特征和学习风格的虚拟学生预设档案
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  
                  <StudentAgentManager userId={userId} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}