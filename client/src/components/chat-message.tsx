import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: {
    role: "user" | "assistant";
    content: string;
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={cn(
      "flex",
      message.role === "user" ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] rounded-lg px-4 py-2 text-white",
        message.role === "user" 
          ? "bg-blue-600" 
          : "bg-zinc-700"
      )}>
        {message.content}
      </div>
    </div>
  );
}