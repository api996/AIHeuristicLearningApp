import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { 
  Brain, 
  User, 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  RotateCcw, 
  Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

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
  const [isHovering, setIsHovering] = useState(false);
  const [userRating, setUserRating] = useState<"like" | "dislike" | null>(null);

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
  
  // 复制消息内容
  const copyMessageContent = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        toast({
          title: "已复制到剪贴板",
          duration: 2000,
        });
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

  // 长按手势和弹出菜单功能
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const messageRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  useEffect(() => {
    let pressTimer: ReturnType<typeof setTimeout>;
    let startX = 0;
    let startY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (message.role !== "user" || !messageRef.current) return;
      
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      
      pressTimer = setTimeout(() => {
        setIsLongPressing(true);
        
        // 计算菜单位置 - 现在改为显示在消息中间位置
        const rect = messageRef.current?.getBoundingClientRect();
        if (rect) {
          const screenWidth = window.innerWidth;
          const isRightHalf = rect.left > screenWidth / 2;
          
          setMenuPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2 // 将菜单显示在消息中间位置
          });
        }
        
        // 添加音效反馈 (iOS风格)
        try {
          // 创建一个非常短暂的振动
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        } catch (e) {
          // 可能在某些设备上不支持
          console.log("振动反馈不可用");
        }
        
        // 显示上下文菜单
        setShowContextMenu(true);
      }, 450); // 减少触发时间为450ms，使响应更快
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      // 如果移动超过一定距离，取消长按
      const moveX = Math.abs(e.touches[0].clientX - startX);
      const moveY = Math.abs(e.touches[0].clientY - startY);
      
      if (moveX > 10 || moveY > 10) {
        clearTimeout(pressTimer);
        setIsLongPressing(false);
      }
    };
    
    const handleTouchEnd = () => {
      clearTimeout(pressTimer);
      // 不立即清除isLongPressing，以便动画完成
      setTimeout(() => {
        setIsLongPressing(false);
      }, 300);
    };
    
    // 点击页面其他地方关闭菜单
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(e.target as Node) && 
        showContextMenu
      ) {
        setShowContextMenu(false);
      }
    };
    
    // 鼠标右键功能
    const handleContextMenu = (e: MouseEvent) => {
      if (message.role !== "user" || !messageRef.current) return;
      
      e.preventDefault();
      
      // 计算菜单位置 - 现在改为显示在消息中间
      const rect = messageRef.current?.getBoundingClientRect();
      if (rect) {
        const screenWidth = window.innerWidth;
        const isRightHalf = rect.left > screenWidth / 2;
        
        // 判断是在屏幕左侧还是右侧来调整菜单位置
        // 在消息中间位置显示菜单，避免超出屏幕边缘
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2 // 将菜单显示在消息中间位置
        });
      } else {
        // 如果无法获取消息元素位置，则使用鼠标位置
        setMenuPosition({
          x: e.clientX,
          y: e.clientY
        });
      }
      
      // 显示上下文菜单
      setShowContextMenu(true);
      setIsLongPressing(true);
    };
    
    const elementRef = messageRef.current;
    if (elementRef && message.role === "user") {
      elementRef.addEventListener('touchstart', handleTouchStart);
      elementRef.addEventListener('touchmove', handleTouchMove);
      elementRef.addEventListener('touchend', handleTouchEnd);
      elementRef.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      if (elementRef && message.role === "user") {
        elementRef.removeEventListener('touchstart', handleTouchStart);
        elementRef.removeEventListener('touchmove', handleTouchMove);
        elementRef.removeEventListener('touchend', handleTouchEnd);
        elementRef.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('click', handleClickOutside);
      }
      clearTimeout(pressTimer);
    };
  }, [message.role, showContextMenu]);
  
  // 处理菜单项点击
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        toast({
          title: "已复制到剪贴板",
          duration: 2000,
        });
        setShowContextMenu(false);
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
  
  const handleEditMessage = () => {
    if (onEdit) {
      onEdit(message.id, message.content);
      setShowContextMenu(false);
    }
  };

  return (
    <>
      {/* iOS风格上下文菜单 */}
      {showContextMenu && (
        <div 
          className="fixed z-50 animate-fade-in"
          style={{ 
            top: `${menuPosition.y}px`, 
            left: `${menuPosition.x}px`, 
            transform: 'translate(-50%, -50%)' 
          }}
          ref={menuRef}
        >
          {/* 菜单内容 - 现代iOS风格菜单，使用半透明玻璃拟态效果 */}
          <div className="bg-neutral-900/75 backdrop-blur-xl text-white rounded-2xl overflow-hidden shadow-2xl animate-scale-in-menu border border-neutral-700/30 w-52 sm:w-[260px]">
            <div className="flex flex-col divide-y divide-neutral-700/30">
              <button
                onClick={handleCopyMessage}
                className="px-6 py-4 hover:bg-neutral-800/60 active:bg-neutral-800/80 transition-colors duration-150 flex items-center"
              >
                <Copy className="h-5 w-5 mr-4 text-blue-400" />
                <span className="text-sm font-medium">复制</span>
              </button>
              
              <button
                onClick={handleEditMessage}
                className="px-6 py-4 hover:bg-neutral-800/60 active:bg-neutral-800/80 transition-colors duration-150 flex items-center"
              >
                <Pencil className="h-5 w-5 mr-4 text-blue-400" />
                <span className="text-sm font-medium">编辑</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 页面暗化遮罩 - 使用iOS 16+风格的背景模糊效果 */}
      {showContextMenu && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 animate-fade-in"
          style={{ backdropFilter: 'blur(16px)' }}
          onClick={() => {
            setShowContextMenu(false);
            setIsLongPressing(false);
          }}
        />
      )}
      
      <div 
        className={cn(
          "w-full max-w-3xl mx-auto px-4 py-2 message-appear group",
          message.role === "assistant" ? "bg-neutral-900/30" : "bg-transparent",
          isLongPressing && "z-50" // 长按时提高z-index
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
                "py-3 px-4 rounded-2xl relative transition-all duration-200",
                message.role === "assistant" 
                  ? "bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-white border border-blue-800/30" 
                  : "bg-blue-500/20 backdrop-blur-sm text-white border border-blue-500/30",
                // 长按时的视觉效果
                isLongPressing && message.role === "user" && "scale-110 shadow-xl border-blue-500/70 z-50 relative brightness-125 bg-blue-500/40 ring-2 ring-blue-400/50"
              )}
            >
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