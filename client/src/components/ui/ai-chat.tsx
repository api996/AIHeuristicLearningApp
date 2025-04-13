import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChatHistory } from "@/components/chat-history";
import { ChatMessage } from "@/components/chat-message";
import { setupViewportHeightListeners, scrollToBottom, isNearBottom } from "@/lib/viewportUtils";
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
  Pencil,
  X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<Model>("deep");
  const [currentChatId, setCurrentChatId] = useState<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  // 编辑消息相关状态
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | undefined>();
  const [originalContent, setOriginalContent] = useState("");

  // 新增对话框状态
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showLearningPathDialog, setShowLearningPathDialog] = useState(false);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  const [showBackgroundDialog, setShowBackgroundDialog] = useState(false);

  // 偏好设置状态
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light"); // 默认设置为浅色主题以展示苹果风格效果
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");

  // 背景图片相关状态
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

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

  // 处理消息编辑的变异函数
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number | undefined; content: string }) => {
      if (!messageId) throw new Error("消息ID不存在");
      const response = await apiRequest("PATCH", `/api/messages/${messageId}`, { content });
      return response.json();
    },
    onSuccess: () => {
      // 成功编辑消息后刷新当前对话消息列表
      if (currentChatId) {
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${currentChatId}/messages`] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "编辑消息失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 直接定义regenerateMessage函数，不使用useMutation
  const regenerateMessage = async (messageId: number | undefined) => {
    await handleRegenerateMessage(messageId);
  };
  
  // 处理重新生成响应的函数
  const handleRegenerateResponse = (data: any) => {
    if (!data) return;
    
    // 更新对话中的消息
    setMessages(prev => {
      // 找到要更新的消息索引
      const index = prev.findIndex(msg => msg.id === data.id);
      if (index !== -1) {
        // 创建更新后的消息数组
        const newMessages = [...prev];
        newMessages[index] = {
          ...data,
          isRegenerating: false
        };
        return newMessages;
      }
      return prev;
    });
    
    // 如果需要，也可以刷新整个消息列表
    if (currentChatId) {
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${currentChatId}/messages`] });
    }
  };

  // 重写：处理消息重新生成功能 - 增强错误处理和ID查找逻辑
  const handleRegenerateMessage = async (messageId: number | undefined) => {
    try {
      // 开始加载状态，可以添加视觉反馈
      setIsLoading(true);
      console.log("开始重新生成回答，传入ID:", messageId);
      
      let finalMessageId = messageId;
      
      // 如果没有消息ID，尝试获取当前聊天中的最后一条AI消息
      if (!finalMessageId) {
        console.log("无ID传入 - 尝试查找当前会话最后一条AI消息");
        
        if (!currentChatId) {
          console.error("当前对话ID缺失，无法继续");
          throw new Error("无法识别当前对话");
        }

        try {
          // 使用直接fetch而非API请求工具，确保最大兼容性
          const url = `/api/chats/${currentChatId}/messages?userId=${userData.userId}&role=${userData.role}`;
          console.log("API请求URL:", url);
          
          const messagesResponse = await fetch(url);
          if (!messagesResponse.ok) {
            console.error("获取消息列表失败:", messagesResponse.status, messagesResponse.statusText);
            throw new Error("无法获取对话消息");
          }
          
          const messagesData = await messagesResponse.json();
          console.log(`获取到 ${messagesData.length} 条消息`);
          
          // 确保消息数组有效
          if (!Array.isArray(messagesData) || messagesData.length === 0) {
            console.error("没有有效的消息数据");
            throw new Error("对话中没有任何消息");
          }

          // 查找最后一条AI消息
          const assistantMessages = messagesData.filter(msg => msg.role === "assistant");
          console.log(`找到 ${assistantMessages.length} 条AI消息`);
          
          if (assistantMessages.length === 0) {
            throw new Error("没有找到任何AI消息可以重新生成");
          }
          
          // 使用最后一条AI消息
          finalMessageId = assistantMessages[assistantMessages.length - 1].id;
          console.log("将使用最后一条AI消息ID:", finalMessageId);
        } catch (error) {
          console.error("查找AI消息ID失败:", error);
          throw new Error("无法找到可重新生成的消息");
        }
      }
      
      // 添加临时状态表示AI正在思考
      setMessages(prev => {
        // 找到要重新生成的消息的索引
        const index = prev.findIndex(msg => msg.id === finalMessageId);
        if (index !== -1) {
          // 创建新的消息数组，带有"正在重新生成..."标记
          const newMessages = [...prev];
          newMessages[index] = {
            ...newMessages[index],
            content: "正在重新生成回答...",
            isRegenerating: true
          };
          return newMessages;
        }
        return prev;
      });

      // 使用直接fetch发送请求
      const response = await fetch(`/api/messages/${finalMessageId}/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userData.userId,
          userRole: userData.role,
          chatId: currentChatId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "无法读取错误详情");
        console.error(`重生成请求失败: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`服务器错误 (${response.status}): ${errorText || "请稍后再试"}`);
      }
      
      const result = await response.json();
      console.log("重新生成请求成功，结果:", result);
      
      // 更新UI
      if (currentChatId) {
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${currentChatId}/messages`] });
      }
      
      toast({
        title: "重新生成成功",
        description: "AI已完成回答重新生成",
        className: "frosted-toast",
      });
      
    } catch (error) {
      console.error("重新生成消息失败:", error);
      
      toast({
        title: "重新生成失败",
        description: error instanceof Error 
          ? `错误: ${error.message}` 
          : "无法重新生成回答，请稍后再试",
        variant: "destructive",
        className: "frosted-toast-error",
      });
    } finally {
      // 延迟结束加载状态，确保新消息已加载
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  // 处理消息反馈的变异函数
  const feedbackMessageMutation = useMutation({
    mutationFn: async ({ messageId, feedback }: { messageId: number | undefined; feedback: "like" | "dislike" }) => {
      if (!messageId) throw new Error("消息ID不存在");
      const response = await apiRequest("PATCH", `/api/messages/${messageId}/feedback`, { 
        feedback,
        userId: userData.userId,
        userRole: userData.role,
        chatId: currentChatId
      });
      return response.json();
    },
    onSuccess: () => {
      // 成功提交反馈后刷新当前对话消息列表
      if (currentChatId) {
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${currentChatId}/messages`] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "提交反馈失败",
        description: error.message,
        variant: "destructive",
      });
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

    // 如果正在编辑消息，则保存编辑
    if (isEditing && editingMessageId) {
      await saveEditMessage();
      return;
    }

    try {
      // 关闭键盘 - 先将焦点从输入框移开
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }

      // 如果是移动设备，手动触发键盘收起的焦点操作
      if (window.innerWidth <= 768) {
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
          (input as HTMLElement).blur();
        });
      }

      // 立即滚动到底部
      setTimeout(() => scrollTo('bottom'), 10);

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

      // 存储当前的聊天ID
      let chatIdForRequest = currentChatId;

      // 如果不存在聊天ID，创建一个新的聊天
      if (!chatIdForRequest) {
        console.log("创建新聊天...");
        try {
          const chat = await createChatMutation.mutateAsync({
            title: userInput.slice(0, 50), // Use first 50 chars of message as title
            model: currentModel,
          });
          // 确保新创建的聊天ID被正确设置和使用
          chatIdForRequest = chat.id;
          console.log("新聊天创建成功，ID:", chatIdForRequest);
        } catch (chatError) {
          console.error("创建聊天失败:", chatError);
          throw new Error("无法创建新对话，请稍后再试");
        }
      }

      // 添加占位思考消息
      // 注意：我们先添加一个空内容的消息，显示思考动画
      setMessages([...newMessages, { role: "assistant" as const, content: "" }]);

      // 发送给后端 API - 故意延迟300-600ms以显示思考状态
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 300));

      // 确保使用正确的聊天ID发送消息
      console.log("使用聊天ID发送消息:", chatIdForRequest);
      const response = await apiRequest("POST", "/api/chat", {
        message: userInput,
        model: currentModel,
        chatId: chatIdForRequest, // 使用可能新创建的聊天ID
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

      // 保存用户消息到记忆空间
      saveToMemorySpace(userInput, 'user');
      // 保存AI回复到记忆空间
      saveToMemorySpace(aiResponse, 'assistant');
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
    // 如果按下Escape键且正在编辑，则取消编辑
    if (e.key === "Escape" && isEditing) {
      cancelEditMessage();
    }
  };
  
  // 完全重写：处理输入框获得焦点时的滚动行为 - 针对iOS增强处理
  const handleInputFocus = () => {
    // 判断设备类型
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    // 找到最后一条消息并将其滚动到可见区域
    if (messagesContainerRef.current && messages.length > 0) {
      // 首先立即滚动到底部，确保最新消息可见
      scrollToBottom(messagesContainerRef.current, false);
      
      // 添加键盘焦点状态类
      document.documentElement.classList.add('keyboard-focused');
      
      // 特殊处理iOS设备
      if (isIOS) {
        // iOS键盘弹出时的特殊处理
        setTimeout(() => {
          // 为iOS特别优化 - 连续调整滚动位置确保消息可见
          if (messagesContainerRef.current) {
            // iOS上需要更多的时间来调整视口
            const lastMessage = messagesContainerRef.current.lastElementChild;
            if (lastMessage) {
              // 滚动到最后一条消息中心位置
              lastMessage.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'auto'
              });
              
              // iOS上还需要二次调整以解决键盘动画完成后的位置问题
              setTimeout(() => {
                // 在键盘完全弹出后再次调整
                if (messagesContainerRef.current) {
                  const viewportHeight = window.visualViewport?.height || window.innerHeight;
                  // 移除模型选择区域的高度，专注于消息区域
                  const targetPosition = messagesContainerRef.current.scrollHeight - viewportHeight + 150;
                  if (targetPosition > 0) {
                    messagesContainerRef.current.scrollTop = targetPosition;
                  }
                }
              }, 300);
            }
          }
        }, 100);
      } 
      // Android设备的处理 
      else if (isAndroid) {
        setTimeout(() => {
          // 计算键盘弹出后的可视区域，并确保最后几条消息在视野内
          if (messagesContainerRef.current) {
            const lastMessage = messagesContainerRef.current.lastElementChild;
            if (lastMessage) {
              // 使用scrollIntoView确保元素在视野内 - Android上效果较好
              lastMessage.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'auto'
              });
            }
          }
        }, 200);
      }
    }
  };
  
  // 新增：处理输入框失去焦点时的清理工作
  const handleInputBlur = () => {
    // 移除键盘焦点状态标记
    document.documentElement.classList.remove('keyboard-focused');
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(undefined);
    setShowSidebar(false);
  };

  // 开始编辑消息
  const startEditMessage = (messageId: number | undefined, content: string) => {
    setIsEditing(true);
    setEditingMessageId(messageId);
    setOriginalContent(content);
    setInput(content);
  };

  // 取消编辑消息
  const cancelEditMessage = () => {
    setIsEditing(false);
    setEditingMessageId(undefined);
    setInput("");
  };

  // 保存编辑的消息
  const saveEditMessage = async () => {
    if (!editingMessageId || !input.trim()) return;

    try {
      await editMessageMutation.mutateAsync({ 
        messageId: editingMessageId, 
        content: input.trim() 
      });

      toast({
        title: "消息已编辑",
        description: "您的消息已成功更新",
      });

      // 重置编辑状态
      setIsEditing(false);
      setEditingMessageId(undefined);
      setInput("");

    } catch (error) {
      console.error("编辑消息失败:", error);
      toast({
        title: "编辑失败",
        description: "无法保存您的更改，请稍后再试",
        variant: "destructive"
      });
    }
  };

  // 处理消息编辑 (用于传递给ChatMessage组件)
  const handleEditMessage = async (messageId: number | undefined, content: string) => {
    startEditMessage(messageId, content);
  };

  // 重写：处理消息重新生成功能 - 增强错误处理和ID查找逻辑
  const handleRegenerateMessage = async (messageId: number | undefined) => {
    try {
      // 开始加载状态，可以添加视觉反馈
      setIsLoading(true);
      console.log("开始重新生成回答，传入ID:", messageId);
      
      let finalMessageId = messageId;
      
      // 如果没有传入有效的messageId，则查找当前对话的最后一条AI消息
      if (!finalMessageId && currentChatId) {
        console.log("没有传入有效ID，尝试查找最后一条AI消息");
        
        try {
          // 直接使用messages状态中的数据
          if (messages.length > 0) {
            // 反向遍历查找最后一条AI消息
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].role === "assistant" && messages[i].id) {
                finalMessageId = messages[i].id;
                console.log("从当前对话状态找到AI消息ID:", finalMessageId);
                break;
              }
            }
          }
          
          // 如果在当前状态中找不到，尝试从API重新获取
          if (!finalMessageId && currentChatId) {
            const response = await fetch(`/api/chats/${currentChatId}/messages?userId=${userData.userId}&role=${userData.role}`);
            if (!response.ok) {
              throw new Error(`获取消息失败: ${response.status}`);
            }
            
            const messagesData = await response.json();
            console.log(`从API获取到 ${messagesData.length} 条消息`);
            
            if (Array.isArray(messagesData) && messagesData.length > 0) {
              // 查找最后一条AI消息
              for (let i = messagesData.length - 1; i >= 0; i--) {
                if (messagesData[i].role === "assistant" && messagesData[i].id) {
                  finalMessageId = messagesData[i].id;
                  console.log("从API响应找到AI消息ID:", finalMessageId);
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error("查找AI消息ID出错:", error);
          throw new Error("无法找到AI消息");
        }
      }
      
      // 确认是否找到了有效的ID
      if (!finalMessageId) {
        throw new Error("找不到可重新生成的AI消息");
      }
      
      console.log("准备发送重新生成请求，使用ID:", finalMessageId);Id = messageId;
      
      if (!targetMessageId) {
        console.log("尝试查找当前会话的最后一条AI消息...");
        
        // 检查当前聊天ID是否存在
        if (!currentChatId) {
          throw new Error("当前聊天会话不存在");
        }

        // 从API获取当前对话的所有消息（确保有ID字段）
        try {
          const messagesResponse = await fetch(
            `/api/chats/${currentChatId}/messages?userId=${user.userId}&role=${user.role}`
          );
          if (!messagesResponse.ok) {
            throw new Error("无法获取消息列表");
          }
          
          const messagesWithIds = await messagesResponse.json();
          
          // 查找最后一条AI消息
          const allAIMessages = messagesWithIds.filter(
            (msg: any) => msg.role === "assistant"
          );
          
          if (allAIMessages.length > 0) {
            // 使用最后一条AI消息的ID
            const lastAIMessage = allAIMessages[allAIMessages.length - 1];
            targetMessageId = lastAIMessage.id;
            console.log("找到最后一条AI消息，ID:", targetMessageId);
          } else {
            throw new Error("找不到任何AI消息可以重新生成");
          }
        } catch (fetchError) {
          console.error("获取消息列表失败:", fetchError);
          throw new Error("无法加载聊天历史记录");
        }
      }
      
      // 再次确认ID是否存在
      if (!targetMessageId) {
        throw new Error("无法确定要重新生成的消息");
      }

      // 检查当前聊天ID是否存在（冗余检查，以确保安全）
      if (!currentChatId) {
        throw new Error("当前聊天会话不存在");
      }

      // 找到最后一条消息，确保UI状态正确
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        // 如果最后一条不是AI消息，添加一个占位消息以显示思考状态
        if (lastMessage.role !== "assistant") {
          setMessages([...messages, { role: "assistant" as const, content: "" }]);
        } else {
          // 如果最后一条是AI消息，更新其内容为空以显示思考状态
          const updatedMessages = [...messages];
          updatedMessages[updatedMessages.length - 1] = {
            ...updatedMessages[updatedMessages.length - 1],
            content: "",
          };
          setMessages(updatedMessages);
        }
      }

      // 调用重新生成API
      console.log("发送重新生成请求:", targetMessageId);
      const response = await regenerateMessageMutation.mutateAsync(targetMessageId);
      
      // 查询最新消息以确保显示正确
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${currentChatId}/messages`] });

      toast({
        title: "重新生成成功",
        description: "AI已完成回答重新生成",
        className: "frosted-toast", // 使用磨砂玻璃效果
      });
      
    } catch (error) {
      console.error("重新生成消息失败:", error);
      
      // 美化错误提示，使用磨砂玻璃效果
      toast({
        title: "重新生成失败",
        description: error instanceof Error 
          ? `错误: ${error.message}` 
          : "无法重新生成回答，请稍后再试",
        variant: "destructive",
        className: "frosted-toast-error", // 使用磨砂玻璃效果的错误提示
      });
    } finally {
      // 延迟结束加载状态，确保新消息已加载
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  // 处理消息反馈
  const handleMessageFeedback = async (messageId: number | undefined, feedback: "like" | "dislike") => {
    try {
      await feedbackMessageMutation.mutateAsync({ messageId, feedback });
      toast({
        title: feedback === "like" ? "感谢您的好评!" : "感谢您的反馈",
        description: "您的反馈将帮助我们改进系统",
      });
    } catch (error) {
      console.error("提交反馈失败:", error);
    }
  };



  // 应用主题设置到DOM
  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    // 移除所有主题类
    document.documentElement.classList.remove('light', 'dark');

    // 应用新主题
    if (newTheme === "system") {
      // 根据系统偏好设置主题
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add('light');
      }
    } else {
      // 直接应用指定主题
      document.documentElement.classList.add(newTheme);
    }

    // 保存设置到本地存储
    localStorage.setItem('theme', newTheme);
  };

  // 应用字体大小设置
  const applyFontSize = (size: "small" | "medium" | "large") => {
    // 移除所有字体大小类
    document.documentElement.classList.remove('text-sm', 'text-md', 'text-lg');

    // 应用新字体大小
    switch (size) {
      case "small":
        document.documentElement.classList.add('text-sm');
        break;
      case "medium":
        document.documentElement.classList.add('text-md');
        break;
      case "large":
        document.documentElement.classList.add('text-lg');
        break;
    }

    // 保存设置到本地存储
    localStorage.setItem('font-size', size);
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

        // 确保消息加载后滚动到顶部
        setTimeout(() => {
          scrollTo('top');
        }, 100); // 短暂延迟确保DOM更新后再滚动

      } catch (error) {
        console.error("Error loading chat messages:", error);
      } finally {
        setIsLoading(false);
        setShowSidebar(false);
      }
    };

    fetchMessages();
  };

  // 处理消息中图片上传
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

  // 处理背景图片上传
  const handleBackgroundImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Image = await readFileAsBase64(file);

      // 保存到本地存储，这样刷新页面后依然能看到
      localStorage.setItem('background-image', base64Image);

      // 更新状态以立即显示图片
      setBackgroundImage(base64Image);

      toast({
        title: "背景已更新",
        description: "您的自定义背景已成功设置",
      });
    } catch (error) {
      console.error("背景图片上传失败:", error);
      toast({
        title: "上传失败",
        description: "背景图片上传失败，请稍后再试",
        variant: "destructive"
      });
    } finally {
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
      }
    }
  };

  // 自动滚动到消息顶部或底部
  // 使用优化后的滚动函数，包含智能判断是否需要滚动的逻辑
  const scrollTo = (position: 'top' | 'bottom') => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      if (position === 'top') {
        container.scrollTop = 0;
      } else {
        // 使用平滑滚动效果
        scrollToBottom(container, true);
      }
    }
  };

  // 消息更新时根据情况滚动
  useEffect(() => {
    // 如果是新对话或只有一条消息，滚动到顶部
    if (messages.length <= 1) {
      scrollTo('top');
    } else {
      // 否则滚动到底部查看最新消息
      scrollTo('bottom');
    }
  }, [messages]);

  // 设置视口高度监听，确保移动设备上正确计算可视高度
  useEffect(() => {
    // 设置视口高度监听器，解决iOS/移动设备键盘弹出问题
    const cleanup = setupViewportHeightListeners();
    
    // 专门处理键盘弹出状态下的滚动行为
    const handleKeyboardVisibility = () => {
      // 检测键盘是否可见（通过文档根元素的类名）
      const isKeyboardVisible = document.documentElement.classList.contains('keyboard-open');
      
      if (isKeyboardVisible && messagesContainerRef.current) {
        // 当键盘打开时，立即滚动到最新消息，避免黑色区域
        setTimeout(() => {
          // 使用立即滚动(false)而非平滑滚动
          if (messagesContainerRef.current) {
            scrollToBottom(messagesContainerRef.current, false);
          }
        }, 50); // 短暂延迟确保DOM已更新
      }
    };
    
    // 监听可能导致键盘状态变化的事件
    window.visualViewport?.addEventListener('resize', handleKeyboardVisibility);
    window.visualViewport?.addEventListener('scroll', handleKeyboardVisibility);
    
    return () => {
      // 清理所有事件监听器
      window.visualViewport?.removeEventListener('resize', handleKeyboardVisibility);
      window.visualViewport?.removeEventListener('scroll', handleKeyboardVisibility);
      cleanup();
    };
  }, []);
  
  // 检查用户登录状态和初始化偏好设置
  useEffect(() => {
    // 1. 检查用户登录状态
    const userJson = localStorage.getItem("user");
    if (!userJson) {
      setLocation("/login");
      return;
    }

    // 2. 加载用户设置
    // 2.1 初始化主题
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // 默认使用浅色主题
      setTheme("light");
      applyTheme("light");
    }

    // 2.2 初始化字体大小
    const savedFontSize = localStorage.getItem("font-size") as "small" | "medium" | "large" | null;
    if (savedFontSize) {
      setFontSize(savedFontSize);
      applyFontSize(savedFontSize);
    }

    // 2.3 加载背景图片
    const savedBackgroundImage = localStorage.getItem("background-image");
    if (savedBackgroundImage) {
      setBackgroundImage(savedBackgroundImage);
    }

    // 3. 添加系统主题变化监听
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        if (e.matches) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      }
    };

    // 添加监听
    mediaQuery.addEventListener('change', handleThemeChange);

    // 清除监听
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, [setLocation, theme]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };
  
  // 跳转到学习轨迹页面
  const navigateToLearningPath = () => {
    setLocation("/learning-path");
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

  // Placeholder for the memory space saving function.  Replace with your actual implementation.
  const saveToMemorySpace = async (message: string, role: 'user' | 'assistant') => {
    console.log(`Saving message to memory space: Role: ${role}, Message: ${message}`);
    //  Implementation to save message to your vector database here.  Example using a hypothetical API:
    // try {
    //   const response = await fetch('/api/memoryspace', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ message, role })
    //   });
    //   if (!response.ok) {
    //     console.error('Error saving message to memory space:', response.statusText);
    //   }
    // } catch (error) {
    //   console.error('Error saving message to memory space:', error);
    // }
  };


  return (
    <div className="flex h-screen text-white relative" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* 背景图片容器 */}
      {backgroundImage && (
        <div className="bg-container">
          <img src={backgroundImage} alt="背景" className="bg-image" />
        </div>
      )}

      {/* 背景图片上传按钮 */}
      <input
        type="file"
        ref={backgroundInputRef}
        onChange={handleBackgroundImageUpload}
        accept="image/*"
        className="hidden"
        id="background-upload"
      />
      <label 
        htmlFor="background-upload" 
        className="bg-upload-btn"
        title="上传背景图片"
      >
        <ImageIcon className="h-5 w-5 text-white opacity-70" />
      </label>

      {/* 轻微的全局透明效果，不使用磨砂玻璃效果在背景图片上 */}
      <div className="absolute inset-0 z-0 bg-black bg-opacity-20"></div>

      {/* Overlay for mobile */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar - 使用磨砂玻璃效果 */}
      <div
        className={`fixed lg:static lg:flex w-64 h-full transform transition-transform duration-200 ease-in-out z-30 ${
          showSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${theme === 'dark' ? 'frosted-glass-dark' : 'frosted-glass'}`}
      >
        <ChatHistory
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onLogout={handleLogout}
          onNewChat={handleNewChat}
          onChangePassword={() => setShowPasswordDialog(true)}
          onShowProfile={() => setShowProfileDialog(true)}
          onShowLearningPath={() => navigateToLearningPath()}
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
      <div className="flex-1 flex flex-col relative">
        {/* Header - 苹果风格磨砂透明 */}
        <header className={`h-16 flex items-center justify-between px-6 border-b py-4 ${theme === 'dark' ? 'frosted-glass-dark border-neutral-800' : 'frosted-glass border-neutral-200/20'}`}>
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

        {/* 聊天消息容器 - 使用特定的类名便于CSS选择器定位 - 减小底部padding */}
        <div className={"flex-1 flex flex-col p-4 sm:p-6 md:p-8 pb-20 overflow-y-auto chat-message-container " + (messages.length === 0 ? 'hide-empty-scrollbar' : '')}>
          {messages.length === 0 ? (
            // 欢迎页面 - 垂直居中不需要滚动，完全隐藏滚动条
            <div className="flex-1 flex items-center justify-center text-center hide-empty-scrollbar">
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
            // 有消息时显示滚动区域 - 优化滚动体验与空间
            <div 
              ref={messagesContainerRef}
              className="w-full flex-1 flex flex-col gap-4 py-1 overflow-y-auto vh-chat-messages"
              style={{ 
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            >
              {messages.map((msg, i) => (
                <ChatMessage 
                  key={i} 
                  message={msg} 
                  isThinking={isLoading && i === messages.length - 1 && msg.role === "assistant"}
                  onEdit={handleEditMessage}
                  onRegenerate={handleRegenerateMessage}
                  onFeedback={handleMessageFeedback}
                />
              ))}
              {/* 如果正在等待AI响应，且最后一条是用户消息，显示思考中的占位消息 */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <ChatMessage 
                  message={{ role: "assistant", content: "" }} 
                  isThinking={true} 
                />
              )}
            </div>
          )}
        </div>

        {/* Input Area - 添加chat-input-container类便于CSS处理键盘状态 */}
        <div className={"chat-input-area chat-input-container fixed bottom-0 left-0 right-0 pb-4 pt-2 px-2 z-20 " + (theme === 'dark' ? 'frosted-glass-dark' : 'frosted-glass')}>
          <div className="max-w-3xl mx-auto px-2 sm:px-4">
            {/* 模型选择 - 使用更紧凑的布局 */}
            <div className="mb-3 flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                className={"h-8 text-xs bg-neutral-900 hover:bg-neutral-800 " + 
                  (currentModel === "search" ? "border-blue-500" : "border-neutral-700")
                }
                onClick={() => setCurrentModel("search")}
              >
                <Search className="w-3.5 h-3.5 mr-1.5" />
                网络搜索
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={"h-8 text-xs bg-neutral-900 hover:bg-neutral-800 " + 
                  (currentModel === "deep" ? "border-blue-500" : "border-neutral-700")
                }
                onClick={() => setCurrentModel("deep")}
              >
                <Brain className="w-3.5 h-3.5 mr-1.5" />
                深度推理
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={"h-8 text-xs bg-neutral-900 hover:bg-neutral-800 " + 
                  (currentModel === "gemini" ? "border-blue-500" : "border-neutral-700")
                }
                onClick={() => setCurrentModel("gemini")}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Gemini
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={"h-8 text-xs bg-neutral-900 hover:bg-neutral-800 " + 
                  (currentModel === "deepseek" ? "border-blue-500" : "border-neutral-700")
                }
                onClick={() => setCurrentModel("deepseek")}
              >
                <Code className="w-3.5 h-3.5 mr-1.5" />
                Deepseek
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={"h-8 text-xs bg-neutral-900 hover:bg-neutral-800 " + 
                  (currentModel === "grok" ? "border-blue-500" : "border-neutral-700")
                }
                onClick={() => setCurrentModel("grok")}
              >
                <Rocket className="w-3.5 h-3.5 mr-1.5" />
                Grok
              </Button>
            </div>

            {/* 编辑消息状态提示条 */}
            {isEditing && (
              <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 p-2 mb-3 rounded-xl flex items-center justify-between">
                <div className="text-sm text-blue-300 flex items-center">
                  <Pencil className="h-4 w-4 mr-2 text-blue-400" />
                  正在编辑消息
                </div>
                <button
                  onClick={cancelEditMessage}
                  className="h-7 w-7 rounded-full hover:bg-blue-700/30 flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                  </svg>
                </button>
              </div>
            )}

            {/* 输入框区域 - 苹果风格磨砂玻璃效果 */}
            <div className={"relative rounded-xl border shadow-lg " + (theme === 'dark' ? 'border-neutral-700/50 bg-neutral-800/30 backdrop-blur-md' : 'border-neutral-300/20 bg-white/30 backdrop-blur-md')}>
              <div className="flex items-end">
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="输入消息..."
                    disabled={isLoading}
                    className="w-full h-[50px] min-h-[50px] max-h-[150px] py-3 pl-12 pr-3 bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-[16px]"
                    style={{
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      appearance: 'none',
                      WebkitUserSelect: 'text',
                      userSelect: 'text',
                      caretColor: 'white'
                    }}
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
        {/* 减少底部空间，避免大片黑暗区域 */}
        <div className="h-12"></div>
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

          {(() => {
            // 定义API返回的数据类型
            interface LearningPathData {
              topics: Array<{
                topic: string;
                id: string;
                count: number;
                percentage: number;
              }>;
              progress: Array<{
                topic: string;
                percentage: number;
              }>;
              suggestions: string[];
              knowledge_graph?: {
                nodes: Array<{
                  id: string;
                  name: string;
                  type: string;
                  size: number;
                }>;
                links: Array<{
                  source: string;
                  target: string;
                  type: string;
                  strength: number;
                }>;
              }
            }

            // 使用React Query获取学习轨迹数据
            const { isLoading, error, data } = useQuery<LearningPathData>({
              queryKey: ["/api/learning-path", user.userId, user.role],
              queryFn: async () => {
                const response = await fetch(`/api/learning-path?userId=${user.userId}&role=${user.role}`);
                if (!response.ok) {
                  throw new Error("获取学习轨迹数据失败");
                }
                return response.json();
              }
            });

            // 主题颜色映射
            const topicColors: Record<string, string> = {
              "人工智能": "blue",
              "编程开发": "purple",
              "数据科学": "green",
              "计算机科学": "yellow",
              "网络技术": "pink",
              "数学": "orange"
            };

            // 获取主题对应的颜色
            const getTopicColor = (topic: string): string => {
              return topicColors[topic] || "blue";
            };

            if (isLoading) {
              return (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
                  <p className="mt-3 text-neutral-400 text-sm">分析您的学习数据中...</p>
                </div>
              );
            }

            if (error) {
              return (
                <div className="p-6">
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-md">
                    <p className="text-red-400">无法加载学习轨迹数据。请稍后再试。</p>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => setShowLearningPathDialog(false)}>
                      关闭
                    </Button>
                  </DialogFooter>
                </div>
              );
            }

            if (!data || !data.topics || data.topics.length === 0) {
              return (
                <div className="py-8 px-4">
                  <div className="text-center text-neutral-400">
                    <div className="flex justify-center mb-4">
                      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 16V10M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium mb-2">暂无学习数据</h3>
                    <p className="text-sm">
                      开始与AI助手对话，我们将分析您的学习兴趣和进度。聊天越多，分析越准确！
                    </p>
                  </div>
                  <DialogFooter className="mt-8">
                    <Button type="button" variant="outline" onClick={() => setShowLearningPathDialog(false)}>
                      关闭
                    </Button>
                  </DialogFooter>
                </div>
              );
            }

            return (
              <div className="space-y-6 py-4 px-1">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-neutral-200">学习主题</h3>
                  <div className="p-4 bg-neutral-800 rounded-md text-neutral-300 text-sm">
                    根据您的对话内容，以下是您感兴趣的主要学习主题：
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.topics.map((topicItem, index: number) => {
                        const color = getTopicColor(topicItem.topic);
                        // 使用条件类名而不是模板字符串，确保Tailwind正确识别
                        const tagClass = (() => {
                          switch(color) {
                            case 'blue': return 'bg-blue-600/20 border-blue-500/20 text-blue-400';
                            case 'purple': return 'bg-purple-600/20 border-purple-500/20 text-purple-400';
                            case 'green': return 'bg-green-600/20 border-green-500/20 text-green-400';
                            case 'yellow': return 'bg-yellow-600/20 border-yellow-500/20 text-yellow-400';
                            case 'pink': return 'bg-pink-600/20 border-pink-500/20 text-pink-400';
                            case 'orange': return 'bg-orange-600/20 border-orange-500/20 text-orange-400';
                            default: return 'bg-blue-600/20 border-blue-500/20 text-blue-400';
                          }
                        })();

                        return (
                          <div 
                            key={topicItem.id || index}
                            className={`px-2.5 py-1 ${tagClass} border rounded-full text-xs`}
                          >
                            {topicItem.topic}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-neutral-200">学习进度</h3>
                  <div className="p-4 bg-neutral-800 rounded-md">
                    <div className="space-y-3">
                      {data.progress.map((item: { topic: string, percentage: number }, index: number) => {
                        const color = getTopicColor(item.topic);
                        // 使用相同的条件类名方法
                        const progressBarClass = (() => {
                          switch(color) {
                            case 'blue': return 'bg-blue-500';
                            case 'purple': return 'bg-purple-500';
                            case 'green': return 'bg-green-500';
                            case 'yellow': return 'bg-yellow-500';
                            case 'pink': return 'bg-pink-500';
                            case 'orange': return 'bg-orange-500';
                            default: return 'bg-blue-500';
                          }
                        })();

                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-neutral-300">{item.topic}</span>
                              <span className="text-xs text-neutral-400">{item.percentage}%</span>
                            </div>
                            <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${progressBarClass} rounded-full`} 
                                style={{ width: `${item.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-neutral-200">学习建议</h3>
                  <div className="p-4 bg-neutral-800 rounded-md text-neutral-300 text-sm">
                    <p>
                      根据您的对话历史，我们为您提供以下学习建议：
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-neutral-400">
                      {data.suggestions.map((suggestion: string, index: number) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowLearningPathDialog(false)}>
                    关闭
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
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
                  onClick={() => {
                    setTheme("light");
                    applyTheme("light");
                  }}
                  className="flex-1"
                >
                  浅色
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTheme("dark");
                    applyTheme("dark");
                  }}
                  className="flex-1"
                >
                  深色
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTheme("system");
                    applyTheme("system");
                  }}
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
                  onClick={() => {
                    setFontSize("small");
                    applyFontSize("small");
                  }}
                  className="flex-1"
                >
                  小
                </Button>
                <Button
                  variant={fontSize === "medium" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFontSize("medium");
                    applyFontSize("medium");
                  }}
                  className="flex-1"
                >
                  中
                </Button>
                <Button
                  variant={fontSize === "large" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFontSize("large");
                    applyFontSize("large");
                  }}
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
            <Button 
              type="button" 
              onClick={() => {
                // 保存所有偏好设置
                localStorage.setItem('theme', theme);
                localStorage.setItem('font-size', fontSize);

                // 应用设置
                applyTheme(theme);
                applyFontSize(fontSize);

                // 关闭设置对话框
                setShowPreferencesDialog(false);

                toast({
                  title: "设置已保存",
                  description: "您的偏好设置已成功更新",
                });
              }}
            >
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