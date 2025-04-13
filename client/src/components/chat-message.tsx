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
    isRegenerating?: boolean; // 添加是否正在重新生成的状态
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
  
  // 重新生成回答 - 增强错误处理和可靠性
  const handleRegenerate = async () => {
    if (!onRegenerate || isThinking) return;
    
    try {
      // 无需检查消息ID是否存在，直接调用重新生成函数
      // 父组件会处理ID不存在的情况，查找最后一条AI消息
      console.log("重新生成请求 - 消息ID:", message.id || "未定义（将使用最后一条消息）");
      
      // 无论是否有ID都传递给父组件
      await onRegenerate(message.id);
    } catch (error) {
      // 更友好的错误处理
      console.error("重新生成回答失败:", error);
      
      toast({
        title: "重新生成失败",
        description: error instanceof Error 
          ? `错误: ${error.message}` 
          : "无法重新生成回答，请稍后再试",
        variant: "destructive",
        className: "frosted-toast-error" // 使用磨砂玻璃效果样式
      });
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

  // 长按手势和弹出菜单功能 - 重写以提高稳定性
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ right: 16, y: 0 });
  const messageRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 使用ref追踪定时器
  
  // 完全重构长按和菜单展示逻辑 - 彻底解决触摸事件问题
  useEffect(() => {
    // 防止重复触发的标记
    let longPressTriggered = false;
    
    // 显示消息菜单的函数 - 简化版本，由CSS控制居中对齐
    const showMenu = () => {
      console.log("触发长按菜单", message.role, message.content.substring(0, 20));
      
      // 防止重复触发
      if (longPressTriggered) return;
      longPressTriggered = true;
      
      // 先设置高亮状态
      setIsLongPressing(true);
      
      // 如果不是用户消息则退出
      if (!messageRef.current || message.role !== 'user') {
        longPressTriggered = false;
        return;
      }
      
      // 获取消息元素位置 - 只需要垂直位置
      const rect = messageRef.current.getBoundingClientRect();
      
      // 只设置Y轴坐标，X轴通过CSS居中控制
      setMenuPosition({
        right: 0, // 这个值不再使用
        y: rect.bottom + 10
      });
      
      // 提供触觉反馈（如果可用）
      try {
        if (navigator.vibrate) {
          navigator.vibrate([10]);
        }
      } catch (e) {
        console.log('触觉反馈不可用');
      }
      
      // 显示菜单 - 添加延迟以确保位置计算后再显示
      setTimeout(() => {
        setShowContextMenu(true);
        // 重置触发标记，但延迟一点以防止快速重复触发
        setTimeout(() => {
          longPressTriggered = false;
        }, 500);
      }, 10);
    };
    
    // 直接在元素上处理点击事件 - 桌面端使用
    const handleClicks = () => {
      if (message.role === 'user' && messageRef.current) {
        // 显式添加点击处理 - 这对移动设备非常重要
        messageRef.current.onclick = (e) => {
          // 仅处理双击事件
          if (e.detail === 2) {
            e.preventDefault();
            showMenu();
          }
        };
        
        // 右键点击处理
        messageRef.current.oncontextmenu = (e) => {
          if (message.role === 'user') {
            e.preventDefault();
            showMenu();
          }
        };
      }
    };
    
    // 长按触发逻辑 - 使用直接事件处理而不是addEventListener
    const setupLongPress = () => {
      if (!messageRef.current || message.role !== 'user') return;
      
      // 缓存开始位置用于检测移动
      let startX = 0;
      let startY = 0;
      
      // 超级简化的长按实现
      messageRef.current.ontouchstart = (e) => {
        // 阻止默认行为，避免弹出系统菜单
        // e.preventDefault();
        
        // 记录起始位置
        if (e.touches && e.touches[0]) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        }
        
        // 清除之前的计时器
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
        }
        
        // 设置新的长按计时器
        longPressTimerRef.current = setTimeout(() => {
          // 触发长按操作
          showMenu();
        }, 600); // 稍长的时间，确保是真实的长按
      };
      
      // 处理移动
      messageRef.current.ontouchmove = (e) => {
        if (!e.touches || !e.touches[0]) return;
        
        // 计算移动距离
        const diffX = Math.abs(e.touches[0].clientX - startX);
        const diffY = Math.abs(e.touches[0].clientY - startY);
        
        // 如果移动超过阈值，取消长按
        if (diffX > 5 || diffY > 5) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
          }
        }
      };
      
      // 处理触摸结束
      messageRef.current.ontouchend = () => {
        // 清除长按计时器
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
        }
      };
    };
    
    // 处理点击文档其他位置关闭菜单
    const handleDocumentClick = (e: MouseEvent) => {
      if (
        showContextMenu && 
        menuRef.current && 
        !menuRef.current.contains(e.target as Node)
      ) {
        setShowContextMenu(false);
        setTimeout(() => {
          setIsLongPressing(false);
          longPressTriggered = false;
        }, 100);
      }
    };
    
    // 安装所有事件处理器
    handleClicks();
    setupLongPress();
    document.addEventListener('click', handleDocumentClick);
    
    // 清理函数
    return () => {
      if (messageRef.current) {
        // 移除直接附加的处理器
        messageRef.current.onclick = null;
        messageRef.current.oncontextmenu = null;
        messageRef.current.ontouchstart = null;
        messageRef.current.ontouchmove = null;
        messageRef.current.ontouchend = null;
      }
      
      // 移除文档级处理器
      document.removeEventListener('click', handleDocumentClick);
      
      // 清除定时器
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [message.role, message.content, showContextMenu]);
  
  // 处理菜单项点击
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        toast({
          title: "已复制到剪贴板",
          duration: 2000,
        });
        // 关闭菜单同时取消高亮
        setShowContextMenu(false);
        setTimeout(() => {
          setIsLongPressing(false);
        }, 50);
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
      // 关闭菜单同时取消高亮
      setShowContextMenu(false);
      setTimeout(() => {
        setIsLongPressing(false);
      }, 50);
    }
  };

  return (
    <>
      {/* iOS风格上下文菜单 - 完全居中 */}
      {showContextMenu && (
        <div 
          className="fixed z-50 animate-fade-in pointer-events-auto left-1/2 -translate-x-1/2 w-[280px]"
          style={{ 
            top: `${menuPosition.y}px`,
            filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))'
          }}
          ref={menuRef}
        >
          {/* 向上的箭头指示，调整大小和定位，居中对齐 */}
          <div className="w-5 h-5 bg-neutral-900/90 rotate-45 mx-auto mt-[-10px] rounded-sm border-t border-l border-neutral-700/60 shadow-lg"></div>
          
          {/* 菜单内容 - 现代iOS风格菜单，使用半透明玻璃拟态效果，居中对齐 */}
          <div className="bg-neutral-900/90 backdrop-blur-xl text-white rounded-2xl overflow-hidden shadow-2xl animate-scale-in-menu border border-neutral-700/30 w-full mt-[-10px]">
            <div className="flex flex-col divide-y divide-neutral-700/30">
              <button
                onClick={handleCopyMessage}
                className="px-6 py-4 hover:bg-neutral-800/60 active:bg-neutral-800/80 transition-colors duration-150 flex items-center justify-between"
              >
                <span className="text-sm font-medium">复制</span>
                <Copy className="h-5 w-5 text-blue-400" />
              </button>
              
              <button
                onClick={handleEditMessage}
                className="px-6 py-4 hover:bg-neutral-800/60 active:bg-neutral-800/80 transition-colors duration-150 flex items-center justify-between"
              >
                <span className="text-sm font-medium">编辑</span>
                <Pencil className="h-5 w-5 text-blue-400" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 页面暗化遮罩 - 使用iOS 16+风格的背景模糊效果，但保持消息清晰可见 */}
      {showContextMenu && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-lg z-40 animate-fade-in"
          style={{ 
            backdropFilter: 'blur(14px)', 
            transition: 'backdrop-filter 0.3s ease-out' 
          }}
          onClick={() => {
            // 关闭菜单同时取消高亮
            setShowContextMenu(false);
            setTimeout(() => {
              setIsLongPressing(false);
            }, 50); // 小延迟确保菜单先消失
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
                "py-3 px-4 rounded-2xl relative transition-all duration-200 user-select-none",
                message.role === "assistant" 
                  ? "bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-white border border-blue-800/30" 
                  : "bg-blue-600/30 backdrop-blur-sm text-white border border-blue-500/40 shadow-md",
                // 长按时的视觉效果，使消息和菜单同时可见且更加突出
                isLongPressing && message.role === "user" && "scale-110 shadow-2xl border-blue-500/80 z-[60] relative brightness-130 bg-blue-600/40 ring-4 ring-blue-400/30 text-white font-medium focus:outline-none"
              )}
              style={{ 
                // 只对用户消息应用选择限制，避免影响输入框和AI消息的文本选择
                ...(message.role === "user" ? {
                  WebkitUserSelect: 'none', 
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none'
                } : {})
              }}
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