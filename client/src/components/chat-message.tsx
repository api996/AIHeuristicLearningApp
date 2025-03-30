import { cn } from "@/lib/utils";
import { Brain, User } from "lucide-react";

interface ChatMessageProps {
  message: {
    role: "user" | "assistant";
    content: string;
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  // Check if the message contains an image markdown
  const isImage = message.content.startsWith("![");

  // Parse image URL if it's an image message
  const imageUrl = isImage ? 
    message.content.match(/\((.*?)\)/)?.[1] : null;

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
            renderContent(message.content)
          )}
        </div>
      </div>
    </div>
  );
}