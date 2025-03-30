
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { TurnstileWidget } from "@/components/ui/turnstile";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const [isVerifying, setIsVerifying] = useState(false);

  // 检查是否已登录
  useEffect(() => {
    console.log('[Login] Checking existing user session');
    const user = localStorage.getItem("user");
    if (user) {
      console.log('[Login] Found existing user session');
      try {
        const userData = JSON.parse(user);
        if (userData && userData.userId) {
          if (userData.role === 'admin') {
            setLocation("/admin");
          } else {
            setLocation("/");
          }
        } else {
          console.log('[Login] Invalid user data, clearing');
          localStorage.removeItem("user");
        }
      } catch (e) {
        console.error('[Login] Error parsing user data:', e);
        localStorage.removeItem("user");
      }
    }
  }, [setLocation]);

  // 验证Turnstile令牌
  const verifyTurnstileToken = async (token: string) => {
    try {
      console.log('[Login] Verifying Turnstile token');
      const response = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('[Login] Turnstile verification successful');
        setTurnstileToken(token);
        return true;
      } else {
        console.error('[Login] Turnstile verification failed:', data.message);
        setError(data.message || "人机验证失败");
        setTurnstileToken(undefined);
        return false;
      }
    } catch (err) {
      console.error('[Login] Turnstile verification error:', err);
      setError("人机验证服务暂时不可用");
      setTurnstileToken(undefined);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("请填写用户名和密码");
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (!turnstileToken) {
      setError("请完成人机验证");
      return;
    }

    setIsVerifying(true);

    try {
      console.log('[Login] Starting authentication process');
      const endpoint = isRegistering ? '/api/register' : '/api/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          password, 
          turnstileToken 
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // 设置用户会话数据
        const userData = {
          userId: data.userId,
          role: data.role,
          username: username
        };
        localStorage.setItem("user", JSON.stringify(userData));
        
        // 根据角色导航到相应页面
        if (data.role === 'admin') {
          setLocation("/admin");
        } else {
          setLocation("/");
        }
      } else {
        setError(data.message || "验证失败，请稍后重试");
      }
    } catch (err) {
      console.error('[Login] Authentication error:', err);
      setError("服务器错误，请稍后重试");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#282a37" }}>
      <div className="wrapper relative w-[400px] bg-[#3e404d] border-2 border-white/50 rounded-[20px] flex flex-col items-center justify-center p-8 transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] hover:bg-[#46474e]">
        <h1 className="text-2xl font-bold text-white mb-4">
          {isRegistering ? "注册" : "登录"}
        </h1>
        
        <form onSubmit={handleSubmit} className="w-full">
          <div className="input-box relative w-full my-[30px] border-b-2 border-white">
            <i className="fas fa-user icon absolute right-2 text-white text-lg top-1/2 -translate-y-1/2"></i>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-[50px] bg-transparent outline-none border-none text-base text-white px-[5px] pr-[40px]"
              required
            />
            <label className="absolute top-1/2 left-[5px] -translate-y-1/2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:-top-[5px] peer-valid:-top-[5px]">
              用户名
            </label>
          </div>
          
          <div className="input-box relative w-full my-[30px] border-b-2 border-white">
            <i className="fas fa-lock icon absolute right-2 text-white text-lg top-1/2 -translate-y-1/2"></i>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-[50px] bg-transparent outline-none border-none text-base text-white px-[5px] pr-[40px]"
              required
            />
            <label className="absolute top-1/2 left-[5px] -translate-y-1/2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:-top-[5px] peer-valid:-top-[5px]">
              密码
            </label>
          </div>
          
          {isRegistering && (
            <div className="input-box relative w-full my-[30px] border-b-2 border-white">
              <i className="fas fa-lock icon absolute right-2 text-white text-lg top-1/2 -translate-y-1/2"></i>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-[50px] bg-transparent outline-none border-none text-base text-white px-[5px] pr-[40px]"
                required
              />
              <label className="absolute top-1/2 left-[5px] -translate-y-1/2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:-top-[5px] peer-valid:-top-[5px]">
                确认密码
              </label>
            </div>
          )}

          <div className="space-y-2 mt-4">
            <TurnstileWidget 
              onVerify={verifyTurnstileToken}
              onError={() => setError("人机验证加载失败，请刷新页面重试")}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center mt-2">{error}</div>
          )}

          <button 
            type="submit" 
            className="btn w-full h-[40px] bg-white outline-none border-none rounded-[40px] cursor-pointer text-base font-medium text-black mt-[20px] hover:bg-[#ffffea]"
            disabled={isVerifying || !turnstileToken}
          >
            {isVerifying ? "验证中..." : (isRegistering ? "注册" : "登录")}
          </button>

          <div className="signup-link text-sm text-white text-center mt-[25px] mb-[10px]">
            <p>
              {isRegistering ? "已有账号?" : "没有账号?"}{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegistering(!isRegistering);
                  setError("");
                }}
                className="text-white no-underline font-semibold hover:underline"
              >
                {isRegistering ? "登录" : "创建账号"}
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
