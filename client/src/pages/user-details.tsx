import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Chat {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

interface User {
  id: number; // Added id to User interface
  username: string;
  role: string;
  chatCount: number;
}

export default function UserDetails({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const userId = parseInt(params.id);

  // 验证管理员权限
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      setLocation("/login");
      return;
    }

    const user = JSON.parse(userStr);
    if (!user || user.role !== "admin") {
      setLocation("/login");
    }
  }, [setLocation]);

  // 获取用户信息
  const { data: user } = useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/users?userId=${adminUser.userId}`);
      if (!response.ok) throw new Error("Failed to fetch user");
      const users = await response.json();
      return users.find((u: User) => u.id === userId);
    },
  });

  // 获取用户的聊天记录
  const { data: chats } = useQuery({
    queryKey: ["/api/chats", userId],
    queryFn: async () => {
      const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/chats?userId=${userId}&role=${adminUser.role}`);
      if (!response.ok) throw new Error("Failed to fetch chats");
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin")}
            className="mr-4"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">
              用户详情: {user?.username}
            </h1>
            <p className="text-sm text-neutral-400">
              角色: {user?.role} | 对话数: {user?.chatCount || 0}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">对话历史</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {chats?.map((chat: Chat) => (
                  <div
                    key={chat.id}
                    className="p-4 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/admin/chats/${chat.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-white">{chat.title}</h3>
                      <span className="text-sm text-neutral-400">
                        {new Date(chat.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-300">
                      点击查看对话详情
                    </p>
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