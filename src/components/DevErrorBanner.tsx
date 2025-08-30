/* eslint-disable no-console, no-restricted-syntax */
import { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { useTranslation } from 'react-i18next';

interface CapturedError {
  message: string;
  details?: string;
  timestamp: number;
}

export const DevErrorBanner = () => {
  const { t } = useTranslation('common');
  const [lastError, setLastError] = useState<CapturedError | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHidden, setIsHidden] = useState(false);
  const originalConsoleError = useRef<typeof console.error | null>(null);
  const isIntercepting = useRef(false);

  useEffect(() => {
    // Only intercept in development
    if (!import.meta.env.DEV) return;

    // Intercept console.error
    originalConsoleError.current = console.error;
    console.error = (...args: unknown[]) => {
      // Prevent recursive logging since logger.error may call console.error
      if (isIntercepting.current) {
        originalConsoleError.current?.apply(console, args as []);
        return;
      }
      isIntercepting.current = true;
      try {
        const msg = args.map(a => {
          if (a instanceof Error) return `${a.name}: ${a.message}`;
          if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch { return '[object]'; }
          }
          return String(a);
        }).join(' ');
        setLastError({ message: msg, timestamp: Date.now() });
        setErrorCount(c => c + 1);
        
        // Record through central logger; recursion guarded above
        logger.error('Dev error captured', ...args);
      } catch (e) {
        logger.error('Error in DevErrorBanner console.error interceptor', e);
      }
      finally {
        // Always forward to the original console in dev
        originalConsoleError.current?.apply(console, args as []);
        isIntercepting.current = false;
      }
    };

    const onWindowError = (e: ErrorEvent) => {
      setLastError({ message: e.message || 'Unhandled error', details: e.error?.stack, timestamp: Date.now() });
      setErrorCount(c => c + 1);
      // Log window errors through central logger
      logger.error('Window error', e.error || new Error(e.message));
    };
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg = reason?.message || String(reason) || 'Unhandled promise rejection';
      const stack = reason?.stack ? String(reason.stack) : undefined;
      setLastError({ message: msg, details: stack, timestamp: Date.now() });
      setErrorCount(c => c + 1);
      // Log unhandled rejections through central logger
      logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(msg));
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      // Restore console.error
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current;
      }
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  // Only render in development mode
  if (!import.meta.env.DEV) {
    return null;
  }

  if (isHidden || !lastError) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[1000]">
      <div className="mx-auto max-w-6xl m-2 rounded-md border border-destructive/40 bg-destructive/10 backdrop-blur px-3 py-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-destructive">{t('devErrorBanner.title', { count: errorCount })}</div>
            <div className="mt-1 truncate text-foreground/90" title={lastError.message}>{lastError.message}</div>
            {!isCollapsed && lastError.details && (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2 text-xs text-muted-foreground">{lastError.details}</pre>
            )}
          </div>
          <div className="shrink-0 space-x-2">
            <button
              type="button"
              className="rounded border border-border/60 bg-background px-2 py-1 text-xs hover:bg-accent"
              onClick={() => setIsCollapsed(c => !c)}
            >
              {isCollapsed ? t('devErrorBanner.expand') : t('devErrorBanner.collapse')}
            </button>
            <button
              type="button"
              className="rounded border border-border/60 bg-background px-2 py-1 text-xs hover:bg-accent"
              onClick={() => setIsHidden(true)}
            >
              {t('devErrorBanner.dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
