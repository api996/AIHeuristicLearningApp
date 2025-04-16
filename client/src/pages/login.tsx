import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { TurnstileWidget } from "@/components/ui/turnstile";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [developerPassword, setDeveloperPassword] = useState("");

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

  // Turnstile验证失败的计数器
  const turnstileErrorCount = useRef(0);
  const [turnstileBypass, setTurnstileBypass] = useState(false);

  // 检查是否为开发环境
  const isDevelopmentEnv = () => {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('.repl.co');
  };

  // 验证Turnstile令牌
  const verifyTurnstileToken = async (token: string) => {
    try {
      console.log('[Login] 正在验证Turnstile令牌');

      // 先验证令牌
      const response = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      if (data.success) {
        console.log('[Login] Turnstile验证成功');
        // 只有在验证成功后才设置令牌
        setTurnstileToken(token);
        setError(""); // 清除可能存在的错误
        return true;
      } else {
        console.error('[Login] Turnstile验证失败:', data.message);
        // 增加错误计数
        turnstileErrorCount.current += 1;

        // 如果连续三次失败且在开发环境中，允许跳过验证
        if (turnstileErrorCount.current >= 3 && isDevelopmentEnv()) {
          console.log('[Login] 开发环境下允许跳过验证');
          setTurnstileBypass(true);
          // 生成一个假的令牌用于绕过前端验证，但后端仍会校验
          setTurnstileToken("bypass-token");
          setError("");
          return true;
        }

        setError(data.message || "人机验证失败，请重试");
        return false;
      }
    } catch (err) {
      console.error('[Login] Turnstile验证错误:', err);
      // 增加错误计数
      turnstileErrorCount.current += 1;

      // 如果连续三次失败且在开发环境中，允许跳过验证
      if (turnstileErrorCount.current >= 3 && isDevelopmentEnv()) {
        console.log('[Login] 开发环境下允许跳过验证（连接错误）');
        setTurnstileBypass(true);
        setTurnstileToken("bypass-token");
        setError("");
        return true;
      }

      setError("验证服务暂时不可用，请重试");
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

    // 开发者模式特殊处理
    if (isDeveloperMode) {
      if (!developerPassword) {
        setError("请输入开发者密码");
        return;
      }

      setIsVerifying(true);

      try {
        console.log('[Login] Starting developer authentication process');
        const response = await fetch('/api/developer-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            username, 
            password, 
            developerPassword 
          }),
        });

        if (!response.ok) {
          console.error('[Login] 开发者验证HTTP错误:', response.status);
          throw new Error(`HTTP错误 ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          console.log('[Login] 开发者验证成功，用户ID:', data.userId);
          const userData = {
            userId: data.userId,
            role: data.role,
            username: username
          };
          localStorage.setItem("user", JSON.stringify(userData));

          // 添加会话标记，用于后续API请求
          sessionStorage.setItem("developer_mode_verified", "true");

          if (data.role === 'admin') {
            setLocation("/admin");
          } else {
            setLocation("/");
          }
        } else {
          console.error('[Login] 开发者验证失败:', data.message);
          setError(data.message || "开发者验证失败");
        }
      } catch (err) {
        console.error('[Login] Developer authentication error:', err);
        setError("服务器错误，请稍后重试");
      } finally {
        setIsVerifying(false);
      }
      return;
    }

    // 正常模式需要人机验证
    if (!turnstileToken) {
      setError("请完成人机验证");
      return;
    }

    setIsVerifying(true);

    try {
      console.log('[Login] Starting authentication process');
      const endpoint = isRegistering ? '/api/register' : '/api/login';

      // 构建请求体，注册时包含确认密码
      const requestBody = isRegistering 
        ? { username, password, confirmPassword, turnstileToken }
        : { username, password, turnstileToken };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

          {/* 开发者模式切换 */}
          <div className="flex items-center justify-end space-x-2 my-4">
            <Label htmlFor="developer-mode" className="text-white cursor-pointer">
              开发者模式
            </Label>
            <Switch
              id="developer-mode"
              checked={isDeveloperMode}
              onCheckedChange={setIsDeveloperMode}
            />
          </div>

          {/* 开发者密码输入框 */}
          {isDeveloperMode && (
            <div className="input-box relative w-full my-[30px] border-b-2 border-white">
              <i className="fas fa-code icon absolute right-2 text-white text-lg top-1/2 -translate-y-1/2"></i>
              <input
                type="password"
                value={developerPassword}
                onChange={(e) => setDeveloperPassword(e.target.value)}
                className="w-full h-[50px] bg-transparent outline-none border-none text-base text-white px-[5px] pr-[40px]"
                required={isDeveloperMode}
              />
              <label className="absolute top-1/2 left-[5px] -translate-y-1/2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:-top-[5px] peer-valid:-top-[5px]">
                管理员密码
              </label>
            </div>
          )}

          {/* 开发者模式说明 */}
          {isDeveloperMode && (
            <div className="text-xs text-blue-300 mt-1 italic">
              使用开发者密码验证后，将在此会话中跳过后续的人机验证。<br/>
              注意：使用此模式登录时，若用户不存在将自动创建普通用户账户。
            </div>
          )}

          {/* 在非开发者模式下显示人机验证 */}
          {!isDeveloperMode && (
            <div className="space-y-2 mt-4">
              {turnstileBypass ? (
                <Alert className="bg-blue-900 border-blue-700 text-white">
                  <AlertCircle className="h-4 w-4 text-blue-300" />
                  <AlertDescription className="text-sm">
                    人机验证已绕过。您现在可以继续登录或注册。
                  </AlertDescription>
                </Alert>
              ) : (
                <TurnstileWidget 
                  onVerify={verifyTurnstileToken}
                  onError={() => {
                    turnstileErrorCount.current += 1;
                    if (turnstileErrorCount.current >= 3) {
                      setTurnstileBypass(true);
                      setTurnstileToken("bypass-token");
                      setError("");
                    } else {
                      setError("人机验证加载失败，请刷新页面重试");
                    }
                  }}
                />
              )}
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center mt-2">{error}</div>
          )}

          <button 
            type="submit" 
            className="btn w-full h-[40px] bg-white outline-none border-none rounded-[40px] cursor-pointer text-base font-medium text-black mt-[20px] hover:bg-[#ffffea]"
            disabled={isVerifying || (!isDeveloperMode && !turnstileToken)}
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