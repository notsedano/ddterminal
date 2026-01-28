/**
 * Error tracking utility for production
 * Supports Sentry integration (optional)
 */

interface ErrorContext {
  userId?: string;
  sessionId?: string;
  agentId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

let errorTrackingEnabled = false;
let sentryInitialized = false;

/**
 * Initialize error tracking (call in main.tsx or App.tsx)
 */
export function initErrorTracking(dsn?: string): void {
  if (typeof window === 'undefined') return;
  
  errorTrackingEnabled = true;
  
  // Initialize Sentry if DSN is provided
  if (dsn && !sentryInitialized) {
    try {
      // Dynamic import to avoid bundling Sentry in dev
      import('@sentry/react').then((SentryModule) => {
        const Sentry = SentryModule.default || SentryModule;
        const integrations: any[] = [];
        
        // Add BrowserTracing if available
        if (Sentry.browserTracingIntegration) {
          integrations.push(Sentry.browserTracingIntegration());
        } else if ((Sentry as any).BrowserTracing) {
          integrations.push(new (Sentry as any).BrowserTracing());
        }
        
        // Add Replay if available
        if (Sentry.replayIntegration) {
          integrations.push(Sentry.replayIntegration());
        } else if ((Sentry as any).Replay) {
          integrations.push(new (Sentry as any).Replay());
        }
        
        Sentry.init({
          dsn,
          environment: import.meta.env.MODE || 'development',
          integrations,
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
        });
        sentryInitialized = true;
        console.log('[ErrorTracking] Sentry initialized');
      }).catch((err) => {
        console.warn('[ErrorTracking] Failed to initialize Sentry:', err);
      });
    } catch (err) {
      console.warn('[ErrorTracking] Sentry not available:', err);
    }
  }
}

/**
 * Capture an error with context
 */
export function captureError(
  error: Error | string,
  context?: ErrorContext
): void {
  if (!errorTrackingEnabled) {
    // Fallback to console in development
    console.error('[Error]', error, context);
    return;
  }

  const errorObj = typeof error === 'string' ? new Error(error) : error;

  // Try to use Sentry if available
  if (sentryInitialized && typeof window !== 'undefined') {
    try {
      import('@sentry/react').then((SentryModule) => {
        const Sentry = SentryModule.default || SentryModule;
        Sentry.captureException(errorObj, {
          tags: {
            component: context?.component || 'unknown',
            action: context?.action || 'unknown',
          },
          user: context?.userId ? { id: context.userId } : undefined,
          extra: {
            sessionId: context?.sessionId,
            agentId: context?.agentId,
            ...context?.metadata,
          },
        });
      }).catch(() => {
        // Fallback to console if Sentry fails
        console.error('[Error]', errorObj, context);
      });
    } catch {
      console.error('[Error]', errorObj, context);
    }
  } else {
    // Fallback to console
    console.error('[Error]', errorObj, context);
  }
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
): void {
  if (!errorTrackingEnabled) {
    console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log']('[Message]', message, context);
    return;
  }

  if (sentryInitialized && typeof window !== 'undefined') {
    try {
      import('@sentry/react').then((SentryModule) => {
        const Sentry = SentryModule.default || SentryModule;
        Sentry.captureMessage(message, {
          level: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info',
          tags: {
            component: context?.component || 'unknown',
            action: context?.action || 'unknown',
          },
          extra: {
            sessionId: context?.sessionId,
            agentId: context?.agentId,
            userId: context?.userId,
            ...context?.metadata,
          },
        });
      }).catch(() => {
        console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log']('[Message]', message, context);
      });
    } catch {
      console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log']('[Message]', message, context);
    }
  } else {
    console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log']('[Message]', message, context);
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, metadata?: Record<string, unknown>): void {
  if (sentryInitialized && typeof window !== 'undefined') {
    try {
      import('@sentry/react').then((SentryModule) => {
        const Sentry = SentryModule.default || SentryModule;
        Sentry.setUser({ id: userId, ...metadata });
      }).catch(() => {
        // Silent fail
      });
    } catch {
      // Silent fail
    }
  }
}
