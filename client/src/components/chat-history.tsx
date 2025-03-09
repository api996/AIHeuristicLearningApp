import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare } from "lucide-react";

interface ChatHistoryProps {
  onNewChat: () => void;
  currentChatId?: string;
  onSelectChat: (chatId: string) => void;
}

export function ChatHistory({ onNewChat, currentChatId, onSelectChat }: ChatHistoryProps) {
  // Mock chat history
  const mockHistory = [
    { id: '1', title: '对话 1' },
    { id: '2', title: '对话 2' },
    { id: '3', title: '对话 3' },
  ];

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
          {mockHistory.map((chat) => (
            <Button
              key={chat.id}
              variant="ghost"
              className={`w-full justify-start ${
                currentChatId === chat.id ? 'bg-neutral-800' : ''
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {chat.title}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}