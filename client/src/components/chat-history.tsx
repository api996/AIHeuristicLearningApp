import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ChatHistoryProps {
  onNewChat: () => void;
  currentChatId?: number;
  onSelectChat: (chatId: number) => void;
}

export function ChatHistory({ onNewChat, currentChatId, onSelectChat }: ChatHistoryProps) {
  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const { data: chats, isLoading } = useQuery({
    queryKey: ['/api/chats', user.userId, user.role],
    queryFn: async () => {
      const response = await fetch(`/api/chats?userId=${user.userId}&role=${user.role}`);
      if (!response.ok) throw new Error('Failed to fetch chats');
      return response.json();
    }
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
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  return (
    <div className="w-full flex flex-col h-full">
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="text-center text-neutral-500">加载中...</div>
          ) : !chats || chats.length === 0 ? (
            <div className="text-center text-neutral-500">暂无对话记录</div>
          ) : (
            chats.map((chat: any) => (
              <div
                key={chat.id}
                className={`group flex items-center ${
                  currentChatId === chat.id ? 'bg-neutral-800' : ''
                }`}
              >
                <Button
                  variant="ghost"
                  className="w-full justify-start pr-2"
                  onClick={() => onSelectChat(chat.id)}
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
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';

interface ChatHistoryProps {
  chats: any[];
  currentChatId: number | null;
  setCurrentChatId: (id: number) => void;
  onDeleteChat: (id: number) => void;
  user: { userId: number; role: string };
}

export function ChatHistory({ 
  chats, 
  currentChatId, 
  setCurrentChatId, 
  onDeleteChat,
  user 
}: ChatHistoryProps) {
  const { data: currentChat } = useQuery({
    queryKey: [`/api/chats/${currentChatId}/messages`, user.userId, user.role],
    enabled: !!currentChatId && !!user.userId,
    queryFn: async () => {
      const response = await fetch(`/api/chats/${currentChatId}/messages?userId=${user.userId}&role=${user.role}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
  });

  if (!chats || chats.length === 0) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        暂无聊天记录
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="pr-4">
        {chats.map((chat) => (
          <div key={chat.id} className="mb-1">
            <div
              className={`flex justify-between items-center p-2 rounded-lg cursor-pointer hover:bg-neutral-800 ${
                currentChatId === chat.id ? 'bg-neutral-800' : ''
              }`}
              onClick={() => setCurrentChatId(chat.id)}
            >
              <div className="flex-1 truncate text-sm">
                {chat.title}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-neutral-500 hover:text-neutral-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
