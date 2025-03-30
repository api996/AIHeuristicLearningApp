
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TurnstileWidget } from "@/components/ui/turnstile";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [isVerifying, setIsVerifying] = useState(false);

  // 检查是否已登录
  useEffect(() => {
    console.log('[Login] Checking existing user session');
    const user = localStorage.getItem("user");
    if (user) {
      console.log('[Login] Found existing user session');
      const userData = JSON.parse(user);
      if (userData.role === 'admin') {
        setLocation("/admin");
      } else {
        setLocation("/");
      }
    }
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!turnstileToken) {
      setError("请完成人机验证");
      return;
    }

    if (isRegistering) {
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
    }

    setIsVerifying(true);

    try {
      console.log('[Login] Starting authentication');
      
      // 验证 Turnstile 令牌
      const verifyResponse = await apiRequest({
        method: "POST",
        url: "/api/verify-turnstile",
        data: { token: turnstileToken },
      });

      if (!verifyResponse.success) {
        setError("人机验证失败，请刷新页面重试");
        return;
      }

      // 根据状态调用登录或注册 API
      const authResponse = await apiRequest({
        method: "POST",
        url: isRegistering ? "/api/register" : "/api/login",
        data: { username, password },
      });

      if (authResponse.success) {
        console.log('[Login] Authentication successful');
        localStorage.setItem("user", JSON.stringify({
          userId: authResponse.userId,
          username,
          role: authResponse.role,
        }));
        
        if (authResponse.role === 'admin') {
          setLocation("/admin");
        } else {
          setLocation("/");
        }
      } else {
        console.error('[Login] Authentication failed:', authResponse.message);
        setError(authResponse.message || "认证失败，请稍后重试");
      }
    } catch (error) {
      console.error('[Login] Error during auth:', error);
      setError("认证失败，请稍后重试");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-neutral-950 to-neutral-900">
      <Card className="w-[380px] bg-neutral-900 text-white border-neutral-800 shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            {isRegistering ? "创建账户" : "登录系统"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">用户名</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-neutral-800 border-neutral-700 focus:border-primary"
                disabled={isVerifying}
                placeholder="请输入用户名"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700 focus:border-primary"
                disabled={isVerifying}
                placeholder="请输入密码"
                required
              />
            </div>
            
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-sm font-medium">确认密码</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 focus:border-primary"
                  disabled={isVerifying}
                  placeholder="请再次输入密码"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <TurnstileWidget 
                onVerify={setTurnstileToken}
                onError={() => setError("人机验证加载失败，请刷新页面重试")}
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 transition-colors"
              disabled={isVerifying || !turnstileToken}
            >
              {isVerifying ? "验证中..." : (isRegistering ? "注册" : "登录")}
            </Button>

            <div className="text-center pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-sm text-neutral-400 hover:text-white"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError("");
                }}
                disabled={isVerifying}
              >
                {isRegistering ? "已有账号？去登录" : "没有账号？去注册"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
