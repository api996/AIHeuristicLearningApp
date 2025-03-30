import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AIChat } from "@/components/ui/ai-chat";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, User, Settings, UserX, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const [userData, setUserData] = useState<{userId: number; username: string; role: string} | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      console.log('[Home] No user session found, redirecting to login');
      setLocation("/login");
      return;
    }

    try {
      const parsedUserData = JSON.parse(user);
      if (!parsedUserData.userId) {
        console.log('[Home] Invalid user data, redirecting to login');
        localStorage.removeItem("user");
        setLocation("/login");
        return;
      }
      setUserData(parsedUserData);
    } catch (e) {
      console.error('[Home] Error parsing user data:', e);
      localStorage.removeItem("user");
      setLocation("/login");
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  const handleDeleteAccount = async () => {
    if (!userData) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userData.userId}?userId=${userData.userId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "账号已删除",
          description: "您的账号已成功删除",
        });
        
        // 自动登出
        setTimeout(() => {
          localStorage.removeItem("user");
          setLocation("/login");
        }, 1500);
      } else {
        toast({
          variant: "destructive",
          title: "操作失败",
          description: result.message || "删除账号失败，请稍后重试",
        });
      }
    } catch (error) {
      console.error("[Home] Error deleting account:", error);
      toast({
        variant: "destructive",
        title: "服务器错误",
        description: "删除账号失败，请稍后重试",
      });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleChangePassword = async () => {
    if (!userData) return;
    
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "密码不匹配",
        description: "新密码与确认密码不一致",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData.userId,
          currentPassword: password,
          newPassword
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "密码已更新",
          description: "您的密码已成功修改",
        });
        setIsPasswordDialogOpen(false);
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({
          variant: "destructive",
          title: "操作失败",
          description: result.message || "修改密码失败，请稍后重试",
        });
      }
    } catch (error) {
      console.error("[Home] Error changing password:", error);
      toast({
        variant: "destructive",
        title: "服务器错误",
        description: "修改密码失败，请稍后重试",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 只有在userData加载完成时才渲染
  if (!userData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      {/* 头部用户菜单 */}
      <header className="fixed top-0 right-0 p-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-neutral-800 hover:bg-neutral-700">
              <User className="h-5 w-5 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-700">
            <DropdownMenuLabel className="text-white">{userData.username}</DropdownMenuLabel>
            
            <DropdownMenuItem 
              onClick={() => setIsPasswordDialogOpen(true)} 
              className="text-white hover:bg-neutral-800 cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              修改密码
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => setIsDeleteDialogOpen(true)} 
              className="text-red-500 hover:bg-neutral-800 cursor-pointer"
            >
              <UserX className="mr-2 h-4 w-4" />
              删除账号
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="text-white hover:bg-neutral-800 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* 主要内容 */}
      <AIChat />

      {/* 删除账号确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
              确认删除账号
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              此操作将永久删除您的账号和所有聊天记录，此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              className="text-white border-neutral-700 hover:bg-neutral-800"
            >
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={isLoading}
            >
              {isLoading ? "处理中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改密码对话框 */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">修改密码</DialogTitle>
            <DialogDescription className="text-neutral-400">
              请输入您的当前密码和新密码。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-password" className="text-white">当前密码</Label>
              <Input 
                id="current-password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-password" className="text-white">新密码</Label>
              <Input 
                id="new-password" 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-white">确认新密码</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsPasswordDialogOpen(false)}
              className="text-white border-neutral-700 hover:bg-neutral-800"
            >
              取消
            </Button>
            <Button 
              onClick={handleChangePassword}
              disabled={isLoading || !password || !newPassword || !confirmPassword}
            >
              {isLoading ? "处理中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}