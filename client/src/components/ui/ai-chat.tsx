import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChatHistory } from "@/components/chat-history";
import { ChatMessage } from "@/components/chat-message";
import { 
  Search, Brain, Sparkles, Code, Rocket,
  Menu, Send, Image
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function AIChat() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const userId = JSON.parse(localStorage.getItem("user") || "{}").id;

  const { data: currentMessages = [] } = useQuery({
    queryKey: ["/api/messages", currentChatId],
    enabled: !!currentChatId
  });

  useEffect(() => {
    if (currentMessages.length > 0) {
      setMessages(currentMessages);
    }
  }, [currentMessages]);

  const createNewChat = async () => {
    try {
      const response = await apiRequest("POST", "/api/chats", {
        userId,
        title: "新对话",
        model: "default"
      });
      const newChat = await response.json();
      setCurrentChatId(newChat.id);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["/api/chats", userId] });
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !currentChatId) return;

    try {
      setIsLoading(true);
      const newMessages = [...messages, { role: "user", content: input }];
      setMessages(newMessages);
      setInput("");

      const response = await apiRequest("POST", "/api/chat", {
        message: input,
        chatId: currentChatId
      });
      const data = await response.json();

      queryClient.invalidateQueries({ queryKey: ["/api/messages", currentChatId] });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (!currentChatId) {
      createNewChat();
    }
  }, []);

  return (
    <div className="flex h-screen text-white">
      {/* Sidebar */}
      <div className={`fixed lg:static lg:flex w-64 h-full bg-neutral-900 transform transition-transform duration-200 ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <ChatHistory
          userId={userId}
          currentChatId={currentChatId || 0}
          onSelectChat={setCurrentChatId}
          onNewChat={createNewChat}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 flex items-center px-4 border-b border-neutral-800">
          <Button 
            variant="ghost" 
            size="icon"
            className="lg:hidden mr-2"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-semibold">我能帮你学习什么？</h1>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-neutral-800">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" className="bg-neutral-900 hover:bg-neutral-800">
                <Search className="w-4 h-4 mr-2" />
                网络搜索
              </Button>
              <Button variant="outline" size="sm" className="bg-neutral-900 hover:bg-neutral-800">
                <Brain className="w-4 h-4 mr-2" />
                深度推理
              </Button>
              <Button variant="outline" size="sm" className="bg-neutral-900 hover:bg-neutral-800">
                <Sparkles className="w-4 h-4 mr-2" />
                Gemini
              </Button>
              <Button variant="outline" size="sm" className="bg-neutral-900 hover:bg-neutral-800">
                <Code className="w-4 h-4 mr-2" />
                Deepseek
              </Button>
              <Button variant="outline" size="sm" className="bg-neutral-900 hover:bg-neutral-800">
                <Rocket className="w-4 h-4 mr-2" />
                Grok
              </Button>
            </div>

            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息..."
                  disabled={isLoading}
                  className="w-full h-[60px] min-h-[60px] max-h-[200px] p-3 bg-neutral-900 border border-neutral-800 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-neutral-700"
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute bottom-2 left-2"
                >
                  <Image className="h-5 w-5" />
                </Button>
              </div>
              <Button 
                onClick={handleSend}
                disabled={isLoading}
                className="h-[60px] px-6"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}