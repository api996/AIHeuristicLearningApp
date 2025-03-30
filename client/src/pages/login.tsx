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

    try {
      console.log('[Login] Starting authentication process');

      if (!turnstileToken) {
        setError("请完成人机验证");
        console.log('[Login] Missing turnstile token');
        return;
      }

      if (isRegistering && password !== confirmPassword) {
        setError("密码不匹配");
        return;
      }

      setIsVerifying(true);
      console.log('[Login] Verifying turnstile token');

      // First verify the turnstile token
      const verifyResponse = await apiRequest("POST", "/api/verify-turnstile", {
        token: turnstileToken
      });

      const verifyData = await verifyResponse.json();
      if (!verifyData.success) {
        setError("人机验证失败，请重试");
        console.log('[Login] Turnstile verification failed:', verifyData.message);
        return;
      }

      console.log('[Login] Turnstile verification successful, proceeding with authentication');

      // Then proceed with login/registration
      const endpoint = isRegistering ? "/api/register" : "/api/login";
      const response = await apiRequest("POST", endpoint, { username, password });
      const data = await response.json();

      if (data.success) {
        console.log('[Login] Authentication successful:', data);
        localStorage.setItem("user", JSON.stringify({ 
          userId: data.userId,
          role: data.role 
        }));

        if (data.role === "admin") {
          setLocation("/admin");
        } else {
          setLocation("/");
        }
      } else {
        setError(data.message || "认证失败");
        console.log('[Login] Authentication failed:', data.message);
      }
    } catch (error) {
      console.error('[Login] Error during authentication:', error);
      setError("操作失败，请稍后重试");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Card className="w-[350px] bg-neutral-900 text-white border-neutral-800">
        <CardHeader>
          <CardTitle className="text-center">
            {isRegistering ? "注册" : "登录"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">用户名</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-neutral-800 border-neutral-700"
                disabled={isVerifying}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">密码</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700"
                disabled={isVerifying}
              />
            </div>
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-sm">确认密码</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                  disabled={isVerifying}
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
              className="w-full"
              disabled={isVerifying || !turnstileToken}
            >
              {isVerifying ? "验证中..." : (isRegistering ? "注册" : "登录")}
            </Button>

            <div className="text-center">
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