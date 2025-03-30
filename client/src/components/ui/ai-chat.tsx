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
  Edit,
  User,
  ChevronDown,
  MessageSquare,
  Pencil
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface AIChatProps {
  userData: any;
}

export function AIChat({ userData }: AIChatProps) {
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

  // Use the passed in userData
  const user = userData;

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
      const response = await apiRequest("PUT", `/api/chats/${data.chatId}/title?userId=${user.userId}&role=${user.role}`, { title: data.title });
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

    try {
      await updateTitleMutation.mutateAsync({ chatId: currentChatId!, title: newTitle });
    } catch (error) {
      console.error("修改标题失败:", error);
    }
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

  // 添加事件监听器，处理从侧边栏点击"修改密码"按钮
  useEffect(() => {
    // 监听打开密码修改对话框的事件
    const handleOpenPasswordDialog = () => {
      setShowPasswordDialog(true);
    };
    
    window.addEventListener('open-password-dialog', handleOpenPasswordDialog);
    
    return () => {
      window.removeEventListener('open-password-dialog', handleOpenPasswordDialog);
    };
  }, []);

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

  const greetingMessage = "你好！准备开始一段富有启发性的对话了吗？";


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
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onLogout={handleLogout}
          onNewChat={handleNewChat}
          onDeleteChat={(id) => {
            if (id === currentChatId) {
              setCurrentChatId(undefined);
            }
          }}
          setCurrentChatId={setCurrentChatId}
          user={user}
          chats={chatsToRender} // Pass chatsToRender to ChatHistory
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header - 按照主流AI聊天助手设计 */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-neutral-800 py-4 bg-neutral-900">
          <div className="flex items-center">
            {/* 左侧菜单按钮 - 显示历史记录 */}
            <Button
              variant="ghost"
              size="icon"
              className="mr-4 hover:bg-neutral-800 rounded-lg h-12 w-12"
              onClick={toggleSidebar}
              aria-label="显示侧边栏"
            >
              <Menu className="h-7 w-7 text-neutral-300" />
            </Button>

            {/* 当前对话标题 */}
            {currentChatId ? (
              <div className="flex items-center">
                <h1 className="text-lg font-medium text-neutral-200 mr-2 truncate max-w-[180px] sm:max-w-[320px] md:max-w-[400px]">{currentChat?.title}</h1>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowTitleDialog(true)}
                  className="h-8 w-8 rounded-full hover:bg-neutral-800"
                >
                  <Edit className="h-4 w-4 text-neutral-400" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-lg mr-2.5">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-white">启发式对话导师</h1>
              </div>
            )}
          </div>

          {/* 右侧功能区 - 只保留新对话按钮，改为ChatGPT风格 */}
          <div className="flex items-center">
            {/* 新对话按钮 - 使用ChatGPT风格 */}
            <Button 
              variant="outline" 
              onClick={handleNewChat}
              className="h-12 px-6 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700 flex items-center transition-colors"
              title="新对话"
            >
              <Plus className="h-6 w-6 mr-2" />
              <span>新对话</span>
            </Button>
          </div>
        </header>

        {/* Messages - 减少垂直方向的空间 */}
        <div className="flex-1 p-3 md:p-4 overflow-y-auto flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center pb-16">
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="p-4 rounded-full bg-primary-foreground/10">
                    <Brain size={20} />
                  </div>
                </div>
                <h3 className="text-lg font-semibold">{greetingMessage}</h3>
                <p className="max-w-md text-sm text-neutral-400">
                  与AI开始交谈，探索不同学习模型
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))
          )}
        </div>

        {/* Input Area - 简化布局并采用ChatGPT风格 */}
        <div className="p-3 border-t border-neutral-800 mt-auto"> 
          {/* 模型选择 - 使用更紧凑的布局 */}
          <div className="mb-2 flex flex-wrap gap-1.5 justify-center">
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "search" ? "border-blue-500" : "border-neutral-700"
              }`}
              onClick={() => setCurrentModel("search")}
            >
              <Search className="w-3 h-3 mr-1" />
              网络搜索
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "deep" ? "border-blue-500" : "border-neutral-700"
              }`}
              onClick={() => setCurrentModel("deep")}
            >
              <Brain className="w-3 h-3 mr-1" />
              深度推理
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "gemini" ? "border-blue-500" : "border-neutral-700"
              }`}
              onClick={() => setCurrentModel("gemini")}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Gemini
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "deepseek" ? "border-blue-500" : "border-neutral-700"
              }`}
              onClick={() => setCurrentModel("deepseek")}
            >
              <Code className="w-3 h-3 mr-1" />
              Deepseek
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                currentModel === "grok" ? "border-blue-500" : "border-neutral-700"
              }`}
              onClick={() => setCurrentModel("grok")}
            >
              <Rocket className="w-3 h-3 mr-1" />
              Grok
            </Button>
          </div>

          {/* 输入框区域 - 使用ChatGPT风格 */}
          <div className="relative max-w-3xl mx-auto rounded-xl border border-neutral-700 bg-neutral-800 shadow-lg">
            <div className="flex items-end">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息..."
                  disabled={isLoading}
                  className="w-full h-[50px] min-h-[50px] max-h-[200px] py-3 pl-12 pr-3 bg-transparent border-0 resize-none focus:outline-none focus:ring-0"
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
                  className="absolute bottom-1.5 left-2 h-8 w-8 rounded-full hover:bg-neutral-700"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-5 w-5 text-neutral-400" />
                </Button>
              </div>
              <Button
                onClick={handleSend}
                disabled={isLoading}
                className="h-10 w-10 mr-2 mb-1.5 rounded-full"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="text-center mt-2 text-xs text-neutral-500">
            启发式对话导师 - 使用先进AI模型，由专家团队精心训练
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