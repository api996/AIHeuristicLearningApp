import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChatHistory } from "@/components/chat-history";
import { ChatMessage } from "@/components/chat-message";
import { useLocation } from "wouter";
import {
  Search,
  Brain,
  Sparkles,
  Code,
  Rocket,
  Menu,
  Send,
  Image as ImageIcon,
  Plus,
  LogOut,
  Settings,
  Edit
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Model = "search" | "deep" | "gemini" | "deepseek" | "grok";

interface UploadResponse {
  url: string;
}

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function AIChat() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<Model>("deep");
  const [currentChatId, setCurrentChatId] = useState<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // 修改标题相关状态
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [titleError, setTitleError] = useState("");

  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Update the query to include user context
  const { data: currentChat } = useQuery({
    queryKey: [`/api/chats/${currentChatId}/messages`, user.userId, user.role],
    queryFn: async () => {
      const response = await fetch(`/api/chats/${currentChatId}/messages?userId=${user.userId}&role=${user.role}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!currentChatId && !!user.userId,
  });

  const createChatMutation = useMutation({
    mutationFn: async (data: { title: string; model: string }) => {
      const response = await apiRequest("POST", "/api/chats", {
        ...data,
        userId: user.userId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setCurrentChatId(data.id);
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async (data: { chatId: number; title: string }) => {
      const response = await apiRequest("PUT", `/api/chats/${data.chatId}`, { title: data.title });
      return response.json();
    },
    onSuccess: () => {
      setShowTitleDialog(false);
      setNewTitle("");
      setTitleError("");
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
    onError: (error: Error) => {
      setTitleError(error.message);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { userId: number; currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/change-password", data);
      return response.json();
    },
    onSuccess: () => {
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordError("");
    },
    onError: (error: Error) => {
      setPasswordError(error.message);
    },
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    try {
      await changePasswordMutation.mutateAsync({
        userId: user.userId,
        currentPassword,
        newPassword,
      });
    } catch (error) {
      console.error("Failed to change password:", error);
    }
  };

  const handleTitleChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTitleError("");
    if (!newTitle.trim()) {
      setTitleError("标题不能为空");
      return;
    }
    await updateTitleMutation.mutateAsync({ chatId: currentChatId!, title: newTitle });
  };


  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const newMessages = [...messages, { role: "user" as const, content: input }];
      setMessages(newMessages);
      setInput("");

      // Create a new chat if none exists
      if (!currentChatId) {
        const chat = await createChatMutation.mutateAsync({
          title: input.slice(0, 50), // Use first 50 chars of message as title
          model: currentModel,
        });
      }

      const response = await apiRequest("POST", "/api/chat", {
        message: input,
        model: currentModel,
        chatId: currentChatId,
        userId: user.userId,
        role: user.role,
      });
      const data = await response.json();

      setMessages([
        ...newMessages,
        {
          role: "assistant" as const,
          content: data.text || "抱歉，我现在无法回答这个问题。",
        },
      ]);
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

  // Update handleSelectChat to properly load messages
  const handleSelectChat = (chatId: number) => {
    setCurrentChatId(chatId);

    // 通过API加载聊天消息
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/chats/${chatId}/messages?userId=${user.userId}&role=${user.role}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }
        const messagesData = await response.json();

        // 转换消息格式并更新状态
        const formattedMessages = messagesData.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }));

        setMessages(formattedMessages);
      } catch (error) {
        console.error("Error loading chat messages:", error);
      } finally {
        setIsLoading(false);
        setShowSidebar(false);
      }
    };

    fetchMessages();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const base64Image = await readFileAsBase64(file);

      const response = await apiRequest("POST", "/api/upload", { image: base64Image });
      const data: UploadResponse = await response.json();

      // Add image to messages
      setMessages([...messages, {
        role: "user",
        content: `![Uploaded Image](${data.url})`
      }]);
    } catch (error) {
      console.error("Failed to upload image:", error);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      setLocation("/login");
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  // 获取聊天记录
  const { data: apiChats, isLoading: apiChatsLoading } = useQuery({
    queryKey: ['/api/chats', user.userId, user.role],
    queryFn: async () => {
      const response = await fetch(`/api/chats?userId=${user.userId}&role=${user.role}`);
      if (!response.ok) throw new Error('Failed to fetch chats');
      return response.json();
    },
  });

  // 用于在界面上显示的聊天列表
  const chatsToRender = apiChats;


  return (
    <div className="flex h-screen text-white">
      {/* Overlay for mobile */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static lg:flex w-64 h-full bg-neutral-900 transform transition-transform duration-200 ease-in-out z-30 ${
          showSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <ChatHistory
          onNewChat={handleNewChat}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          user={user}
          chats={chatsToRender} // Pass chatsToRender to ChatHistory
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-neutral-800">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden mr-2"
              onClick={toggleSidebar}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center">
              {currentChatId && (
                <>
                  <h1 className="text-xl font-semibold mr-2">{currentChat?.title}</h1>
                  <Button variant="ghost" size="icon" onClick={() => setShowTitleDialog(true)}>
                    <Edit className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPasswordDialog(true)}
              className="text-neutral-400 hover:text-white"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-red-500 hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
        </div>

        {/* Model Selection and Input Area */}
        <div className="p-4 border-t border-neutral-800">
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              className={`bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "search" ? "border-blue-500" : ""
              }`}
              onClick={() => setCurrentModel("search")}
            >
              <Search className="w-4 h-4 mr-2" />
              网络搜索
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "deep" ? "border-blue-500" : ""
              }`}
              onClick={() => setCurrentModel("deep")}
            >
              <Brain className="w-4 h-4 mr-2" />
              深度推理
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "gemini" ? "border-blue-500" : ""
              }`}
              onClick={() => setCurrentModel("gemini")}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Gemini
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "deepseek" ? "border-blue-500" : ""
              }`}
              onClick={() => setCurrentModel("deepseek")}
            >
              <Code className="w-4 h-4 mr-2" />
              Deepseek
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "grok" ? "border-blue-500" : ""
              }`}
              onClick={() => setCurrentModel("grok")}
            >
              <Rocket className="w-4 h-4 mr-2" />
              Grok
            </Button>
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-neutral-800">
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
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-2 left-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-5 w-5" />
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

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">当前密码</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">新密码</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700"
              />
            </div>
            {passwordError && (
              <div className="text-red-500 text-sm">{passwordError}</div>
            )}
            <Button type="submit" className="w-full">
              确认修改
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 修改标题对话框 */}
      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改对话标题</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTitleChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-title">新标题</Label>
              <Input
                id="new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="请输入新标题"
              />
              {titleError && <p className="text-sm text-red-500">{titleError}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateTitleMutation.isPending}>
                {updateTitleMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {apiChatsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-400">加载中...</p>
        </div>
      ) : null}
    </div>
  );
}