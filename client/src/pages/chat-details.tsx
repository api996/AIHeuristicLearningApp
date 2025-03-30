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
import { ChatMessage } from "@/components/chat-message";

interface Message {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export default function ChatDetails({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const chatId = parseInt(params.id);

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

  // 获取对话消息
  const { data: messages } = useQuery({
    queryKey: [`/api/chats/${chatId}/messages`],
    queryFn: async () => {
      const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/chats/${chatId}/messages?userId=${adminUser.userId}&role=${adminUser.role}`);
      if (!response.ok) throw new Error("Failed to fetch messages");
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
            onClick={() => window.history.back()}
            className="mr-4"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">
            对话详情
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-6">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {messages?.map((message: Message, index: number) => (
                  <div key={index} className="flex flex-col">
                    <ChatMessage message={message} />
                    <span className="text-xs text-neutral-500 mt-1">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
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
