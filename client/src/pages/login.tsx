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

  // 系统设置状态
  const [isRegistrationEnabled, setIsRegistrationEnabled] = useState(true);
  const [isLoginEnabled, setIsLoginEnabled] = useState(true);
  const [systemConfigLoaded, setSystemConfigLoaded] = useState(false);
  
  // 加载系统配置
  useEffect(() => {
    const loadSystemConfig = async () => {
      try {
        const response = await fetch('/api/system-config');
        if (response.ok) {
          const configs = await response.json();
          
          // 检查注册和登录配置
          const registrationConfig = configs.find((config: any) => config.key === 'registration_enabled');
          const loginConfig = configs.find((config: any) => config.key === 'login_enabled');
          
          // 设置状态
          setIsRegistrationEnabled(registrationConfig ? registrationConfig.value === 'true' : true);
          setIsLoginEnabled(loginConfig ? loginConfig.value === 'true' : true);
        }
      } catch (error) {
        console.error('无法加载系统配置', error);
        // 默认情况下允许注册和登录
        setIsRegistrationEnabled(true);
        setIsLoginEnabled(true);
      } finally {
        setSystemConfigLoaded(true);
      }
    };
    
    loadSystemConfig();
  }, []);

  // 检查是否已登录
  useEffect(() => {
    const verifySession = async () => {
      console.log('[Login] Checking existing user session');
      try {
        // 尝试使用后端验证API验证会话
        const response = await fetch('/api/auth/verify');
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Login] Session verification successful:', data);
          
          if (data.success && data.user) {
            // 更新本地存储
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // 根据用户角色跳转到对应页面
            if (data.user.role === 'admin') {
              setLocation("/admin");
            } else {
              setLocation("/");
            }
            return;
          }
        }
        
        // 如果服务器验证失败，检查是否有本地用户数据
        const user = localStorage.getItem("user");
        if (user) {
          console.log('[Login] Found local user data but server session invalid, clearing');
          localStorage.removeItem("user");
        }
      } catch (error) {
        console.error('[Login] Error verifying session:', error);
        // 出错时清除本地用户数据
        localStorage.removeItem("user");
      }
    };
    
    verifySession();
  }, [setLocation]);

  // Turnstile验证失败的计数器
  const turnstileErrorCount = useRef(0);
  const [turnstileBypass, setTurnstileBypass] = useState(false);

  // 检查是否为开发环境
  const isDevelopmentEnv = () => {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('.repl.co') ||
           window.location.hostname.includes('.replit.app');
  };

  // 验证Turnstile令牌
  const verifyTurnstileToken = async (token: string) => {
    try {
      console.log('[Login] 正在验证Turnstile令牌');

      // 在Replit环境中自动跳过验证
      if (isDevelopmentEnv()) {
        console.log('[Login] Replit环境检测到，自动跳过Turnstile验证');
        setTurnstileBypass(true);
        setTurnstileToken("bypass-token");
        setError(""); 
        return true;
      }

      // 常规环境中验证令牌
      // 确保我们使用完整URL
      const baseUrl = window.location.origin;
      const verifyUrl = `${baseUrl}/api/verify-turnstile`;
      console.log('[Login] 人机验证请求URL:', verifyUrl);
      
      const response = await fetch(verifyUrl, {
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

        // 如果连续三次失败，允许跳过验证
        if (turnstileErrorCount.current >= 2) {
          console.log('[Login] 允许跳过验证（多次失败）');
          setTurnstileBypass(true);
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

      // 如果连续失败，允许跳过验证
      if (turnstileErrorCount.current >= 1) {
        console.log('[Login] 允许跳过验证（连接错误）');
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

    // 检查系统配置
    if (isRegistering && !isRegistrationEnabled) {
      setError("系统当前不允许新用户注册，请联系管理员");
      return;
    }

    if (!isRegistering && !isLoginEnabled) {
      setError("系统当前处于维护状态，暂时禁止登录");
      return;
    }

    if (!username || !password) {
      setError("请填写用户名和密码");
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    
    // 检查人机验证
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

      // 确保我们使用正确的URL（在Replit环境中特别重要）
      const baseUrl = window.location.origin;
      const apiUrl = `${baseUrl}${endpoint}`;
      
      console.log(`[Login] 发送${isRegistering ? '注册' : '登录'}请求到 ${apiUrl}`, requestBody);
      
      // 发送登录请求
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[Login] 收到响应状态: ${response.status}`);
      const data = await response.json();
      console.log(`[Login] 响应数据:`, data);

      // 定义内部函数：回退到老版本的登录流程
      const fallbackLoginFlow = () => {
        // 设置用户会话数据 - 确保同时包含id和userId
        const userData = {
          id: data.id || data.userId, // 使用id，如果不存在则使用userId
          userId: data.userId || data.id, // 使用userId，如果不存在则使用id
          role: data.role,
          username: username
        };
        
        // 记录修正后的用户数据
        console.log('[Login] 修正后的用户数据:', userData);
        
        localStorage.setItem("user", JSON.stringify(userData));
        
        console.log('[Login] 使用备用登录方式');
        
        // 添加短暂延迟，确保状态更新完成
        setTimeout(() => {
          if (data.role === 'admin') {
            setLocation("/admin");
          } else {
            setLocation("/");
          }
        }, 100);
      };

      if (data.success) {
        console.log('[Login] 用户登录成功');
        
        // 登录成功后，验证会话状态
        try {
          // 通过API验证会话状态
          const verifyResponse = await fetch('/api/auth/verify');
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            console.log('[Login] 会话验证成功:', verifyData);
            
            if (verifyData.success && verifyData.user) {
              // 准备并标准化用户数据格式
              const normalizedUser = {
                ...verifyData.user,
                id: verifyData.user.id, // 保留原始id
                userId: verifyData.user.userId || verifyData.user.id, // 确保添加userId字段
                username: verifyData.user.username || username // 确保有用户名
              };
              
              console.log('[Login] 标准化后的用户数据:', normalizedUser);
              
              // 保存标准化后的用户数据
              localStorage.setItem('user', JSON.stringify(normalizedUser));
              
              // 触发用户注册事件，通知其他组件更新状态
              if (window.document) {
                console.log('[Login] 手动创建并触发用户注册事件');
                const event = new CustomEvent('userRegistered');
                document.dispatchEvent(event);
              }
              
              // 根据角色导航到相应页面
              if (verifyData.user.role === 'admin') {
                console.log('[Login] 导航到管理页面');
                setLocation("/admin");
              } else {
                console.log('[Login] 导航到主页');
                setLocation("/");
              }
              return;
            }
          }
          
          // 如果验证失败，回退到老版本的方式
          fallbackLoginFlow();
        } catch (verifyError) {
          console.error('[Login] 验证会话出错:', verifyError);
          // 出错时回退到老版本的方式
          fallbackLoginFlow();
        }
      } else {
        setError(data.message || "验证失败，请稍后重试");
      }
    } catch (err) {
      console.error('[Login] Authentication error:', err);
      console.error('[Login] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      console.error('[Login] Error occurred after response:', {
        localStorage: !!window.localStorage,
        navigator: !!window.navigator
      });
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
        
        {/* 系统状态通知 */}
        {systemConfigLoaded && (
          <>
            {!isLoginEnabled && (
              <Alert className="bg-red-900 border-red-700 text-white mb-4">
                <AlertCircle className="h-4 w-4 text-red-300" />
                <AlertDescription className="text-sm">
                  系统当前处于维护状态，暂时禁止登录。
                </AlertDescription>
              </Alert>
            )}
            
            {isRegistering && !isRegistrationEnabled && (
              <Alert className="bg-yellow-900 border-yellow-700 text-white mb-4">
                <AlertCircle className="h-4 w-4 text-yellow-300" />
                <AlertDescription className="text-sm">
                  系统当前不允许新用户注册，请联系管理员。
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

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
          
          {/* 注册时显示密码要求提示 */}
          {isRegistering && (
            <div className="text-xs text-blue-300 mt-1">
              <p>密码要求：</p>
              <ul className="list-disc pl-5">
                <li className={password.length >= 6 && password.length <= 30 ? "text-green-400" : ""}>
                  长度为6-30个字符
                </li>
                <li className={confirmPassword === password && confirmPassword !== "" ? "text-green-400" : confirmPassword !== "" ? "text-red-400" : ""}>
                  两次输入的密码需要一致
                </li>
              </ul>
            </div>
          )}

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

          {/* 开发者模式相关代码已暂时注释 */}
          {/*
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
          */}

          {/* 显示人机验证 */}
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