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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Chat {
  id: number;
  title: string;
  createdAt: string;
}

interface User {
  id: number;
  username: string;
  role: string;
  chatCount: number;
}

export default function UserDetails({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const userId = parseInt(params.id);

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

  // 获取用户信息
  const { data: user } = useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/users?userId=${adminUser.userId}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      const users = await response.json();
      return users.find((u: User) => u.id === userId);
    },
  });

  // 获取用户聊天记录
  const { data: chats } = useQuery({
    queryKey: ["/api/chats", userId],
    queryFn: async () => {
      const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (adminUser.role !== "admin") {
        throw new Error("Unauthorized");
      }
      const response = await fetch(`/api/chats?userId=${userId}&role=${adminUser.role}`);
      if (!response.ok) throw new Error("Failed to fetch chats");
      return response.json();
    },
  });

  // 删除用户的mutation
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
      await apiRequest("DELETE", `/api/users/${userId}?userId=${adminUser.userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setLocation("/admin");
    },
  });

  const handleDeleteUser = () => {
    deleteUserMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
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
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            删除用户
          </Button>
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除该用户及其所有对话记录。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}