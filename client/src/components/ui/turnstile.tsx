import { useState, useEffect, useRef } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  onError?: (error: any) => void;
}

declare global {
  interface Window {
    turnstile: any;
    onTurnstileLoad: () => void;
    _turnstileInit: boolean;
    _turnstileCallback: ((token: string) => void) | null;
    _turnstileErrorCallback: ((error: any) => void) | null;
  }
}

export function TurnstileWidget({ onVerify, onError }: TurnstileProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const instanceId = useRef<string>(Date.now().toString());

  // 确保组件只渲染一次的标记
  useEffect(() => {
    console.log(`[Turnstile-${instanceId.current}] Component mounted`);
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    
    if (!siteKey) {
      console.error(`[Turnstile-${instanceId.current}] Missing site key`);
      setError('验证配置错误：缺少站点密钥');
      setIsLoading(false);
      return;
    }

    // 设置全局回调函数，避免多个实例冲突
    window._turnstileCallback = (token: string) => {
      console.log(`[Turnstile-${instanceId.current}] Verification successful`);
      onVerify(token);
    };

    window._turnstileErrorCallback = (err: any) => {
      console.error(`[Turnstile-${instanceId.current}] Error:`, err);
      if (onError) onError(err);
    };

    const initWidget = () => {
      try {
        if (!widgetRef.current || !window.turnstile) {
          console.error(`[Turnstile-${instanceId.current}] Cannot initialize widget`);
          setError('验证组件初始化失败');
          setIsLoading(false);
          return;
        }

        // 确保移除旧的小部件（如果有）
        if (widgetId.current) {
          try {
            window.turnstile.remove(widgetId.current);
          } catch (e) {
            console.warn(`[Turnstile-${instanceId.current}] Failed to remove old widget:`, e);
          }
        }

        // 渲染新的小部件
        widgetId.current = window.turnstile.render(widgetRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (token: string) => {
            if (window._turnstileCallback) window._turnstileCallback(token);
          },
          'error-callback': (err: any) => {
            if (window._turnstileErrorCallback) window._turnstileErrorCallback(err);
            setError('验证失败，请重试');
          },
          'expired-callback': () => {
            console.warn(`[Turnstile-${instanceId.current}] Challenge expired, refreshing`);
            if (widgetId.current) {
              window.turnstile.reset(widgetId.current);
            }
          }
        });

        console.log(`[Turnstile-${instanceId.current}] Widget initialized with ID:`, widgetId.current);
        setIsLoading(false);
      } catch (err) {
        console.error(`[Turnstile-${instanceId.current}] Initialization error:`, err);
        setError('验证组件初始化失败');
        setIsLoading(false);
        if (onError) onError(err);
      }
    };

    // 加载脚本（如果尚未加载）
    if (!window._turnstileInit) {
      window._turnstileInit = true;
      
      window.onTurnstileLoad = () => {
        console.log(`[Turnstile-${instanceId.current}] Script loaded successfully`);
        initWidget();
      };

      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
      script.async = true;
      script.defer = true;
      script.id = 'turnstile-script';
      
      script.onerror = () => {
        console.error(`[Turnstile-${instanceId.current}] Failed to load script`);
        setError('验证组件加载失败');
        setIsLoading(false);
        window._turnstileInit = false;
        if (onError) onError(new Error('Script load failed'));
      };

      document.body.appendChild(script);
      console.log(`[Turnstile-${instanceId.current}] Script appended to document`);
    } else if (window.turnstile) {
      // 脚本已加载，直接初始化小部件
      console.log(`[Turnstile-${instanceId.current}] Script already loaded, initializing widget`);
      initWidget();
    } else {
      console.log(`[Turnstile-${instanceId.current}] Waiting for script to load...`);
      // 等待脚本加载完成
      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          initWidget();
        }
      }, 100);

      // 超时处理
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.turnstile) {
          console.error(`[Turnstile-${instanceId.current}] Script load timeout`);
          setError('验证组件加载超时');
          setIsLoading(false);
        }
      }, 5000);
    }

    // 清理函数
    return () => {
      console.log(`[Turnstile-${instanceId.current}] Cleaning up`);
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch (e) {
          console.warn(`[Turnstile-${instanceId.current}] Error removing widget:`, e);
        }
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
          <span className="text-sm text-neutral-400">加载验证组件中...</span>
        </div>
      )}
      <div ref={widgetRef} className="turnstile-container" />
    </div>
  );
}