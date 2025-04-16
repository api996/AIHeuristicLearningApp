import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, Settings, LogOut, User, Brain, Sparkles, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatHistoryProps {
  onNewChat?: () => void;
  currentChatId?: number;
  onSelectChat?: (chatId: number) => void;
  setCurrentChatId?: (id: number) => void;
  onDeleteChat?: (id: number) => void;
  onLogout?: () => void;
  onChangePassword?: () => void;
  onShowProfile?: () => void;
  onShowLearningPath?: () => void;
  onShowPreferences?: () => void;
  chats?: any[];
  user?: { userId: number; role: string; username?: string };
}

export function ChatHistory({ 
  onNewChat, 
  currentChatId, 
  onSelectChat,
  setCurrentChatId,
  onDeleteChat,
  onLogout,
  onChangePassword,
  onShowProfile,
  onShowLearningPath,
  onShowPreferences,
  chats: propsChats,
  user 
}: ChatHistoryProps) {
  // 状态变量
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<number | null>(null);
  const [longPressActive, setLongPressActive] = useState(false);
  
  // 如果用户不存在或未登录，不渲染任何内容
  if (!user?.userId) {
    console.log('[ChatHistory] No user found, not rendering');
    return null;
  }

  const queryClient = useQueryClient();

  // 使用传入的chats或从API获取
  const { data: apiChats, isLoading } = useQuery({
    queryKey: ['/api/chats', user.userId, user.role],
    queryFn: async () => {
      const response = await fetch(`/api/chats?userId=${user.userId}&role=${user.role}`);
      if (!response.ok) throw new Error('Failed to fetch chats');
      return response.json();
    },
    // 关键：只有在必要时才启用查询
    enabled: Boolean(
      !propsChats && // 没有传入props中的chats
      user.userId && // 用户已登录
      user.role !== 'admin' // 不是管理员用户
    )
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: number) => {
      await apiRequest('DELETE', `/api/chats/${chatId}?userId=${user.userId}&role=${user.role}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
  });

  // 常规删除处理函数
  const handleDeleteChat = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatMutation.mutateAsync(chatId);
      if (onDeleteChat) onDeleteChat(chatId);
      toast({
        title: "删除成功",
        description: "已成功删除对话",
      });
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast({
        title: "删除失败",
        description: "删除对话时发生错误",
        variant: "destructive",
      });
    }
  };
  
  // 长按开始函数
  const handleLongPressStart = (chatId: number, e: React.MouseEvent) => {
    // 防止触发正常点击事件
    e.stopPropagation();
    e.preventDefault();
    
    // 记录当前活动的聊天ID
    setActiveChatId(chatId);
    
    // 设置3秒定时器
    const timer = setTimeout(() => {
      // 显示删除确认对话框
      setChatToDelete(chatId);
      setShowDeleteAlert(true);
      setLongPressActive(true);
      
      // 提供触觉反馈（如果浏览器支持）
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    }, 3000); // 3秒长按
    
    setLongPressTimer(timer);
  };
  
  // 长按结束函数
  const handleLongPressEnd = () => {
    // 清除定时器
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // 如果长按已激活并且已显示删除确认框，则保持状态不变
    // 否则重置状态
    if (!longPressActive) {
      setActiveChatId(null);
    }
  };
  
  // 确认删除函数
  const confirmDelete = async () => {
    if (chatToDelete) {
      try {
        await deleteChatMutation.mutateAsync(chatToDelete);
        if (onDeleteChat) onDeleteChat(chatToDelete);
        toast({
          title: "删除成功",
          description: "已成功删除对话",
        });
      } catch (error) {
        console.error('Failed to delete chat:', error);
        toast({
          title: "删除失败",
          description: "删除对话时发生错误",
          variant: "destructive",
        });
      }
    }
    
    // 重置状态
    setShowDeleteAlert(false);
    setChatToDelete(null);
    setActiveChatId(null);
    setLongPressActive(false);
  };

  // 确定使用哪个chats数据
  const chatsToRender = propsChats || apiChats;

  if (isLoading && !propsChats) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        加载中...
      </div>
    );
  }

  if (!chatsToRender || chatsToRender.length === 0) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        暂无记录
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full">
      {/* 新对话按钮（不在顶部显示） - 已从ChatGPT风格移动到ai-chat.tsx组件 */}
      
      {/* 聊天记录列表 */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-3 space-y-1">
          {chatsToRender.map((chat: any) => (
            <div
              key={chat.id}
              className={`group flex items-center rounded-lg ${
                currentChatId === chat.id ? 'bg-neutral-800' : 'hover:bg-neutral-800/50'
              } ${activeChatId === chat.id && longPressActive ? 'bg-red-900/30' : ''}`}
            >
              <Button
                variant="ghost"
                className="w-full justify-start text-sm py-3 px-3 h-auto"
                onClick={() => {
                  if (longPressActive && activeChatId === chat.id) return;
                  if (onSelectChat) onSelectChat(chat.id);
                  if (setCurrentChatId) setCurrentChatId(chat.id);
                }}
                // 添加长按事件
                onMouseDown={(e) => handleLongPressStart(chat.id, e)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onTouchStart={(e) => handleLongPressStart(chat.id, e as unknown as React.MouseEvent)}
                onTouchEnd={handleLongPressEnd}
                onTouchCancel={handleLongPressEnd}
              >
                <MessageSquare className="mr-3 h-4 w-4 shrink-0 text-neutral-400" />
                <div className="flex flex-col items-start truncate">
                  <span className="truncate w-full">{chat.title}</span>
                  {user.role === "admin" && chat.username && (
                    <span className="text-xs text-neutral-500">
                      by {chat.username}
                    </span>
                  )}
                </div>
                {/* 倒计时指示器 - 仅在长按过程中显示 */}
                {activeChatId === chat.id && !longPressActive && (
                  <div className="ml-auto">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-neutral-700/50">
                      <svg className="w-4 h-4 text-white animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 mr-1"
                onClick={(e) => handleDeleteChat(chat.id, e)}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="bg-neutral-800 border border-neutral-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除对话</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-300">
              您确定要删除此对话吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowDeleteAlert(false);
                setChatToDelete(null);
                setActiveChatId(null);
                setLongPressActive(false);
              }}
              className="bg-neutral-700 hover:bg-neutral-600 text-white border-none"
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 用户中心下拉菜单 - 使用ChatGPT风格固定在底部 */}
      <div className="mt-auto p-2 border-t border-neutral-800 profile-menu-container">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start p-3 text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors profile-trigger-button"
            >
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-full mr-3">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium truncate max-w-[140px]">{user.username || '用户'}</span>
                <span className="text-xs text-neutral-500">{user.role === 'admin' ? '管理员' : '用户'}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="center" 
            side="top"
            sideOffset={10} 
            className="w-[260px] bg-neutral-800 border border-neutral-700 text-white rounded-xl shadow-lg animate-in slide-in-from-bottom-5 fade-in-80 z-[9999]"
          >
            <DropdownMenuGroup className="py-1">
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
                onClick={onShowProfile}
              >
                <User className="mr-2.5 h-4 w-4 text-blue-400" />
                <span>个人资料</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
                onClick={onChangePassword}
              >
                <Settings className="mr-2.5 h-4 w-4 text-green-400" />
                <span>修改密码</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
                onClick={onShowLearningPath}
              >
                <Brain className="mr-2.5 h-4 w-4 text-purple-400" />
                <span>学习轨迹</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
                onClick={onShowPreferences}
              >
                <Sparkles className="mr-2.5 h-4 w-4 text-yellow-400" />
                <span>偏好设置</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-neutral-700" />
            <DropdownMenuItem 
              className="cursor-pointer flex items-center text-red-400 hover:bg-neutral-700 py-2.5 px-3 focus:bg-neutral-700"
              onClick={onLogout}
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}