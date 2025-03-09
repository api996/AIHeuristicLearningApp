import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login - in real app would validate with backend
    if (username === "admin" && password === "admin") {
      localStorage.setItem("user", JSON.stringify({ username }));
      setLocation("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Card className="w-[350px] bg-neutral-900 text-white border-neutral-800">
        <CardHeader>
          <CardTitle className="text-center">登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
            <Button type="submit" className="w-full">
              登录
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
