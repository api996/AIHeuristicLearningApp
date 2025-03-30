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

  // 思考中动画组件
  const ThinkingAnimation = () => (
    <div className="flex items-center space-x-2 mt-2 h-6">
      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "0ms" }}></div>
      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "300ms" }}></div>
      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "600ms" }}></div>
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
      "flex w-full max-w-3xl mx-auto group",
      message.role === "assistant" ? "bg-neutral-900/50" : "bg-transparent"
    )}>
      <div className="flex items-start gap-4 px-4 py-6 w-full">
        {message.role === "assistant" ? (
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-sm mt-0.5">
            <Brain className="h-4 w-4 text-white" />
          </div>
        ) : (
          <div className="bg-blue-600 p-1.5 rounded-sm mt-0.5">
            <User className="h-4 w-4 text-white" />
          </div>
        )}
        
        <div className="flex-1 overflow-hidden">
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
                    <span className="inline-block h-4 w-1 bg-blue-400 animate-pulse ml-0.5 align-middle"></span>
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