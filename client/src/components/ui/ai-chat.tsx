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
  
  // 新增对话框状态
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showLearningPathDialog, setShowLearningPathDialog] = useState(false);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  
  // 偏好设置状态
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");

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
    
    // 去除前后空白字符
    const trimmedTitle = newTitle.trim();
    
    // 基本验证
    if (!trimmedTitle) {
      setTitleError("标题不能为空");
      return;
    }
    
    // 长度验证
    if (trimmedTitle.length > 30) {
      setTitleError("标题不能超过30个字符");
      return;
    }
    
    // 非常简单的验证 - 检查是否包含控制字符
    if (/[\x00-\x1F\x7F]/.test(trimmedTitle)) {
      setTitleError("标题包含不支持的字符");
      return;
    }

    try {
      await updateTitleMutation.mutateAsync({ 
        chatId: currentChatId!, 
        title: trimmedTitle 
      });
      
      // 更新对话框中的标题内容
      setNewTitle(trimmedTitle);
      
      // 关闭对话框
      setShowTitleDialog(false);
    } catch (error) {
      console.error("修改标题失败:", error);
      setTitleError("保存失败，请稍后再试");
    }
  };


  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    try {
      // 开始加载状态
      setIsLoading(true);
      
      // 添加用户消息
      const userMessage = { role: "user" as const, content: input };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      
      // 保存用户输入内容
      const userInput = input.trim();
      
      // 清空输入框
      setInput("");

      // Create a new chat if none exists
      if (!currentChatId) {
        const chat = await createChatMutation.mutateAsync({
          title: userInput.slice(0, 50), // Use first 50 chars of message as title
          model: currentModel,
        });
      }

      // 添加占位思考消息
      // 注意：我们先添加一个空内容的消息，显示思考动画
      setMessages([...newMessages, { role: "assistant" as const, content: "" }]);
      
      // 发送给后端 API - 故意延迟300-600ms以显示思考状态
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 300));
      
      const response = await apiRequest("POST", "/api/chat", {
        message: userInput,
        model: currentModel,
        chatId: currentChatId,
        userId: user.userId,
        role: user.role,
      });
      const data = await response.json();

      // 获取AI响应内容
      const aiResponse = data.text || "抱歉，我现在无法回答这个问题。";
      
      // 更新现有的思考消息为真实响应
      setMessages(prev => {
        // 复制当前消息数组
        const updatedMessages = [...prev];
        // 最后一条消息应该是我们添加的占位思考消息
        if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role === "assistant") {
          // 用真实响应替换它
          updatedMessages[updatedMessages.length - 1] = {
            role: "assistant" as const,
            content: aiResponse
          };
        }
        return updatedMessages;
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      // 出错时添加错误消息
      setMessages(prev => {
        // 检查最后一条消息是否是我们添加的思考消息
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content) {
          // 如果是，替换为错误消息
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = { 
            role: "assistant" as const, 
            content: "抱歉，发生了一些错误，请稍后再试。" 
          };
          return updatedMessages;
        } else {
          // 否则，添加新的错误消息
          return [
            ...prev,
            { role: "assistant" as const, content: "抱歉，发生了一些错误，请稍后再试。" }
          ];
        }
      });
    } finally {
      // 关闭加载状态
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
          onChangePassword={() => setShowPasswordDialog(true)}
          onShowProfile={() => setShowProfileDialog(true)}
          onShowLearningPath={() => setShowLearningPathDialog(true)}
          onShowPreferences={() => setShowPreferencesDialog(true)}
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

        {/* Messages */}
        <div className={`flex-1 p-6 md:p-8 flex flex-col gap-4 pb-48 ${messages.length > 0 ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="p-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20">
                    <Brain size={28} className="text-blue-400" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white">{greetingMessage}</h3>
                <p className="max-w-md text-sm text-neutral-400">
                  与AI开始交谈，探索不同学习模型
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <ChatMessage 
                  key={i} 
                  message={msg} 
                  isThinking={isLoading && i === messages.length - 1 && msg.role === "assistant"} 
                />
              ))}
              {/* 如果正在等待AI响应，且最后一条是用户消息，显示思考中的占位消息 */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <ChatMessage 
                  message={{ role: "assistant", content: "" }} 
                  isThinking={true} 
                />
              )}
            </>
          )}
        </div>

        {/* Input Area - 简化布局并采用ChatGPT风格，整体上移 */}
        <div className="fixed bottom-0 left-0 right-0 pb-6 pt-2 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent">
          <div className="max-w-3xl mx-auto px-4">
            {/* 模型选择 - 使用更紧凑的布局 */}
            <div className="mb-3 flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                  currentModel === "search" ? "border-blue-500" : "border-neutral-700"
                }`}
                onClick={() => setCurrentModel("search")}
              >
                <Search className="w-3.5 h-3.5 mr-1.5" />
                网络搜索
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                  currentModel === "deep" ? "border-blue-500" : "border-neutral-700"
                }`}
                onClick={() => setCurrentModel("deep")}
              >
                <Brain className="w-3.5 h-3.5 mr-1.5" />
                深度推理
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                  currentModel === "gemini" ? "border-blue-500" : "border-neutral-700"
                }`}
                onClick={() => setCurrentModel("gemini")}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Gemini
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                  currentModel === "deepseek" ? "border-blue-500" : "border-neutral-700"
                }`}
                onClick={() => setCurrentModel("deepseek")}
              >
                <Code className="w-3.5 h-3.5 mr-1.5" />
                Deepseek
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs bg-neutral-900 hover:bg-neutral-800 ${
                  currentModel === "grok" ? "border-blue-500" : "border-neutral-700"
                }`}
                onClick={() => setCurrentModel("grok")}
              >
                <Rocket className="w-3.5 h-3.5 mr-1.5" />
                Grok
              </Button>
            </div>

            {/* 输入框区域 - 使用ChatGPT风格 */}
            <div className="relative rounded-xl border border-neutral-700 bg-neutral-800 shadow-lg">
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
        {/* 添加底部空间，避免内容被固定位置的输入框覆盖 */}
        <div className="h-48"></div>
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
                placeholder="请输入新标题 (最多30字符)"
                maxLength={30}
                className="bg-neutral-800 border-neutral-700"
              />
              <div className="text-xs text-neutral-500 mt-1 text-right">
                {newTitle.length}/30
              </div>
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

      {/* 用户资料对话框 */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>个人资料</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 px-1">
            <div className="flex items-center justify-center mb-6">
              <div className="h-24 w-24 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                {user.username ? user.username.charAt(0).toUpperCase() : "U"}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm text-neutral-400">用户名</Label>
              <div className="p-3 bg-neutral-800 rounded-md text-white">
                {user.username || "未设置用户名"}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm text-neutral-400">角色</Label>
              <div className="p-3 bg-neutral-800 rounded-md text-white">
                {user.role === "admin" ? "管理员" : "普通用户"}
              </div>
            </div>
            <Button 
              onClick={() => {
                setShowProfileDialog(false);
                setShowPasswordDialog(true);
              }}
              className="w-full mt-4"
            >
              修改密码
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 学习轨迹对话框 */}
      <Dialog open={showLearningPathDialog} onOpenChange={setShowLearningPathDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>学习轨迹分析</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4 px-1">
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-neutral-200">学习主题</h3>
              <div className="p-4 bg-neutral-800 rounded-md text-neutral-300 text-sm">
                根据您的对话内容，以下是您感兴趣的主要学习主题：
                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="px-2.5 py-1 bg-blue-600/20 border border-blue-500/20 rounded-full text-blue-400 text-xs">
                    人工智能
                  </div>
                  <div className="px-2.5 py-1 bg-purple-600/20 border border-purple-500/20 rounded-full text-purple-400 text-xs">
                    深度学习
                  </div>
                  <div className="px-2.5 py-1 bg-green-600/20 border border-green-500/20 rounded-full text-green-400 text-xs">
                    计算机科学
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-neutral-200">学习进度</h3>
              <div className="p-4 bg-neutral-800 rounded-md">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-300">人工智能基础</span>
                      <span className="text-xs text-neutral-400">75%</span>
                    </div>
                    <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: "75%" }}></div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-300">机器学习算法</span>
                      <span className="text-xs text-neutral-400">40%</span>
                    </div>
                    <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "40%" }}></div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-300">数据结构</span>
                      <span className="text-xs text-neutral-400">60%</span>
                    </div>
                    <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: "60%" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-neutral-200">学习建议</h3>
              <div className="p-4 bg-neutral-800 rounded-md text-neutral-300 text-sm">
                <p>
                  根据您的对话历史，您对算法和数据结构方面有较强的兴趣，但在机器学习应用上可以进一步加强。建议您可以：
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-neutral-400">
                  <li>深入学习更多机器学习实际应用场景</li>
                  <li>尝试实践一些小型AI项目，巩固理论知识</li>
                  <li>探索更多关于神经网络架构的高级话题</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowLearningPathDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 偏好设置对话框 */}
      <Dialog open={showPreferencesDialog} onOpenChange={setShowPreferencesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>偏好设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-3">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-300">外观</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  className="flex-1"
                >
                  浅色
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  className="flex-1"
                >
                  深色
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                  className="flex-1"
                >
                  跟随系统
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-300">字体大小</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={fontSize === "small" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFontSize("small")}
                  className="flex-1"
                >
                  小
                </Button>
                <Button
                  variant={fontSize === "medium" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFontSize("medium")}
                  className="flex-1"
                >
                  中
                </Button>
                <Button
                  variant={fontSize === "large" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFontSize("large")}
                  className="flex-1"
                >
                  大
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-300">自定义功能 <span className="text-xs text-neutral-500">(即将推出)</span></h3>
              <div className="p-3 bg-neutral-800 rounded-md text-neutral-400 text-sm">
                更多自定义功能将在后续版本推出，敬请期待！
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setShowPreferencesDialog(false)}>
              保存设置
            </Button>
          </DialogFooter>
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