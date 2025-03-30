import { useState, useEffect, useRef } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  onError?: (error: any) => void;
}

declare global {
  interface Window {
    turnstile: any;
    onTurnstileLoad: () => void;
    _turnstileInstance: string | null;
  }
}

export function TurnstileWidget({ onVerify, onError }: TurnstileProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const scriptLoadAttempted = useRef(false);

  useEffect(() => {
    console.log('[Turnstile] Component mounted');
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    console.log('[Turnstile] Site key available:', !!siteKey);

    if (!siteKey) {
      console.error('[Turnstile] Missing site key');
      setError('Configuration error: Missing site key');
      setIsLoading(false);
      return;
    }

    // 检查是否已经有实例在运行
    if (window._turnstileInstance) {
      console.warn('[Turnstile] Instance already exists:', window._turnstileInstance);
      setError('另一个验证实例正在运行');
      setIsLoading(false);
      return;
    }

    // 标记实例
    window._turnstileInstance = Date.now().toString();
    console.log('[Turnstile] Created new instance:', window._turnstileInstance);

    // 避免重复加载脚本
    if (scriptLoadAttempted.current) {
      console.warn('[Turnstile] Script load already attempted, skipping');
      return;
    }

    // 标记脚本加载尝试
    scriptLoadAttempted.current = true;

    // 检查脚本是否已经加载
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript) {
      console.warn('[Turnstile] Script already exists, waiting for turnstile object');

      // 等待turnstile对象
      const checkTurnstile = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkTurnstile);
          initializeWidget(siteKey);
        }
      }, 100);

      // 设置超时
      setTimeout(() => {
        clearInterval(checkTurnstile);
        if (!window.turnstile) {
          console.error('[Turnstile] Timeout waiting for turnstile object');
          setError('Failed to initialize verification component');
          setIsLoading(false);
        }
      }, 5000);

      return;
    }

    function initializeWidget(siteKey: string) {
      console.log('[Turnstile] Initializing widget');
      try {
        if (!widgetRef.current) {
          console.error('[Turnstile] Widget reference not found');
          setError('Failed to initialize verification');
          setIsLoading(false);
          return;
        }

        if (!window.turnstile) {
          console.error('[Turnstile] Turnstile object not available');
          setError('Failed to initialize verification');
          setIsLoading(false);
          return;
        }

        // 清除可能存在的旧widget
        if (widgetId.current) {
          try {
            window.turnstile.remove(widgetId.current);
          } catch (e) {
            console.warn('[Turnstile] Failed to remove old widget:', e);
          }
        }

        widgetId.current = window.turnstile.render(widgetRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (token: string) => {
            console.log('[Turnstile] Verification successful');
            onVerify(token);
          },
          'error-callback': (error: any) => {
            console.error('[Turnstile] Widget error:', error);
            setError('Verification failed');
            if (onError) onError(error);
          },
          'expired-callback': () => {
            console.warn('[Turnstile] Challenge expired, refreshing');
            if (widgetId.current) {
              window.turnstile.reset(widgetId.current);
            }
          }
        });

        console.log('[Turnstile] Widget initialized with ID:', widgetId.current);
        setIsLoading(false);
      } catch (error) {
        console.error('[Turnstile] Initialization error:', error);
        setError('Failed to initialize verification');
        setIsLoading(false);
        if (onError) onError(error);
      }
    }

    // 加载Turnstile脚本
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;

    // 定义脚本加载回调
    window.onTurnstileLoad = () => {
      console.log('[Turnstile] Script loaded successfully');
      initializeWidget(siteKey);
    };

    // 处理脚本加载错误
    script.onerror = () => {
      console.error('[Turnstile] Failed to load script');
      setError('Failed to load verification component');
      setIsLoading(false);
      if (onError) onError(new Error('Script load failed'));
    };

    document.body.appendChild(script);
    console.log('[Turnstile] Script appended to document');

    return () => {
      console.log('[Turnstile] Cleaning up');
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      // 清理全局实例标记
      window._turnstileInstance = null;

      // 清理全局处理程序
      const temp = window.onTurnstileLoad;
      window.onTurnstileLoad = undefined;
      if (temp === window.onTurnstileLoad) {
        delete window.onTurnstileLoad;
      }

      scriptLoadAttempted.current = false;
      console.log('[Turnstile] Cleanup completed');
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