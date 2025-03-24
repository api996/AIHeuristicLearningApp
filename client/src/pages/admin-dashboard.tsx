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
import {
  Users,
  MessageSquare,
  AlertTriangle,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      console.log("未找到用户信息，重定向到登录页");
      setLocation("/login");
      return;
    }

    const user = JSON.parse(userStr);
    console.log("当前用户信息:", user); // 添加日志以便调试

    if (!user || user.role !== "admin") {
      console.log(`非管理员用户(角色: ${user.role})，重定向到登录页`);
      setLocation("/login");
    } else {
      console.log(`确认管理员身份: 用户ID=${user.userId}, 角色=${user.role}`);
    }
  }, [setLocation]);

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/users?userId=${user.userId}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const { data: chats } = useQuery({
    queryKey: ["/api/chats"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/chats?userId=${user.userId}&role=${user.role}`);
      if (!response.ok) throw new Error("Failed to fetch chats");
      return response.json();
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">管理员控制台</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-red-500 hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
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
                  <p className="text-sm text-neutral-400">总用户数</p>
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
                  <p className="text-2xl font-bold text-white">{chats?.length || 0}</p>
                  <p className="text-sm text-neutral-400">总对话数</p>
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
    </div>
  );
}