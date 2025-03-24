import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Brain, Shield } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 检查是否已登录
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      if (userData.role === 'admin') {
        setLocation("/admin");
      } else {
        setLocation("/");
      }
    }
  }, [setLocation]);

  useEffect(() => {
    // 加载 Turnstile 脚本
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // 设置 Turnstile 回调
  useEffect(() => {
    // @ts-ignore
    window.onTurnstileSuccess = (token: string) => {
      console.log("Turnstile 验证成功");
      setTurnstileToken(token);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 表单验证
      if (!username || !password) {
        throw new Error("请填写用户名和密码");
      }

      if (!turnstileToken) {
        throw new Error("请完成人机验证");
      }

      if (isRegistering && password !== confirmPassword) {
        throw new Error("两次输入的密码不一致");
      }

      // 发送登录/注册请求
      const endpoint = isRegistering ? "/api/register" : "/api/login";
      console.log(`尝试${isRegistering ? '注册' : '登录'}用户: ${username}`);

      const response = await apiRequest("POST", endpoint, {
        username,
        password,
        turnstileToken
      });

      const data = await response.json();
      console.log("服务器响应:", data);

      if (data.success) {
        localStorage.setItem("user", JSON.stringify({
          userId: data.userId,
          role: data.role
        }));

        // 根据角色重定向
        if (data.role === "admin") {
          setLocation("/admin");
        } else {
          setLocation("/");
        }
      } else {
        setError(data.message || "认证失败");
      }
    } catch (error) {
      console.error("认证错误:", error);
      setError(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* 左侧 - 应用介绍 */}
      <div className="hidden lg:flex lg:w-1/2 bg-neutral-900 flex-col justify-center px-12">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white">
            AI 智能助手平台
          </h1>
          <p className="text-xl text-neutral-400">
            探索多模型智能对话，体验顶尖AI技术
          </p>
          <div className="grid grid-cols-1 gap-4 mt-8">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-neutral-800 rounded-lg">
                <Brain className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium text-white">多模型支持</h3>
                <p className="text-sm text-neutral-400">
                  支持多种AI模型，满足不同场景需求
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-neutral-800 rounded-lg">
                <MessageSquare className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-medium text-white">实时对话</h3>
                <p className="text-sm text-neutral-400">
                  流畅的实时对话体验，快速响应
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-neutral-800 rounded-lg">
                <Shield className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-medium text-white">安全可靠</h3>
                <p className="text-sm text-neutral-400">
                  严格的安全防护，保护您的隐私
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧 - 登录表单 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-[400px] bg-neutral-900 text-white border-neutral-800">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {isRegistering ? "创建账户" : "欢迎回来"}
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
                  placeholder="请输入用户名"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">密码</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                  placeholder="请输入密码"
                  disabled={isLoading}
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
                    placeholder="请再次输入密码"
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* 显式的Turnstile容器 */}
              <div 
                id="turnstile-container" 
                className="cf-turnstile mt-4 flex justify-center"
                data-sitekey="1x00000000000000000000AA"
                data-callback="onTurnstileSuccess"
              ></div>

              {error && (
                <div className="text-red-500 text-sm text-center">{error}</div>
              )}

              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "处理中..." : (isRegistering ? "注册" : "登录")}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-sm text-neutral-400 hover:text-white"
                  onClick={() => setIsRegistering(!isRegistering)}
                  disabled={isLoading}
                >
                  {isRegistering ? "已有账号？去登录" : "没有账号？去注册"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}