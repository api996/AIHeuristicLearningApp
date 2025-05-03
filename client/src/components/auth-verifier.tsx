import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

interface AuthVerifierProps {
  children: React.ReactNode;
}

/**
 * 认证验证器组件
 * 用于确保前端localStorage和后端session认证状态的一致性
 */
export function AuthVerifier({ children }: AuthVerifierProps) {
  const [, setLocation] = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 从本地存储读取用户信息
  const getUserFromStorage = () => {
    try {
      console.log('[AuthVerifier] 读取本地存储的用户数据');
      const storedUser = localStorage.getItem('user');
      
      // 如果没有用户数据，尝试读取备用存储位置
      if (!storedUser) {
        const backupUser = localStorage.getItem('userBackup');
        if (backupUser) {
          console.log('[AuthVerifier] 主数据丢失，尝试使用备用数据');
          localStorage.setItem('user', backupUser);
          return JSON.parse(backupUser);
        }
      }
      
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user && user.userId) {
            console.log(`[AuthVerifier] 在本地找到有效用户数据，ID=${user.userId}, 角色=${user.role}`);
            
            // 创建备份
            localStorage.setItem('userBackup', storedUser);
            
            return user;
          }
        } catch (parseError) {
          console.error('[AuthVerifier] 用户数据解析失败，尝试清除损坏数据:', parseError);
          localStorage.removeItem('user');
        }
      }
      
      console.log('[AuthVerifier] 本地未找到有效用户数据');
      return null;
    } catch (error) {
      console.error('[AuthVerifier] 读取用户数据出错:', error);
      return null;
    }
  };

  // 用户数据接口
  interface UserData {
    userId: number;
    username?: string;
    role?: string;
  }
  
  // 验证会话状态
  const verifySession = async (userData: UserData) => {
    // 返回true表示验证成功，false表示失败
    try {
      console.log('[AuthVerifier] 开始验证会话状态');
      
      // 防止无效用户数据
      if (!userData || !userData.userId) {
        console.error('[AuthVerifier] 请求参数无效，缺少有效的用户ID');
        return false;
      }
      
      // 设置请求超时，防止长时间等待
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      try {
        const response = await fetch(`/api/verify-session?userId=${userData.userId}`, {
          credentials: 'include', // 确保发送cookie
          signal: controller.signal
        });
        
        // 清除超时定时器
        clearTimeout(timeoutId);
        
        // 请求失败，可能是网络问题
        if (!response.ok) {
          console.error(`[AuthVerifier] 会话验证请求失败: ${response.status} - ${response.statusText}`);
          
          // 如果是服务器错误，根据情况可能给予平滑退化
          if (response.status >= 500) {
            console.log('[AuthVerifier] 服务器错误，在1分钟后重试');
            // 服务器错误时不立即判定失败，并给予更长重试间隔
            // 当前返回成功，避免过度打断用户体验，延后重试
            setTimeout(ensureAuthConsistency, 60 * 1000); // 1分钟后重试
            return true; 
          }
          return false;
        }

        // 解析响应
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('[AuthVerifier] 解析响应数据失败:', parseError);
          return false;
        }
        
        console.log(`[AuthVerifier] 验证响应数据:`, data);

        // 成功验证并包含用户数据
        if (data.success && data.user && data.user.id === userData.userId) {
          console.log(`[AuthVerifier] 验证成功，用户ID:`, data.user.id);
          return true;
        }

        // 验证失败
        console.log(`[AuthVerifier] 验证失败，服务器返回:`, data);
        return false;
      } catch (fetchError) {
        // 清除超时定时器
        clearTimeout(timeoutId);
        
        // 判断是否是超时
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('[AuthVerifier] 验证请求超时');
          // 在超时情况下，我们假设这可能是服务器负载问题，而不是认证问题
          // 这在部署环境中很关键，因为服务器可能临时过载
          return true; // 暂时保留当前状态，稍后重试
        }
        console.error('[AuthVerifier] 验证请求出错:', fetchError);
        return false;
      }
    } catch (error) {
      console.error('[AuthVerifier] 验证过程出错:', error);
      return false;
    }
  };

  // 确保前端-后端认证状态一致性的函数
  const ensureAuthConsistency = async () => {
    console.log('[AuthVerifier] 开始确保前端-后端认证状态一致性');
    setIsVerifying(true);

    // 1. 检查本地用户数据
    const userData = getUserFromStorage();

    // 2. 如果本地没有用户数据，直接视为未认证
    if (!userData) {
      console.log('[AuthVerifier] 本地用户数据不存在，视为未认证');
      setIsAuthenticated(false);
      setIsVerifying(false);
      return;
    }

    // 3. 如果有本地用户数据，验证与服务器会话是否一致
    console.log('[AuthVerifier] 本地用户数据存在，验证与服务器会话是否一致');
    const isValid = await verifySession(userData);

    // 4. 如果验证失败，清除本地数据并重定向到登录页面
    if (!isValid) {
      console.log('[AuthVerifier] 前端-后端认证状态不一致，清除本地数据');
      localStorage.removeItem('user');
      setIsAuthenticated(false);

      // 如果当前不在登录页面，则重定向到登录页面
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        console.log('[AuthVerifier] 重定向到登录页面');
        setLocation('/login');
      }
    } else {
      console.log('[AuthVerifier] 前端-后端认证状态一致，用户ID:', userData.userId);
      setIsAuthenticated(true);
    }

    setIsVerifying(false);
  };

  // 组件挂载时，验证认证状态
  useEffect(() => {
    ensureAuthConsistency();

    // 每5分钟验证一次认证状态
    const interval = setInterval(ensureAuthConsistency, 5 * 60 * 1000);

    // 当localStorage变化时进行验证
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        console.log('[AuthVerifier] 检测到localStorage中的用户数据变化，重新验证');
        ensureAuthConsistency();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 如果正在验证，显示加载指示器
  if (isVerifying) {
    // 添加简单的加载指示器，更好的用户体验
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.5)',
        zIndex: 9999
      }}>
        <div style={{
          padding: '20px',
          borderRadius: '8px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          fontSize: '16px',
          textAlign: 'center'
        }}>
          正在验证认证状态...
        </div>
      </div>
    );
  }

  // 验证完成后显示子组件
  return <>{children}</>;
}
