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
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<number | null>(null);
  
  // 长按相关状态
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
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
      // 添加错误处理和详细的日志输出
      console.log(`[Chat] Attempting to delete chat ID: ${chatId}, user ID: ${user.userId}, role: ${user.role}`);
      try {
        const res = await apiRequest('DELETE', `/api/chats/${chatId}?userId=${user.userId}&role=${user.role}`);
        console.log(`[Chat] Delete API response status: ${res.status}`);
        return res;
      } catch (error) {
        console.error(`[Chat] Delete API error:`, error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('[Chat] Deletion successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['/api/chats', user.userId, user.role] });
    },
    onError: (error) => {
      console.error('[Chat] Deletion mutation error:', error);
    }
  });

  // 常规删除处理函数
  const handleDeleteChat = async (chatId: number, e: React.MouseEvent) => {
    console.log(`[ChatHistory] 尝试删除聊天，ID: ${chatId}`);
    e.stopPropagation();
    e.preventDefault(); // 防止事件冒泡
    
    // 显示确认对话框前记录日志
    console.log(`[ChatHistory] 打开确认对话框，chatId=${chatId}`);
    
    // 先显示确认对话框
    setChatToDelete(chatId);
    setShowDeleteAlert(true);
    
    // 确保对话框已显示
    console.log(`[ChatHistory] 删除确认对话框状态：${showDeleteAlert ? '已显示' : '未显示'}`);
  };
  
  // 长按开始处理
  const handleLongPressStart = (chatId: number, e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log(`[ChatHistory] 开始长按, ID: ${chatId}`);
    
    // 设置长按计时器
    const timer = setTimeout(() => {
      console.log(`[ChatHistory] 长按时间到达，触发删除确认`);
      setIsLongPressing(true);
      
      // 触发确认对话框
      setChatToDelete(chatId);
      setShowDeleteAlert(true);
      
      // 震动反馈 (如果设备支持)
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    }, 600); // 长按时间设为600毫秒
    
    setLongPressTimer(timer);
  };
  
  // 长按结束处理
  const handleLongPressEnd = () => {
    console.log(`[ChatHistory] 长按结束`);
    
    // 清除计时器
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    setIsLongPressing(false);
  };
  
  // 确认删除函数
  const confirmDelete = async () => {
    console.log(`[ChatHistory] 确认删除聊天，ID: ${chatToDelete}`);
    
    if (chatToDelete) {
      try {
        console.log(`[ChatHistory] 开始调用API删除聊天，ID: ${chatToDelete}`);
        await deleteChatMutation.mutateAsync(chatToDelete);
        
        console.log(`[ChatHistory] API删除成功，通知父组件更新UI`);
        if (onDeleteChat) {
          onDeleteChat(chatToDelete);
          console.log(`[ChatHistory] 已通知父组件删除ID: ${chatToDelete}`);
        }
        
        toast({
          title: "删除成功",
          description: "已成功删除对话",
        });
        console.log(`[ChatHistory] 已显示成功提示`);
      } catch (error) {
        console.error('[ChatHistory] 删除聊天失败:', error);
        toast({
          title: "删除失败",
          description: "删除对话时发生错误",
          variant: "destructive",
        });
      }
    } else {
      console.warn('[ChatHistory] 确认删除时chatToDelete为null');
    }
    
    // 重置状态
    console.log('[ChatHistory] 重置确认对话框状态');
    setShowDeleteAlert(false);
    setChatToDelete(null);
  };

  // 确定使用哪个chats数据
  const chatsToRender = propsChats || apiChats;

  // 准备聊天列表内容
  let chatListContent;
  
  if (isLoading && !propsChats) {
    chatListContent = (
      <div className="p-4 text-sm text-neutral-400">
        加载中...
      </div>
    );
  } else if (!chatsToRender || chatsToRender.length === 0) {
    chatListContent = (
      <div className="p-4 text-sm text-neutral-400">
        暂无记录
      </div>
    );
  
    // 添加空状态提示
  } else if (chatsToRender.length === 1) {
    // 只有一个聊天记录时，显示长按提示
    chatListContent = (
      <>
        <div className="px-2 pt-1 pb-0">
          <div className="text-xs text-[#0deae4]/70 mb-1 text-center">
            提示: 长按聊天记录可以删除
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 py-2 space-y-1">
            {chatsToRender.map((chat: any) => (
              <div
                key={chat.id}
                className={`group flex items-center rounded-lg ${
                  currentChatId === chat.id ? 'bg-[#0deae4]/10' : 'hover:bg-black/40'
                }`}
                onTouchStart={(e) => handleLongPressStart(chat.id, e)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
                onTouchCancel={handleLongPressEnd}
              >
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm py-3 px-3 h-auto"
                  onClick={() => {
                    // 如果是长按结束，不触发导航
                    if (isLongPressing) return;
                    
                    if (onSelectChat) onSelectChat(chat.id);
                    if (setCurrentChatId) setCurrentChatId(chat.id);
                  }}
                >
                  <MessageSquare className={`mr-3 h-4 w-4 shrink-0 ${currentChatId === chat.id ? 'text-[#0deae4]' : 'text-[#0deae4]/60'}`} />
                  <div className="flex flex-col items-start truncate">
                    <span className={`truncate w-[180px] ${currentChatId === chat.id ? 'text-white' : 'text-white/80'}`}>{chat.title}</span>
                    {user.role === "admin" && chat.username && (
                      <span className="text-xs text-[#0deae4]/50">
                        by {chat.username}
                      </span>
                    )}
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity h-8 w-8 mr-1 hover:bg-red-500/10"
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  onTouchStart={(e) => handleLongPressStart(chat.id, e)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </>
    );
  } else {
    chatListContent = (
      <ScrollArea className="flex-1">
        <div className="px-2 pt-1 pb-0">
          <div className="text-xs text-[#0deae4]/70 mb-1 text-center">
            提示: 长按聊天记录可以删除
          </div>
        </div>
        <div className="px-2 py-2 space-y-1">
          {chatsToRender.map((chat: any) => (
            <div
              key={chat.id}
              className={`group flex items-center rounded-lg ${
                currentChatId === chat.id ? 'bg-[#0deae4]/10' : 'hover:bg-black/40'
              }`}
              onTouchStart={(e) => handleLongPressStart(chat.id, e)}
              onTouchEnd={handleLongPressEnd}
              onTouchMove={handleLongPressEnd}
              onTouchCancel={handleLongPressEnd}
            >
              <Button
                variant="ghost"
                className="w-full justify-start text-sm py-3 px-3 h-auto"
                onClick={() => {
                  // 如果是长按结束，不触发导航
                  if (isLongPressing) return;
                  
                  if (onSelectChat) onSelectChat(chat.id);
                  if (setCurrentChatId) setCurrentChatId(chat.id);
                }}
              >
                <MessageSquare className={`mr-3 h-4 w-4 shrink-0 ${currentChatId === chat.id ? 'text-[#0deae4]' : 'text-[#0deae4]/60'}`} />
                <div className="flex flex-col items-start truncate">
                  <span className={`truncate w-[180px] ${currentChatId === chat.id ? 'text-white' : 'text-white/80'}`}>{chat.title}</span>
                  {user.role === "admin" && chat.username && (
                    <span className="text-xs text-[#0deae4]/50">
                      by {chat.username}
                    </span>
                  )}
                </div>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity h-8 w-8 mr-1 hover:bg-red-500/10"
                onClick={(e) => handleDeleteChat(chat.id, e)}
                onTouchStart={(e) => handleLongPressStart(chat.id, e)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
                onTouchCancel={handleLongPressEnd}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="w-full flex flex-col h-full bg-black/50 backdrop-blur-md">
      {/* 新对话按钮（不在顶部显示） - 已从ChatGPT风格移动到ai-chat.tsx组件 */}
      
      {/* 聊天记录列表 */}
      {chatListContent}
      
      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="bg-black/70 backdrop-blur-md border border-[#0deae4]/30 text-white">
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
              }}
              className="bg-black/60 hover:bg-black/80 text-white border border-neutral-700"
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600/80 hover:bg-red-700/90 text-white border border-red-500"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 用户中心下拉菜单 - 使用ChatGPT风格固定在底部 */}
      <div className="mt-auto p-2 border-t border-[#0deae4]/20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start p-3 text-white hover:bg-[#0deae4]/10 rounded-lg transition-colors"
            >
              <div className="bg-gradient-to-br from-[#0deae4] to-[#0d8ae4] p-1.5 rounded-full mr-3 shadow-lg shadow-[#0deae4]/20">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium truncate max-w-[140px]">{user.username || '用户'}</span>
                <span className="text-xs text-[#0deae4]/70">{user.role === 'admin' ? '管理员' : '用户'}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="center" 
            side="top"
            sideOffset={10} 
            className="w-[260px] bg-black/80 backdrop-blur-lg border border-[#0deae4]/30 text-white rounded-xl shadow-lg shadow-[#0deae4]/20 animate-in slide-in-from-bottom-5 fade-in-80"
          >
            <DropdownMenuGroup className="py-1">
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-[#0deae4]/10 py-2.5 px-3 focus:bg-[#0deae4]/20"
                onClick={onShowProfile}
              >
                <User className="mr-2.5 h-4 w-4 text-[#0deae4]" />
                <span>个人资料</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-[#0deae4]/10 py-2.5 px-3 focus:bg-[#0deae4]/20"
                onClick={onChangePassword}
              >
                <Settings className="mr-2.5 h-4 w-4 text-[#0deae4]" />
                <span>修改密码</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-[#0deae4]/10 py-2.5 px-3 focus:bg-[#0deae4]/20"
                onClick={onShowLearningPath}
              >
                <Brain className="mr-2.5 h-4 w-4 text-[#0deae4]" />
                <span>学习轨迹</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center hover:bg-[#0deae4]/10 py-2.5 px-3 focus:bg-[#0deae4]/20"
                onClick={onShowPreferences}
              >
                <Sparkles className="mr-2.5 h-4 w-4 text-[#0deae4]" />
                <span>偏好设置</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-[#0deae4]/20" />
            <DropdownMenuItem 
              className="cursor-pointer flex items-center text-red-400 hover:bg-red-500/10 py-2.5 px-3 focus:bg-red-500/20"
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