import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, Settings, LogOut, User, Brain, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatHistoryProps {
  onNewChat?: () => void;
  currentChatId?: number;
  onSelectChat?: (chatId: number) => void;
  setCurrentChatId?: (id: number) => void;
  onDeleteChat?: (id: number) => void;
  onLogout?: () => void;
  chats?: any[];
  user?: { userId: number; role: string; username?: string };
}

export function ChatHistory({ 
  onNewChat, 
  currentChatId, 
  onSelectChat,
  setCurrentChatId,
  onDeleteChat,
  onLogout,
  chats: propsChats,
  user 
}: ChatHistoryProps) {
  // 如果用户不存在或未登录，不渲染任何内容
  if (!user?.userId) {
    console.log('[ChatHistory] No user found, not rendering');
    return null;
  }

  const queryClient = useQueryClient();

  // 使用传入的chats或从API获取
  const { data: apiChats, isLoading } = useQuery({
    queryKey: ['/api/chats', user.userId, user.role],
    queryFn: async () => {
      const response = await fetch(`/api/chats?userId=${user.userId}&role=${user.role}`);
      if (!response.ok) throw new Error('Failed to fetch chats');
      return response.json();
    },
    // 关键：只有在必要时才启用查询
    enabled: Boolean(
      !propsChats && // 没有传入props中的chats
      user.userId && // 用户已登录
      user.role !== 'admin' // 不是管理员用户
    )
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

      {/* 聊天记录列表 */}
      <ScrollArea className="h-[calc(100vh-240px)]">
        <div className="pr-4 p-4 space-y-2">
          {chatsToRender.map((chat: any) => (
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
      
      {/* 用户中心下拉菜单 - 添加到底部 */}
      <div className="mt-auto p-4 border-t border-neutral-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start p-3 text-neutral-300 hover:bg-neutral-800"
            >
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-full mr-3">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">{user.username || '用户'}</span>
                <span className="text-xs text-neutral-500">{user.role === 'admin' ? '管理员' : '用户'}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            side="top"
            sideOffset={10} 
            className="w-[232px] bg-neutral-800 border border-neutral-700 text-white rounded-xl shadow-lg animate-in slide-in-from-bottom-5 fade-in-80"
          >
            <DropdownMenuGroup className="py-1">
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
              >
                <User className="mr-2.5 h-4 w-4 text-blue-400" />
                <span>个人资料</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
              >
                <Settings className="mr-2.5 h-4 w-4 text-green-400" />
                <span>修改密码</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
              >
                <Brain className="mr-2.5 h-4 w-4 text-purple-400" />
                <span>会话记录</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
              >
                <Sparkles className="mr-2.5 h-4 w-4 text-yellow-400" />
                <span>偏好设置</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-neutral-700" />
            <DropdownMenuItem 
              className="cursor-pointer flex items-center text-red-400 hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
              onClick={onLogout}
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}