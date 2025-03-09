import { useEffect } from "react";
import { useLocation } from "wouter";
import { VercelV0Chat } from "@/components/ui/v0-ai-chat";

export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      setLocation("/login");
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-black">
      <VercelV0Chat />
    </div>
  );
}