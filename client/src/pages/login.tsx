import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isRegistering && password !== confirmPassword) {
      setError("密码不匹配");
      return;
    }

    try {
      const endpoint = isRegistering ? "/api/register" : "/api/login";
      const response = await apiRequest("POST", endpoint, { username, password });
      const data = await response.json();

      if (data.success) {
        console.log("登录成功，用户信息:", data);
        localStorage.setItem("user", JSON.stringify({ 
          userId: data.userId,
          role: data.role 
        }));

        // Redirect admin users to dashboard, others to home
        if (data.role === "admin") {
          setLocation("/admin");
        } else {
          setLocation("/");
        }
      } else {
        setError(data.message || "认证失败");
      }
    } catch (error) {
      setError("操作失败，请稍后重试");
      console.error("Auth error:", error);
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
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">密码</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700"
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
                />
              </div>
            )}
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}
            <Button type="submit" className="w-full">
              {isRegistering ? "注册" : "登录"}
            </Button>
            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                className="text-sm text-neutral-400 hover:text-white"
                onClick={() => setIsRegistering(!isRegistering)}
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