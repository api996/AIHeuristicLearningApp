import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Chat } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ChatHistoryProps {
  userId: number;
  currentChatId: number;
  onSelectChat: (chatId: number) => void;
  onNewChat: () => void;
}

export function ChatHistory({ userId, currentChatId, onSelectChat, onNewChat }: ChatHistoryProps) {
  const { data: chats = [] } = useQuery<Chat[]>({
    queryKey: [`/api/chats/${userId}`],
    enabled: !!userId
  });

  return (
    <div className="w-full flex flex-col h-full">
      <div className="p-4 border-b border-zinc-700">
        <Button 
          className="w-full justify-start bg-zinc-700 hover:bg-zinc-600 text-white" 
          variant="outline" 
          onClick={onNewChat}
        >
          <Plus className="mr-2 h-4 w-4" />
          新对话
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {chats.map((chat) => (
            <Button
              key={chat.id}
              variant={currentChatId === chat.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                currentChatId === chat.id 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "text-zinc-300 hover:bg-zinc-700"
              )}
              onClick={() => onSelectChat(chat.id)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {chat.title || `对话 ${chat.id}`}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}