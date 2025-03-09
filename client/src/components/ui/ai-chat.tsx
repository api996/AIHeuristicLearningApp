import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatHistory } from "@/components/chat-history";
import { ChatMessage } from "@/components/chat-message";
import { 
  Search, Brain, Sparkles, Code, Rocket,
  Menu, Send, Image
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Model = "search" | "deep" | "gemini" | "deepseek" | "grok";

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<Model>("deep");
  const [currentChatId, setCurrentChatId] = useState<string>();

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const newMessages = [...messages, { role: "user" as const, content: input }];
      setMessages(newMessages);
      setInput("");

      const response = await apiRequest("POST", "/api/chat", { 
        message: input,
        model: currentModel
      });
      const data = await response.json();

      setMessages([...newMessages, { 
        role: "assistant" as const, 
        content: data.text || "抱歉，我现在无法回答这个问题。"
      }]);
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

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(undefined);
    setShowSidebar(false);
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    // In a real app, we would load the chat history here
    setMessages([
      { role: "user", content: "这是历史对话 " + chatId },
      { role: "assistant", content: "这是历史回复 " + chatId }
    ]);
    setShowSidebar(false);
  };

  return (
    <div className="flex h-screen text-white">
      {/* Overlay for mobile */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed lg:static lg:flex w-64 h-full bg-neutral-900 transform transition-transform duration-200 ease-in-out z-30 ${
          showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <ChatHistory 
          onNewChat={handleNewChat}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
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
            onClick={toggleSidebar}
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
              <Button 
                variant="outline" 
                size="sm" 
                className={`bg-neutral-900 hover:bg-neutral-800 ${currentModel === 'search' ? 'border-blue-500' : ''}`}
                onClick={() => setCurrentModel('search')}
              >
                <Search className="w-4 h-4 mr-2" />
                网络搜索
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className={`bg-neutral-900 hover:bg-neutral-800 ${currentModel === 'deep' ? 'border-blue-500' : ''}`}
                onClick={() => setCurrentModel('deep')}
              >
                <Brain className="w-4 h-4 mr-2" />
                深度推理
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className={`bg-neutral-900 hover:bg-neutral-800 ${currentModel === 'gemini' ? 'border-blue-500' : ''}`}
                onClick={() => setCurrentModel('gemini')}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Gemini
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className={`bg-neutral-900 hover:bg-neutral-800 ${currentModel === 'deepseek' ? 'border-blue-500' : ''}`}
                onClick={() => setCurrentModel('deepseek')}
              >
                <Code className="w-4 h-4 mr-2" />
                Deepseek
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className={`bg-neutral-900 hover:bg-neutral-800 ${currentModel === 'grok' ? 'border-blue-500' : ''}`}
                onClick={() => setCurrentModel('grok')}
              >
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