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

  useEffect(() => {
    console.log('[Turnstile] Component mounted');
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    console.log('[Turnstile] Site key available:', !!siteKey);

    if (!siteKey) {
      console.error('[Turnstile] Missing site key');
      setError('Configuration error: Missing site key');
      return;
    }

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript) {
      console.warn('[Turnstile] Turnstile already has been loaded. Was Turnstile imported multiple times?');
    }

    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;

    // Define callback for when script loads
    window.onTurnstileLoad = () => {
      console.log('[Turnstile] Script loaded, initializing widget');
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
          console.log('[Turnstile] Widget initialized');
        }
      } catch (error) {
        console.error('[Turnstile] Initialization error:', error);
        setError('Failed to initialize verification');
        if (onError) onError(error);
      }
    };

    document.body.appendChild(script);

    return () => {
      console.log('[Turnstile] Cleaning up');
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
      document.body.removeChild(script);
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