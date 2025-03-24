import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Brain, Shield } from "lucide-react";
import { toast } from "@/components/ui/use-toast";


export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    // Check if already logged in
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === "admin") {
        setLocation("/admin");
      } else {
        setLocation("/");
      }
    }
  }, [setLocation]);

  useEffect(() => {
    // Load Turnstile script
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // Monitor Turnstile load status
  useEffect(() => {
    const checkTurnstileLoaded = setInterval(() => {
      if (window.grecaptcha) { // Assuming grecaptcha is available after Turnstile loads
        setTurnstileLoaded(true);
        clearInterval(checkTurnstileLoaded);
      }
    }, 500);

    return () => clearInterval(checkTurnstileLoaded);
  }, []);

  useEffect(() => {
    // Set Turnstile callback
    window.onTurnstileSuccess = (token: string) => {
      console.log("Turnstile verification successful");
      setTurnstileToken(token);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Form validation
      if (!username || !password) {
        throw new Error("Please fill in username and password");
      }

      if (!turnstileToken) {
        throw new Error("Please complete the CAPTCHA");
      }

      if (isRegistering && password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      // Send login/register request
      const endpoint = isRegistering ? "/api/register" : "/api/login";
      console.log(`Attempting to ${isRegistering ? 'register' : 'login'} user: ${username}`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password, turnstileToken }),
      });

      const data = await response.json();
      console.log("Server response:", data);

      if (response.ok && data.success) {
        localStorage.setItem("user", JSON.stringify({ userId: data.userId, role: data.role }));
        if (data.role === "admin") {
          setLocation("/admin");
        } else {
          setLocation("/");
        }
      } else {
        setError(data.message || "Authentication failed");
        if (turnstileRef.current) {
          // Reset CAPTCHA if failed
          // Assuming a reset method is available on the turnstile element.  This might need adjustment based on the specific Turnstile implementation.
          turnstileRef.current.reset();
        }

      }
    } catch (error) {
      console.error("Authentication error:", error);
      setError(error instanceof Error ? error.message : "Operation failed, please try again later");
      // Reset CAPTCHA if failed
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left - App Introduction */}
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

      {/* Right - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-[400px] bg-neutral-900 text-white border-neutral-800">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {isRegistering ? "Create Account" : "Welcome Back"}
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

              <div className="flex justify-center my-4">
                <div
                  ref={turnstileRef}
                  className="cf-turnstile"
                  data-sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  data-callback="onTurnstileSuccess"
                ></div>
              </div>

              {error && (
                <div className="text-red-500 text-sm text-center">{error}</div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Processing..." : (isRegistering ? "Register" : "Login")}
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