import { useState, useEffect, useRef } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  onError?: (error: any) => void;
}

declare global {
  interface Window {
    turnstile: any;
    onTurnstileLoad: () => void;
  }
}

export function TurnstileWidget({ onVerify, onError }: TurnstileProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  
  // 使用全局变量检查脚本加载状态
  const turnstileLoadedRef = useRef(false);

  useEffect(() => {
    // 使用环境变量
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    
    if (!siteKey) {
      console.warn('Turnstile密钥检查:', '前端未获取到密钥!');
      setError('配置错误：未设置验证密钥');
      setIsLoading(false);
      return;
    }

    // 如果Turnstile已经加载
    if (window.turnstile && turnstileLoadedRef.current) {
      initializeWidget(siteKey);
      return;
    }

    // 检查脚本是否已加载，避免重复添加
    const existingScript = document.querySelector('script[src*="turnstile"]');
    
    if (existingScript) {
      // 脚本已存在但turnstile对象可能尚未初始化
      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          turnstileLoadedRef.current = true;
          initializeWidget(siteKey);
        }
      }, 200);
      
      // 设置检查超时
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.turnstile) {
          setError('验证组件加载超时');
          setIsLoading(false);
        }
      }, 5000);
      
      return;
    }

    // 加载Turnstile脚本
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    
    // 使用onload事件而不是全局回调
    script.onload = () => {
      turnstileLoadedRef.current = true;
      setTimeout(() => {
        if (window.turnstile) {
          initializeWidget(siteKey);
        }
      }, 100);
    };
    
    script.onerror = () => {
      setError('验证组件加载失败');
      setIsLoading(false);
      if (onError) onError(new Error('Script load failed'));
    };

    document.body.appendChild(script);

    function initializeWidget(siteKey: string) {
      if (!widgetRef.current || !window.turnstile) {
        setError('验证组件初始化失败');
        setIsLoading(false);
        return;
      }

      try {
        // 确保不会重复渲染
        if (widgetId.current && window.turnstile) {
          window.turnstile.remove(widgetId.current);
          widgetId.current = null;
        }

        widgetId.current = window.turnstile.render(widgetRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (token: string) => onVerify(token),
          'error-callback': (error: any) => {
            setError('验证失败');
            if (onError) onError(error);
          },
          'expired-callback': () => {
            if (widgetId.current) {
              window.turnstile.reset(widgetId.current);
            }
          }
        });
        
        setIsLoading(false);
      } catch (error) {
        setError('验证组件初始化错误');
        setIsLoading(false);
        if (onError) onError(error);
      }
    }

    // 清理函数
    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, [onVerify, onError]);

  if (error) {
    return <div className="text-red-500 text-sm text-center">{error}</div>;
  }

  return (
    <div className="relative flex justify-center">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 bg-opacity-50">
          <span className="text-sm text-neutral-400">加载中...</span>
        </div>
      )}
      <div ref={widgetRef} className="turnstile-widget"></div>
    </div>
  );0">加载验证组件中...</span>
        </div>
      )}
      <div ref={widgetRef} className="turnstile-container" />
    </div>
  );
}