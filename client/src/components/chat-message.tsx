import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Brain, User } from "lucide-react";

interface ChatMessageProps {
  message: {
    role: "user" | "assistant";
    content: string;
  };
  isThinking?: boolean; // 用于表示AI是否正在思考
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

export function ChatMessage({ message, isThinking = false }: ChatMessageProps) {
  // 对于AI回复使用打字机效果
  const { displayedText, completed } = useTypewriter(
    message.role === "assistant" ? message.content : "",
    20
  );

  // Check if the message contains an image markdown
  const isImage = message.content.startsWith("![");

  // Parse image URL if it's an image message
  const imageUrl = isImage ? 
    message.content.match(/\((.*?)\)/)?.[1] : null;

  // 思考过程状态列表
  const thinkingSteps = [
    "接收到您的问题...",
    "分析问题中...",
    "理解问题关键点...",
    "搜索相关知识...",
    "检索相关信息...",
    "整合可用信息...",
    "深入思考中...",
    "考虑不同角度...",
    "分析可能解释...",
    "评估最佳方案...",
    "反思中...",
    "优化答案...",
    "组织回答中...",
    "准备输出中..."
  ];
  
  // 跟踪思考步骤
  const [currentThinkingStep, setCurrentThinkingStep] = useState(0);
  
  // 更新思考步骤的效果
  useEffect(() => {
    if (!isThinking) return;
    
    const interval = setInterval(() => {
      setCurrentThinkingStep(prev => (prev + 1) % thinkingSteps.length);
    }, 1500); // 每1.5秒更新一次思考状态
    
    return () => clearInterval(interval);
  }, [isThinking, thinkingSteps.length]);
  
  // 增强的思考中动画组件
  const ThinkingAnimation = () => (
    <div className="mt-2 space-y-2">
      <div className="flex items-center space-x-3">
        <div className="flex space-x-1">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "0ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "300ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "600ms" }}></div>
        </div>
        <div className="text-blue-400 text-sm font-medium animate-pulse">
          {thinkingSteps[currentThinkingStep]}
        </div>
      </div>
      <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full animate-shimmer"
          style={{ 
            width: `${((currentThinkingStep + 1) / thinkingSteps.length) * 100}%`,
            backgroundSize: '200% 100%',
            transition: 'width 1s ease-in-out'
          }}
        ></div>
      </div>
    </div>
  );

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

  return (
    <div className={cn(
      "w-full max-w-3xl mx-auto px-4 py-2 message-appear",
      message.role === "assistant" ? "bg-neutral-900/30" : "bg-transparent"
    )}>
      {/* 实现左右交错布局 */}
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
        <div className={cn(
          "py-3 px-4 rounded-2xl",
          message.role === "assistant" 
            ? "bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-white border border-blue-800/30" 
            : "bg-blue-600 text-white"
        )}>
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
    </div>
  );
}