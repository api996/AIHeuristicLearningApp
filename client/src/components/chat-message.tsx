import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { 
  Brain, 
  User, 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  RotateCcw, 
  Check,
  X,
  Edit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader
} from "@/components/ui/dialog";

interface ChatMessageProps {
  message: {
    id?: number;
    role: "user" | "assistant";
    content: string;
  };
  isThinking?: boolean; // 用于表示AI是否正在思考
  onEdit?: (id: number | undefined, newContent: string) => Promise<void>; // 编辑消息
  onRegenerate?: (id: number | undefined) => Promise<void>; // 重新生成回答
  onFeedback?: (id: number | undefined, feedback: "like" | "dislike") => Promise<void>; // 点赞/踩
}

// 打字机效果的Hook
const useTypewriter = (text: string, delay: number = 30) => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  
  useEffect(() => {
    // 重置状态
    if (text !== displayedText && currentIndex === 0) {
      setDisplayedText("");
    }
    
    // 如果已完成或文本为空，返回
    if (completed || !text) return;
    
    // 如果当前索引小于文本长度，继续打字
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(currentIndex + 1);
      }, delay);
      
      return () => clearTimeout(timeout);
    } else {
      // 打字完成
      setCompleted(true);
    }
  }, [text, currentIndex, delay, completed, displayedText]);
  
  // 如果文本改变，重置状态
  useEffect(() => {
    setCurrentIndex(0);
    setDisplayedText("");
    setCompleted(false);
  }, [text]);
  
  return { displayedText, completed };
};

