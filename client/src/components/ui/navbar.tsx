import * as React from "react";
import { Link, useLocation } from "wouter";
import { Home, BookOpen, Library, Network, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Navbar: React.FC = () => {
  const { userId, role, logout } = useAuth();
  const [location] = useLocation();

  // 定义导航项
  const navItems = React.useMemo(() => {
    const items = [
      { href: "/", label: "聊天", icon: Home },
      { href: "/learning-path", label: "学习轨迹", icon: BookOpen },
      { href: "/memory-space", label: "记忆空间", icon: Library },
      { href: "/memory-graph", label: "知识图谱", icon: Network },
    ];
    
    // 如果是管理员，添加管理页面
    if (userId && role === "admin") {
      items.push({ href: "/admin", label: "管理", icon: Settings });
    }
    
    return items;
  }, [userId, role]);

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">
              AI学习助手
            </span>
          </Link>
          <div className="flex items-center space-x-4 text-sm font-medium">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <div className="hidden md:flex"></div>
          </div>
          <div className="flex items-center gap-2">
            {userId ? (
              <Button
                variant="ghost"
                size="sm"
                className="px-3"
                onClick={() => logout()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                登出
              </Button>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  登录
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};