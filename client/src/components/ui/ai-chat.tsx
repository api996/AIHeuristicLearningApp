import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "./card";
import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Badge } from "./badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Loader2, Send, RotateCcw, ThumbsUp, ThumbsDown, Pencil, CheckCircle, Bot } from "lucide-react";
import { marked } from "marked";
import { Toast } from "./toast";
import { useToast } from "../../hooks/use-toast";

interface AIResponse {
  text: string;
  model?: string;
}

interface AIChatProps {
  userId?: number;
  userRole?: string;
  onClose?: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}

interface Message {
  id?: number;
  chatId?: number;
  content: string;
  role: string;
  createdAt?: string;
  feedback?: string | null;
}

interface Chat {
  id: number;
  title: string;
  userId: number;
  createdAt: string;
  model?: string;
}

const AIChat: React.FC<AIChatProps> = ({ 
  userId, 
  userRole = "user",
  onClose,
  selectedModel,
  onModelChange
}) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<{[key: number]: boolean}>({});
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingMessage, setEditingMessage] = useState<{id: number, content: string} | null>(null);
  const [assistantMessageId, setAssistantMessageId] = useState<number | null>(null);
  const [model, setModel] = useState(selectedModel || "deep");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // 自动滚动到底部
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 获取聊天历史
  useEffect(() => {
    if (userId) {
      fetchChats();
    }
  }, [userId]);

  // 当聊天ID改变时，获取消息
  useEffect(() => {
    if (currentChatId) {
      fetchMessages(currentChatId);
    } else {
      setMessages([]);
    }
  }, [currentChatId]);

  // 同步模型选择
  useEffect(() => {
    if (selectedModel && selectedModel !== model) {
      setModel(selectedModel);
    }
  }, [selectedModel]);

  const fetchChats = async () => {
    try {
      setLoadingChats(true);
      const response = await fetch(`/api/chats?userId=${userId}&role=${userRole}`);
      if (!response.ok) {
        throw new Error("Failed to fetch chats");
      }
      const data = await response.json();
      setChats(data);

      // 如果有聊天，选择最新的一个
      if (data.length > 0) {
        setCurrentChatId(data[0].id);
      }

      setLoadingChats(false);
    } catch (error) {
      console.error("Error fetching chats:", error);
      setLoadingChats(false);
    }
  };

  const fetchMessages = async (chatId: number) => {
    try {
      setMessages([]);
      const response = await fetch(`/api/chats/${chatId}/messages?userId=${userId}&role=${userRole}`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      setMessages(data);

      // 找到最后一条AI消息的ID
      const assistantMessages = data.filter((msg: Message) => msg.role === "assistant");
      if (assistantMessages.length > 0) {
        setAssistantMessageId(assistantMessages[assistantMessages.length - 1].id || null);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          title: "新对话",
          model
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create new chat");
      }

      const chat = await response.json();
      setChats([chat, ...chats]);
      setCurrentChatId(chat.id);
      setMessages([]);
    } catch (error) {
      console.error("Error creating new chat:", error);
    }
  };

  const deleteChat = async (chatId: number) => {
    if (!window.confirm("确定要删除这个对话吗？此操作不可撤销。")) {
      return;
    }

    try {
      const response = await fetch(`/api/chats/${chatId}?userId=${userId}&role=${userRole}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }

      // 从列表中移除
      setChats(chats.filter(chat => chat.id !== chatId));

      // 如果删除的是当前聊天，选择新的当前聊天
      if (chatId === currentChatId) {
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        if (remainingChats.length > 0) {
          setCurrentChatId(remainingChats[0].id);
        } else {
          setCurrentChatId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !userId || !currentChatId) return;

    // 如果还没有聊天ID，创建新聊天
    if (!currentChatId) {
      await createNewChat();
      if (!currentChatId) return; // 如果仍然没有聊天ID，退出
    }

    const userMessage = input;
    setInput("");

    // 立即在UI中添加用户消息
    const tempUserMsg = { role: "user", content: userMessage };
    setMessages([...messages, tempUserMsg]);

    // 添加加载状态
    setIsLoading(true);

    try {
      // 发送消息到服务器
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage,
          model,
          chatId: currentChatId,
          userId,
          role: userRole
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "发送消息失败");
      }

      // 刷新消息列表，获取最新状态
      await fetchMessages(currentChatId);

      // 更新当前聊天列表中的这个聊天，将其移到顶部
      const updatedChat = chats.find(chat => chat.id === currentChatId);
      if (updatedChat) {
        const updatedChats = [
          updatedChat,
          ...chats.filter(chat => chat.id !== currentChatId)
        ];
        setChats(updatedChats);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      // 移除临时消息或将其标记为错误
      setMessages(messages => messages.filter(msg => msg !== tempUserMsg));

      // 显示错误消息
      toast({
        title: "发送失败",
        description: error instanceof Error ? error.message : "发送消息时发生错误",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const regenerateResponse = async () => {
    if (!currentChatId || !userId) return;

    // 获取要重新生成的消息ID
    let messageId = assistantMessageId;

    // 如果没有存储的消息ID，找到最后一条AI消息
    if (!messageId) {
      try {
        // 获取所有消息
        const response = await fetch(`/api/chats/${currentChatId}/messages?userId=${userId}&role=${userRole}`);
        if (!response.ok) throw new Error("获取消息失败");

        const messagesData = await response.json();

        // 验证数据是否有效
        if (!Array.isArray(messagesData) || messagesData.length === 0) {
          console.error("没有有效的消息数据");
          throw new Error("对话中没有任何消息");
        }

        // 查找最后一条AI消息
        const assistantMessages = messagesData.filter(msg => msg.role === "assistant");
        console.log(`找到 ${assistantMessages.length} 条AI消息`);

        if (assistantMessages.length === 0) {
          throw new Error("没有找到可以重新生成的AI消息");
        }

        messageId = assistantMessages[assistantMessages.length - 1].id;
      } catch (error) {
        console.error("查找消息ID失败:", error);
        toast({
          title: "重新生成失败",
          description: error instanceof Error ? error.message : "无法找到要重新生成的消息",
          variant: "destructive",
          className: "frosted-toast-error" // 使用磨砂玻璃效果样式
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      // 发送重新生成请求
      const response = await fetch(`/api/messages/${messageId}/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          userRole,
          chatId: currentChatId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "重新生成失败");
      }

      // 获取更新后的消息
      const updatedMessage = await response.json();

      // 更新消息列表
      await fetchMessages(currentChatId);

      // 设置新的助手消息ID
      setAssistantMessageId(updatedMessage.id);

    } catch (error) {
      console.error("重新生成失败:", error);
      toast({
        title: "重新生成失败",
        description: error instanceof Error ? error.message : "无法重新生成回复",
        variant: "destructive",
        className: "frosted-toast-error" // 使用磨砂玻璃效果样式
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendFeedback = async (messageId: number, feedback: "like" | "dislike") => {
    try {
      const response = await fetch(`/api/messages/${messageId}/feedback`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ feedback })
      });

      if (!response.ok) {
        throw new Error("提交反馈失败");
      }

      // 更新本地消息状态
      setMessages(messages.map(msg => 
        msg.id === messageId ? { ...msg, feedback } : msg
      ));

      // 标记该消息已发送反馈
      setFeedbackSent({...feedbackSent, [messageId]: true});

      toast({
        description: "感谢您的反馈！",
      });
    } catch (error) {
      console.error("提交反馈失败:", error);
    }
  };

  const startEditingMessage = (message: Message) => {
    if (!message.id) return;
    setEditingMessage({
      id: message.id,
      content: message.content
    });
  };

  const saveEditedMessage = async () => {
    if (!editingMessage || !editingMessage.id) return;

    try {
      const response = await fetch(`/api/messages/${editingMessage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: editingMessage.content,
          userId,
          userRole
        })
      });

      if (!response.ok) {
        throw new Error("保存编辑失败");
      }

      // 更新本地消息
      setMessages(messages.map(msg => 
        msg.id === editingMessage.id 
          ? { ...msg, content: editingMessage.content } 
          : msg
      ));

      // 清除编辑状态
      setEditingMessage(null);

      toast({
        description: "消息已更新",
      });
    } catch (error) {
      console.error("保存编辑失败:", error);
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "无法保存编辑的消息",
        variant: "destructive"
      });
    }
  };

  const cancelEditing = () => {
    setEditingMessage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 如果按Ctrl+Enter或Command+Enter，发送消息
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const updateChatTitle = async () => {
    if (!currentChatId || !editingTitle.trim()) return;

    try {
      const response = await fetch(`/api/chats/${currentChatId}/title?userId=${userId}&role=${userRole}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: editingTitle })
      });

      if (!response.ok) {
        throw new Error("更新标题失败");
      }

      // 更新本地聊天列表
      setChats(chats.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, title: editingTitle } 
          : chat
      ));

      setShowTitleDialog(false);

      toast({
        description: "标题已更新",
      });
    } catch (error) {
      console.error("更新标题失败:", error);
      toast({
        title: "更新失败",
        description: error instanceof Error ? error.message : "无法更新聊天标题",
        variant: "destructive"
      });
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword) {
      setPasswordError("请填写所有密码字段");
      return;
    }

    try {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setPasswordError(data.message || "密码修改失败");
        return;
      }

      // 清除表单并关闭对话框
      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordDialog(false);

      toast({
        title: "密码已修改",
        description: "您的密码已成功更新",
      });
    } catch (error) {
      console.error("密码修改失败:", error);
      setPasswordError("服务器错误，请稍后再试");
    }
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);

    // 如果有外部回调，调用它
    if (onModelChange) {
      onModelChange(newModel);
    }

    // 如果有当前聊天，更新其模型
    if (currentChatId) {
      updateChatModel(currentChatId, newModel);
    }
  };

  const updateChatModel = async (chatId: number, newModel: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/model`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: newModel,
          userId,
          userRole
        })
      });

      if (!response.ok) {
        throw new Error("更新模型失败");
      }

      // 更新本地聊天列表
      setChats(chats.map(chat => 
        chat.id === chatId 
          ? { ...chat, model: newModel } 
          : chat
      ));

    } catch (error) {
      console.error("更新聊天模型失败:", error);
      toast({
        title: "更新失败",
        description: "无法更新聊天模型，请稍后再试",
        variant: "destructive"
      });
    }
  };

  const renderMessageContent = (content: string) => {
    try {
      // 使用marked转换为HTML
      const htmlContent = marked(content);
      return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    } catch (error) {
      console.error("渲染消息内容失败:", error);
      return <div>{content}</div>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex justify-between items-center p-4 border-b border-neutral-800">
        <div className="flex items-center space-x-2">
          {currentChatId && (
            <div className="flex items-center cursor-pointer" onClick={() => {
              const chat = chats.find(c => c.id === currentChatId);
              if (chat) {
                setEditingTitle(chat.title);
                setShowTitleDialog(true);
              }
            }}>
              <h2 className="text-lg font-semibold">{chats.find(c => c.id === currentChatId)?.title || "新对话"}</h2>
              <Pencil className="w-4 h-4 ml-2 text-neutral-500" />
            </div>
          )}
          {!currentChatId && (
            <h2 className="text-lg font-semibold">新对话</h2>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* 模型选择器 */}
          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-36 bg-neutral-900 border-neutral-700">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-neutral-700">
              <SelectItem value="deep">强力模型</SelectItem>
              <SelectItem value="fast">快速模型</SelectItem>
              <SelectItem value="search">知识搜索</SelectItem>
            </SelectContent>
          </Select>

          {/* 密码修改按钮，只对普通用户显示 */}
          {userRole !== "admin" && (
            <Button variant="ghost" size="sm" onClick={() => setShowPasswordDialog(true)}>
              修改密码
            </Button>
          )}

          {/* 关闭按钮，如果有onClose回调 */}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          )}
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 聊天列表侧边栏 */}
        <div className="w-72 border-r border-neutral-800 overflow-y-auto py-4 px-2 hidden md:block">
          <Button 
            className="w-full mb-4" 
            onClick={() => createNewChat()}
            disabled={loadingChats}
          >
            新对话
          </Button>

          {loadingChats ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-neutral-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map(chat => (
                <div 
                  key={chat.id}
                  className={`p-2 rounded-lg cursor-pointer flex justify-between items-start group ${
                    currentChatId === chat.id ? 'bg-neutral-800' : 'hover:bg-neutral-900'
                  }`}
                  onClick={() => setCurrentChatId(chat.id)}
                >
                  <div className="truncate flex-1">
                    <div className="font-medium truncate">{chat.title}</div>
                    <div className="text-xs text-neutral-500">
                      {new Date(chat.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                  >
                    删除
                  </Button>
                </div>
              ))}

              {chats.length === 0 && (
                <div className="text-center text-neutral-500 py-4">
                  没有对话记录
                </div>
              )}
            </div>
          )}
        </div>

        {/* 消息区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                <Bot className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg">开始一个新的对话</p>
                <p className="text-sm">输入问题或选择一个历史对话</p>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start max-w-3xl ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* 头像 */}
                  <Avatar className="mt-1 mx-2">
                    <AvatarFallback>
                      {message.role === 'user' ? '👤' : '🤖'}
                    </AvatarFallback>
                  </Avatar>

                  {/* 消息内容 */}
                  <div className={`rounded-xl p-4 ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-neutral-800 text-neutral-200'
                  }`}>
                    {/* 当前正在编辑的消息 */}
                    {editingMessage && editingMessage.id === message.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingMessage.content}
                          onChange={(e) => setEditingMessage({...editingMessage, content: e.target.value})}
                          className="min-h-[100px] bg-neutral-700 border-neutral-600"
                        />
                        <div className="flex justify-end space-x-2">
                          <Button size="sm" variant="ghost" onClick={cancelEditing}>取消</Button>
                          <Button size="sm" onClick={saveEditedMessage}>保存</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-invert max-w-none">
                        {renderMessageContent(message.content)}
                      </div>
                    )}

                    {/* 消息操作 */}
                    {message.role === 'assistant' && message.id && (
                      <div className="mt-2 flex items-center space-x-2">
                        {/* 仅对没有发送过反馈的消息显示反馈按钮 */}
                        {!feedbackSent[message.id || 0] && !message.feedback && (
                          <>
                            <button 
                              onClick={() => message.id && sendFeedback(message.id, 'like')}
                              className="text-neutral-500 hover:text-green-500"
                              title="有帮助"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => message.id && sendFeedback(message.id, 'dislike')}
                              className="text-neutral-500 hover:text-red-500"
                              title="没帮助"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {/* 显示已发送的反馈 */}
                        {message.feedback === 'like' && (
                          <Badge variant="outline" className="text-green-500 border-green-500">
                            <ThumbsUp className="w-3 h-3 mr-1" /> 有帮助
                          </Badge>
                        )}

                        {message.feedback === 'dislike' && (
                          <Badge variant="outline" className="text-red-500 border-red-500">
                            <ThumbsDown className="w-3 h-3 mr-1" /> 没帮助
                          </Badge>
                        )}

                        {/* 模型标签 */}
                        <Badge variant="outline" className="ml-auto">
                          {model === 'deep' ? '强力模型' : model === 'fast' ? '快速模型' : '知识搜索'}
                        </Badge>
                      </div>
                    )}

                    {/* 用户消息的编辑按钮 */}
                    {message.role === 'user' && message.id && (
                      <div className="mt-2 flex justify-end">
                        <button 
                          onClick={() => startEditingMessage(message)}
                          className="text-neutral-500 hover:text-blue-400"
                          title="编辑消息"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 加载中指示器 */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-neutral-800 rounded-xl p-4 flex items-center">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span>AI正在思考...</span>
                </div>
              </div>
            )}

            {/* 滚动锚点 */}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="border-t border-neutral-800 p-4">
            <div className="flex space-x-2">
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isLoading}
                  onClick={regenerateResponse}
                  title="重新生成回复"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}

              <Textarea
                ref={textareaRef}
                placeholder="输入消息..."
                className="flex-1 min-h-[60px] bg-neutral-900 border-neutral-700"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !currentChatId}
              />

              <Button
                size="icon"
                disabled={isLoading || !input.trim() || !currentChatId}
                onClick={sendMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-neutral-500 mt-1 flex justify-between items-center">
              <div>按 Ctrl+Enter 发送</div>
              <div>
                {!currentChatId && (
                  <Button variant="link" className="text-xs p-0 h-auto" onClick={createNewChat}>
                    创建新对话
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 修改密码对话框 */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <form onSubmit={changePassword}>
            <div className="space-y-4 my-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">当前密码</label>
                <Input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">新密码</label>
                <Input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
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
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle>修改对话标题</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <Input 
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              className="bg-neutral-800 border-neutral-700"
              placeholder="输入新标题"
            />
          </div>
          <Button onClick={updateChatTitle} className="w-full">
            保存标题
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIChat;