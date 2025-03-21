import { cn } from "@/lib/utils";

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

  return (
    <div className={cn(
      "flex",
      message.role === "user" ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] rounded-lg px-4 py-2",
        message.role === "user" 
          ? "bg-blue-600" 
          : "bg-neutral-800"
      )}>
        {isImage && imageUrl ? (
          <img 
            src={imageUrl} 
            alt="Uploaded" 
            className="max-w-full rounded"
          />
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}