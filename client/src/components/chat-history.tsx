import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare } from "lucide-react";

export function ChatHistory() {
  return (
    <div className="w-full flex flex-col h-full">
      <div className="p-4 border-b border-neutral-800">
        <Button className="w-full justify-start" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          新对话
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {/* Mock chat history items */}
          {[1,2,3].map((i) => (
            <Button
              key={i}
              variant="ghost"
              className="w-full justify-start"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              对话 {i}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
