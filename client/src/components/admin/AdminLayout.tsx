import { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  AppWindow,
  Users,
  MessageSquare,
  Settings,
  Shield,
  ThumbsUp,
  GraduationCap,
  LogOut,
  Home,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// 定义侧边栏导航项
const sidebarItems = [
  { id: "dashboard", label: "控制面板", icon: <Home /> },
  { id: "security", label: "安全设置", icon: <Shield /> },
  { id: "feedback", label: "反馈分析", icon: <ThumbsUp /> },
  { id: "prompts", label: "提示词模板", icon: <MessageSquare /> },
  { id: "moderation", label: "内容审查", icon: <AlertCircle /> },
  { id: "student-agent", label: "学生智能体", icon: <GraduationCap /> },
  { id: "system", label: "系统设置", icon: <Settings /> },
];

export function AdminLayout({ children, activeTab, onTabChange }: AdminLayoutProps) {
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  // 检测是否为移动设备
  const isMobile = window.innerWidth < 768;

  return (
    <div className="flex min-h-screen bg-neutral-950 text-white admin-layout">
      {/* 侧边栏 - 在移动设备上隐藏 */}
      <aside className={cn(
        "w-64 border-r border-neutral-800 bg-neutral-900 hidden md:block",
        "fixed h-screen z-20"
      )}>
        <div className="px-3 py-4 flex flex-col h-full">
          {/* 标题 */}
          <div className="flex items-center gap-2 px-3 py-4">
            <AppWindow className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-white">管理控制台</h1>
          </div>

          {/* 导航链接 */}
          <ScrollArea className="flex-1 px-1 py-4">
            <div className="space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-3 rounded-md text-sm transition-colors",
                    activeTab === item.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  )}
                >
                  <span className={cn(
                    "h-5 w-5",
                    activeTab === item.id ? "text-primary" : "text-neutral-400"
                  )}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* 底部登出按钮 */}
          <div className="mt-auto pt-4 border-t border-neutral-800">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-md text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className={cn(
        "flex-1 min-h-screen",
        "md:ml-64" // 为侧边栏腾出空间
      )}>
        {/* 移动设备顶部导航 */}
        <header className="md:hidden sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800 py-3 px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AppWindow className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">管理控制台</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-red-400 hover:text-red-300 p-1"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {/* 移动设备标签选择器 */}
        {isMobile && (
          <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 overflow-x-auto scrollbar-hide">
            <div className="flex space-x-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "flex items-center gap-1 px-3 py-2 rounded-md text-xs whitespace-nowrap transition-colors",
                    activeTab === item.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  )}
                >
                  <span className="h-3.5 w-3.5">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 内容区 */}
        <div className="p-4 md:p-6 pb-20">
          {children}
        </div>
      </main>
    </div>
  );
}