export function ChatMessage({ 
  message, 
  isThinking = false,
  onEdit,
  onRegenerate,
  onFeedback
}: ChatMessageProps) {
  // 对于AI回复使用打字机效果
  const { displayedText, completed } = useTypewriter(
    message.role === "assistant" ? message.content : "",
    20
  );
  
  // 状态管理
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [isHovering, setIsHovering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userRating, setUserRating] = useState<"like" | "dislike" | null>(null);
  
  // 用户消息长按相关状态
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Check if the message contains an image markdown
  const isImage = message.content.startsWith("![");

  // Parse image URL if it's an image message
  const imageUrl = isImage ? 
    message.content.match(/\((.*?)\)/)?.[1] : null;

  // 思考过程状态列表，包含不同阶段的状态提示
  const thinkingPhases = [
    // 第一阶段：初始分析
    [
      "接收到您的问题...",
      "分析问题中...",
      "理解问题关键点...",
      "确定问题范围..."
    ],
    // 第二阶段：搜索信息
    [
      "搜索相关知识库...",
      "检索匹配信息...",
      "整合可用信息...",
      "判断信息相关性..."
    ],
    // 第三阶段：深度思考
    [
      "启动深度推理...",
      "考虑多个可能角度...",
      "分析可能的解释...",
      "评估不同方案..."
    ],
    // 第四阶段：优化
    [
      "进一步提炼思路...",
      "尝试更深层次的解析...",
      "优化答案质量...",
      "需要更多分析迭代..."
    ],
    // 第五阶段：准备回答
    [
      "整合思考结果...",
      "构建连贯回答...",
      "精简组织语言...",
      "准备最终输出..."
    ]
  ];
  
  // 当前思考阶段和步骤
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentStepInPhase, setCurrentStepInPhase] = useState(0);
  
  // 获取当前显示的思考步骤文本
  const getCurrentThinkingStepText = () => {
    // 确保索引在有效范围内
    const phase = Math.min(currentPhase, thinkingPhases.length - 1);
    const step = Math.min(currentStepInPhase, thinkingPhases[phase].length - 1);
    return thinkingPhases[phase][step];
  };
  
  // 阶段间切换的迭代消息
  const phaseTransitionMessages = [
    "继续分析更多相关信息...",
    "需要深入挖掘问题本质...",
    "让我进一步拓展分析维度...",
    "需要迭代优化当前思路..."
  ];
  
  // 更新思考步骤的效果
  useEffect(() => {
    if (!isThinking) return;
    
    // 步骤更新间隔
    const stepInterval = setInterval(() => {
      // 更新当前阶段内的步骤
      setCurrentStepInPhase(prev => {
        // 如果到达当前阶段的最后一步
        if (prev >= thinkingPhases[currentPhase].length - 1) {
          // 重置步骤，并在外层延时器中处理阶段更新
          return 0;
        } else {
          // 继续下一步
          return prev + 1;
        }
      });
    }, 1500); // 每1.5秒更新一次步骤
    
    // 阶段更新间隔 - 比步骤间隔长
    const phaseInterval = setInterval(() => {
      // 每8秒切换到下一个阶段并显示过渡消息
      setCurrentPhase(prev => (prev + 1) % thinkingPhases.length);
    }, 8000); // 每8秒更新一次阶段
    
    return () => {
      clearInterval(stepInterval);
      clearInterval(phaseInterval);
    };
  }, [isThinking, thinkingPhases.length, currentPhase]);
  
  // 计算总体进度比例 (0-100%)
  const calculateProgressPercentage = () => {
    const totalSteps = thinkingPhases.reduce((total, phase) => total + phase.length, 0);
    const completedPhaseSteps = thinkingPhases
      .slice(0, currentPhase)
      .reduce((total, phase) => total + phase.length, 0);
    const currentPhaseCompletedSteps = currentStepInPhase + 1;
    
    return ((completedPhaseSteps + currentPhaseCompletedSteps) / totalSteps) * 100;
  };

  // 增强的思考中动画组件 - 带分阶段进度显示
  const ThinkingAnimation = () => (
    <div className="mt-2 space-y-3">
      <div className="flex items-center space-x-3">
        <div className="flex space-x-1">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "0ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "300ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "600ms" }}></div>
        </div>
        <div className="text-blue-400 text-sm font-medium animate-pulse">
          {getCurrentThinkingStepText()}
        </div>
      </div>
      
      {/* 分阶段进度指示器 */}
      <div className="flex items-center space-x-1.5">
        {thinkingPhases.map((_, index) => (
          <div 
            key={index} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              index === currentPhase 
                ? "bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" 
                : index < currentPhase 
                  ? "bg-blue-500" 
                  : "bg-neutral-800"
            )}
          />
        ))}
      </div>
      
      {/* 总进度条 */}
      <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full animate-shimmer"
          style={{ 
            width: `${calculateProgressPercentage()}%`,
            backgroundSize: '200% 100%',
            transition: 'width 1s ease-out'
          }}
        />
      </div>
      
      {/* 阶段提示 - 只在阶段转换时显示 */}
      {currentStepInPhase === 0 && currentPhase > 0 && (
        <div className="text-xs text-neutral-400 italic mt-1">
          {phaseTransitionMessages[(currentPhase - 1) % phaseTransitionMessages.length]}
        </div>
      )}
    </div>
  );

  // 处理消息编辑
  const handleSaveEdit = async () => {
    if (!onEdit || !editedContent.trim() || isSaving) return;
    
    try {
      setIsSaving(true);
      await onEdit(message.id, editedContent.trim());
      setIsEditing(false);
      toast({
        title: "修改成功",
        description: "您的消息已更新",
      });
    } catch (error) {
      toast({
        title: "修改失败",
        description: "无法保存更改，请稍后再试",
        variant: "destructive"
      });
      console.error("编辑消息失败:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // 复制消息内容
  const copyMessageContent = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        toast({
          title: "已复制到剪贴板",
          duration: 2000,
        });
        setShowOptionsDialog(false);
      })
      .catch(err => {
        toast({
          title: "复制失败",
          description: "请手动选择并复制文本",
          variant: "destructive"
        });
        console.error("复制失败:", err);
      });
  };
  
  // 重新生成回答
  const handleRegenerate = async () => {
    if (!onRegenerate || isThinking) return;
    
    try {
      await onRegenerate(message.id);
    } catch (error) {
      toast({
        title: "重新生成失败",
        description: "无法重新生成回答，请稍后再试",
        variant: "destructive"
      });
      console.error("重新生成回答失败:", error);
    }
  };
  
  // 提交评分反馈
  const handleFeedback = async (feedback: "like" | "dislike") => {
    if (!onFeedback || userRating === feedback) return;
    
    try {
      setUserRating(feedback);
      await onFeedback(message.id, feedback);
      toast({
        title: feedback === "like" ? "感谢您的肯定！" : "感谢您的反馈",
        description: feedback === "like" 
          ? "我们会继续提供高质量回答" 
          : "我们会努力提高回答质量",
        duration: 3000,
      });
    } catch (error) {
      setUserRating(null);
      toast({
        title: "反馈提交失败",
        description: "无法保存您的反馈，请稍后再试",
        variant: "destructive"
      });
      console.error("提交反馈失败:", error);
    }
  };

  // 支持简单的Markdown渲染
  const renderContent = (content: string) => {
    if (isImage && imageUrl) return null;
    
    // 替换代码块（使用```包裹的内容）
    let formattedContent = content.replace(
      /```([\s\S]*?)```/g, 
      '<pre class="bg-neutral-900 p-3 rounded-md overflow-x-auto my-2 text-sm">$1</pre>'
    );
    
    // 替换内联代码（使用`包裹的内容）
    formattedContent = formattedContent.replace(
      /`([^`]+)`/g, 
      '<code class="bg-neutral-900 px-1 py-0.5 rounded text-xs">$1</code>'
    );
    
    // 替换粗体文本（使用**包裹的内容）
    formattedContent = formattedContent.replace(
      /\*\*([^*]+)\*\*/g, 
      '<strong>$1</strong>'
    );
    
    // 替换斜体文本（使用*包裹的内容）
    formattedContent = formattedContent.replace(
      /\*([^*]+)\*/g, 
      '<em>$1</em>'
    );

    // 替换链接
    formattedContent = formattedContent.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" class="text-blue-400 hover:underline" target="_blank">$1</a>'
    );
    
    // 替换换行符为<br>
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    return <div dangerouslySetInnerHTML={{ __html: formattedContent }} />;
  };

  // 处理编辑开始 - 从对话框选项
  const handleEditStart = () => {
    if (onEdit) {
      setIsEditing(true);
      setShowOptionsDialog(false);
    }
  };
  
  // 处理用户消息选项 - 长按/右键菜单处理
  const handleUserMessagePress = () => {
    if (message.role === "user" && onEdit) {
      setShowOptionsDialog(true);
    }
  };
  
  // 用户消息长按处理
  const handleTouchStart = () => {
    if (message.role !== "user" || !onEdit) return;
    
    longPressTimer.current = setTimeout(() => {
      handleUserMessagePress();
    }, 500); // 500ms长按触发
  };
  
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  
  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    if (message.role === "user" && onEdit) {
      e.preventDefault();
      handleUserMessagePress();
    }
  };

  return (
    <>
      {/* 选项对话框 */}
      <Dialog open={showOptionsDialog} onOpenChange={setShowOptionsDialog}>
        <DialogContent className="sm:max-w-[280px] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <h3 className="text-center text-lg font-medium">消息选项</h3>
          </DialogHeader>
          <div className="p-0">
            <button
              className="w-full flex items-center space-x-2 p-4 hover:bg-neutral-800 transition-colors"
              onClick={copyMessageContent}
            >
              <Copy className="h-5 w-5 text-neutral-400" />
              <span>复制消息</span>
            </button>
            
            {onEdit && (
              <button
                className="w-full flex items-center space-x-2 p-4 hover:bg-neutral-800 transition-colors"
                onClick={handleEditStart}
              >
                <Edit className="h-5 w-5 text-neutral-400" />
                <span>编辑消息</span>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    
      <div 
        className={cn(
          "w-full max-w-3xl mx-auto px-4 py-2 message-appear group",
          message.role === "assistant" ? "bg-neutral-900/30" : "bg-transparent"
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* 实现左右交错布局 */}
        <div className={cn(
          "flex flex-col",
          message.role === "user" ? "items-end" : "items-start",
        )}>
          <div 
            className={cn(
              "flex max-w-[80%] animate-scale-in",
              message.role === "user" ? "flex-row-reverse ml-auto" : "mr-auto",
            )}
          >
            {/* 头像 */}
            <div className={cn(
              "flex-shrink-0 flex items-center",
              message.role === "user" ? "ml-3" : "mr-3"
            )}>
              {message.role === "assistant" ? (
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-full">
                  <Brain className="h-4 w-4 text-white" />
                </div>
              ) : (
                <div className="bg-blue-600 p-1.5 rounded-full">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            
            {/* 消息内容 */}
            <div 
              ref={messageRef}
              className={cn(
                "py-3 px-4 rounded-2xl relative",
                message.role === "assistant" 
                  ? "bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-white border border-blue-800/30" 
                  : "bg-blue-500/20 backdrop-blur-sm text-white border border-blue-500/30"
              )}
              onContextMenu={handleContextMenu}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {isEditing && message.role === "user" ? (
                <div className="min-w-[300px]">
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="bg-blue-700 border-blue-600 text-white min-h-[100px] mb-2"
                    placeholder="编辑您的消息..."
                  />
                  <div className="flex justify-end space-x-2 mt-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 text-xs text-neutral-200"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedContent(message.content);
                      }}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      取消
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-8 text-xs"
                      onClick={handleSaveEdit}
                      disabled={isSaving || editedContent.trim() === message.content}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {isImage && imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt="Uploaded" 
                      className="max-w-full max-h-[300px] rounded-md object-contain"
                    />
                  ) : (
                    <>
                      {message.role === "assistant" ? (
                        <>
                          {/* 对AI消息使用打字机效果 */}
                          {renderContent(displayedText)}
                          {/* 如果打字尚未完成，显示光标 */}
                          {!completed && !isThinking && 
                            <span className="inline-block h-4 w-1 bg-blue-400 animate-blink ml-0.5 align-middle"></span>
                          }
                          {/* 如果正在思考中，显示思考动画 */}
                          {isThinking && <ThinkingAnimation />}
                        </>
                      ) : (
                        // 对用户消息直接显示
                        renderContent(message.content)
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* AI消息的底部操作栏 */}
          {message.role === "assistant" && completed && !isThinking && (
            <div 
              className="flex items-center space-x-2 mt-1 text-xs opacity-100"
            >
              {/* 复制按钮 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full hover:bg-neutral-800 text-neutral-400"
                onClick={copyMessageContent}
                title="复制"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              
              {/* 重新生成按钮 */}
              {onRegenerate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-neutral-800 text-neutral-400"
                  onClick={handleRegenerate}
                  title="重新生成"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              
              {/* 点赞/踩按钮 */}
              {onFeedback && (
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 rounded-full hover:bg-neutral-800",
                      userRating === "like" ? "text-green-500" : "text-neutral-400"
                    )}
                    onClick={() => handleFeedback("like")}
                    title="赞"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 rounded-full hover:bg-neutral-800",
                      userRating === "dislike" ? "text-red-500" : "text-neutral-400"
                    )}
                    onClick={() => handleFeedback("dislike")}
                    title="踩"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}