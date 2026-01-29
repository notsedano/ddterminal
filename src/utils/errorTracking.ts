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
/**
 * Safely extract error message from any error type
 */
function safeExtractErrorMessage(error: Error | string): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || error.name || 'Unknown error';
  }
  return 'Unknown error';
}

/**
 * Safely serialize context metadata to avoid circular references
 */
function safeSerializeContext(context?: ErrorContext): Record<string, unknown> {
  if (!context) return {};
  
  const safeContext: Record<string, unknown> = {};
  
  if (context.component) safeContext.component = context.component;
  if (context.action) safeContext.action = context.action;
  if (context.userId) safeContext.userId = context.userId;
  if (context.sessionId) safeContext.sessionId = context.sessionId;
  if (context.agentId) safeContext.agentId = context.agentId;
  
  // Safely serialize metadata if present
  if (context.metadata) {
    try {
      const seen = new WeakSet();
      const sanitized = JSON.stringify(context.metadata, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        if (typeof value === 'function') {
          return '[Function]';
        }
        return value;
      });
      safeContext.metadata = JSON.parse(sanitized);
    } catch {
      safeContext.metadata = { error: 'Failed to serialize metadata' };
    }
  }
  
  return safeContext;
}

export function captureError(
  error: Error | string,
  context?: ErrorContext
): void {
  const errorMessage = safeExtractErrorMessage(error);
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  const safeContext = safeSerializeContext(context);

  if (!errorTrackingEnabled) {
    // Fallback to console in development - use safe serialization
    try {
      console.error('[Error]', errorMessage, safeContext);
    } catch {
      console.error('[Error]', errorMessage);
    }
    return;
  }

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
          extra: safeContext,
        });
      }).catch(() => {
        // Fallback to console if Sentry fails
        try {
          console.error('[Error]', errorMessage, safeContext);
        } catch {
          console.error('[Error]', errorMessage);
        }
      });
    } catch {
      try {
        console.error('[Error]', errorMessage, safeContext);
      } catch {
        console.error('[Error]', errorMessage);
      }
    }
  } else {
    // Fallback to console
    try {
      console.error('[Error]', errorMessage, safeContext);
    } catch {
      console.error('[Error]', errorMessage);
    }
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
