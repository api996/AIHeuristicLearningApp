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
  const scriptLoadAttempted = useRef(false);

  useEffect(() => {
    console.log('[Turnstile] Component mounted');
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    console.log('[Turnstile] Site key available:', !!siteKey);

    if (!siteKey) {
      console.error('[Turnstile] Missing site key');
      setError('Configuration error: Missing site key');
      return;
    }

    // 避免重复加载脚本
    if (scriptLoadAttempted.current) {
      console.warn('[Turnstile] Script load already attempted');
      return;
    }

    // 标记脚本加载尝试
    scriptLoadAttempted.current = true;

    // 检查脚本是否已经加载
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript) {
      console.warn('[Turnstile] Script already exists, checking if widget can be rendered');
      if (window.turnstile) {
        initializeWidget(siteKey);
      }
      return;
    }

    function initializeWidget(siteKey: string) {
      console.log('[Turnstile] Initializing widget');
      try {
        if (widgetRef.current && window.turnstile) {
          widgetId.current = window.turnstile.render(widgetRef.current, {
            sitekey: siteKey,
            theme: 'dark',
            callback: (token: string) => {
              console.log('[Turnstile] Verification successful');
              onVerify(token);
            },
            'error-callback': (error: any) => {
              console.error('[Turnstile] Widget error:', error);
              const err = new Error('Verification failed');
              setError(err.message);
              if (onError) onError(err);
            }
          });
          setIsLoading(false);
          console.log('[Turnstile] Widget initialized, ID:', widgetId.current);
        } else {
          console.error('[Turnstile] Failed to initialize: DOM element or turnstile not ready');
          setError('Failed to initialize verification');
        }
      } catch (error) {
        console.error('[Turnstile] Initialization error:', error);
        setError('Failed to initialize verification');
        if (onError) onError(error);
      }
    }

    // 加载Turnstile脚本
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
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
      document.body.removeChild(script);
      delete window.onTurnstileLoad;
      scriptLoadAttempted.current = false;
    };
  }, [onVerify, onError]);

  if (error) {
    return <div className="text-red-500 text-sm">{error}</div>;
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 bg-opacity-50">
          <span className="text-sm text-neutral-400">加载验证组件中...</span>
        </div>
      )}
      <div ref={widgetRef} />
    </div>
  );
}