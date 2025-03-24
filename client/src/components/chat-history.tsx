import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ChatHistoryProps {
  onNewChat?: () => void;
  currentChatId?: number;
  onSelectChat?: (chatId: number) => void;
  setCurrentChatId?: (id: number) => void;
  onDeleteChat?: (id: number) => void;
  chats?: any[];
  user?: { userId: number; role: string };
}

export function ChatHistory({ 
  onNewChat, 
  currentChatId, 
  onSelectChat,
  setCurrentChatId,
  onDeleteChat,
  chats: propsChats,
  user 
}: ChatHistoryProps) {
  const queryClient = useQueryClient();

  // 检查用户是否存在且有效
  if (!user || !user.userId) {
    return <div className="p-4 text-center text-neutral-400">请先登录</div>;
  }

  // 使用传入的chats或从API获取
  const { data: apiChats, isLoading } = useQuery({
    queryKey: ['/api/chats', user?.userId, user?.role],
    queryFn: async () => {
      // 确保user存在且userId是有效的数字
      if (!user || !user.userId || isNaN(Number(user.userId))) {
        console.log('用户未登录或ID无效，跳过聊天记录获取');
        return [];
      }

      try {
        const response = await fetch(`/api/chats?userId=${user.userId}&role=${user.role}`);
        if (response.status === 401) {
          console.warn('认证错误:', response.statusText);
          // 可能需要重新登录
          return [];
        }

        if (!response.ok) {
          console.error(`获取聊天记录失败: ${response.statusText}`);
          return [];
        }

        return response.json();
      } catch (error) {
        console.error('聊天记录请求异常:', error);
        return [];
      }
    },
    enabled: !propsChats && !!user && !!user.userId && !isNaN(Number(user.userId)),
    retry: false // 认证失败时不重试
  });

  // 获取当前选中聊天的消息
  const { data: currentChat } = useQuery({
    queryKey: [`/api/chats/${currentChatId}/messages`, user.userId, user.role],
    enabled: !!currentChatId && !!user.userId,
    queryFn: async () => {
      const response = await fetch(`/api/chats/${currentChatId}/messages?userId=${user.userId}&role=${user.role}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: number) => {
      await apiRequest('DELETE', `/api/chats/${chatId}?userId=${user.userId}&role=${user.role}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
  });

  const handleDeleteChat = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatMutation.mutateAsync(chatId);
      if (onDeleteChat) onDeleteChat(chatId);
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  // 确定使用哪个chats数据
  const chatsToRender = propsChats || apiChats;

  if (isLoading && !propsChats) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        加载中...
      </div>
    );
  }

  if (!chatsToRender || chatsToRender.length === 0) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        暂无记录
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full">
      {onNewChat && (
        <div className="p-4 border-b border-neutral-800">
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={onNewChat}
          >
            <Plus className="mr-2 h-4 w-4" />
            新对话
          </Button>
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="pr-4 p-4 space-y-2">
          {chatsToRender.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center ${
                currentChatId === chat.id ? 'bg-neutral-800' : ''
              }`}
            >
              <Button
                variant="ghost"
                className="w-full justify-start pr-2"
                onClick={() => {
                  if (onSelectChat) onSelectChat(chat.id);
                  if (setCurrentChatId) setCurrentChatId(chat.id);
                }}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                <div className="flex flex-col items-start">
                  <span>{chat.title}</span>
                  {user.role === "admin" && chat.username && (
                    <span className="text-xs text-neutral-500">
                      by {chat.username}
                    </span>
                  )}
                </div>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleDeleteChat(chat.id, e)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}