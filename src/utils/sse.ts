import { getApiBase, getAuthToken } from './config';
import { captureError } from './errorTracking';

export interface SSEChunkEvent {
  messageId?: string;
  chunk: string;
  channelId?: string;
  sessionId?: string;
}

export interface SSEMessageEvent {
  messageId: string;
  text: string;
  userId: string;
  agentId: string;
  sessionId?: string;
  channelId?: string;
  timestamp?: string;
}

export interface SSEErrorEvent {
  message: string;
  code?: string;
}

export interface SSEHandlers {
  onChunk?: (data: SSEChunkEvent) => void;
  onMessage?: (data: SSEMessageEvent) => void;
  onError?: (error: SSEErrorEvent) => void;
  onDone?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function createSSEStream(
  agentId: string,
  roomId: string,
  handlers: SSEHandlers = {}
): () => void {
  const apiBase = getApiBase();
  if (!apiBase) {
    handlers.onError?.({ message: 'No API base URL configured' });
    return () => {};
  }

  const authToken = getAuthToken();
  
  if (!agentId || !roomId) {
    handlers.onError?.({ message: 'Missing agentId or roomId', code: 'INVALID_PARAMS' });
    return () => {};
  }
  
  const url = new URL(`${apiBase}/agents/${agentId}/stream`);
  url.searchParams.set('roomId', roomId);
  if (authToken) {
    url.searchParams.set('token', authToken);
  }
  
  const fullUrl = url.toString();
  
  const testEndpoint = async (): Promise<{ url: string; working: boolean } | null> => {
    const urlsToTry = [
      fullUrl,
      fullUrl.replace('/agents/', '/api/agents/'),
    ];
    
    for (const testUrl of urlsToTry) {
      try {
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/event-stream' },
        });
        
        const contentType = response.headers.get('content-type') || '';
        const isEventStream = contentType.includes('text/event-stream');
        
        if (response.ok && isEventStream) {
          return { url: testUrl, working: true };
        }
        if (response.ok && !isEventStream) {
          return { url: testUrl, working: false };
        }
      } catch (err) {
        // Continue to next URL
      }
    }
    return null;
  };

  let eventSource: EventSource | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isManuallyClosed = false;
  let reconnectAttempts = 0;
  let currentSSEUrl = fullUrl;
  
  if (typeof window !== 'undefined') {
    if (!(window as any).__activeSSEConnections) {
      (window as any).__activeSSEConnections = new Set<EventSource>();
    }
  }
  
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000;

  const connect = async () => {
    if (isManuallyClosed) return;

    try {
      const preflightResult = await testEndpoint();
      
      if (!preflightResult) {
        handlers.onError?.({ 
          message: 'SSE endpoint not found. Check backend configuration.', 
          code: 'ENDPOINT_NOT_FOUND' 
        });
        return;
      }
      
      if (!preflightResult.working) {
        handlers.onError?.({ 
          message: 'SSE endpoint returns wrong MIME type. Backend may not be configured for SSE streaming.', 
          code: 'MIME_TYPE_MISMATCH' 
        });
        return;
      }
      
      currentSSEUrl = preflightResult.url;
      eventSource = new EventSource(currentSSEUrl);
      
      if (typeof window !== 'undefined' && (window as any).__activeSSEConnections) {
        (window as any).__activeSSEConnections.add(eventSource);
      }

      eventSource.onopen = () => {
        reconnectAttempts = 0;
        handlers.onOpen?.();
      };

      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.chunk) {
            handlers.onChunk?.(data as SSEChunkEvent);
          } else if (data.text && data.messageId) {
            handlers.onMessage?.(data as SSEMessageEvent);
          }
        } catch {
          if (typeof event.data === 'string' && event.data.trim()) {
            handlers.onChunk?.({ chunk: event.data });
          }
        }
      };

      eventSource.addEventListener('chunk', (event: MessageEvent) => {
        try {
          handlers.onChunk?.(JSON.parse(event.data) as SSEChunkEvent);
        } catch {
          // Ignore parse errors
        }
      });

      eventSource.addEventListener('message', (event: MessageEvent) => {
        try {
          handlers.onMessage?.(JSON.parse(event.data) as SSEMessageEvent);
        } catch {
          // Ignore parse errors
        }
      });

      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          handlers.onError?.(JSON.parse(event.data) as SSEErrorEvent);
        } catch {
          handlers.onError?.({ message: 'SSE connection error' });
        }
      });

      eventSource.addEventListener('done', () => {
        handlers.onDone?.();
      });

      eventSource.onerror = () => {
        const readyState = eventSource?.readyState;
        
        if (readyState === EventSource.CLOSED) {
          // First failure - likely endpoint doesn't exist or misconfigured
          if (reconnectAttempts === 0) {
            handlers.onError?.({ 
              message: 'SSE endpoint not found or connection failed. Check backend configuration.', 
              code: 'ENDPOINT_NOT_FOUND' 
            });
            return;
          }
          
          // Attempt reconnect with exponential backoff
          if (!isManuallyClosed && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);
            reconnectTimeout = setTimeout(connect, delay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            handlers.onError?.({ 
              message: 'SSE connection failed after multiple attempts', 
              code: 'CONNECTION_FAILED' 
            });
          }
        }
      };
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureError(errorObj, {
        component: 'SSE',
        action: 'createEventSource',
        metadata: { agentId, roomId, code: 'INIT_FAILED' },
      });
      handlers.onError?.({ 
        message: errorObj.message,
        code: 'INIT_FAILED'
      });
    }
  };

  connect();

  return () => {
    isManuallyClosed = true;
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (eventSource) {
      if (typeof window !== 'undefined' && (window as any).__activeSSEConnections) {
        (window as any).__activeSSEConnections.delete(eventSource);
      }
      eventSource.close();
      eventSource = null;
    }
    
    handlers.onClose?.();
  };
}

if (typeof window !== 'undefined') {
  (window as any).__activeSSEConnections = new Set<EventSource>();
}
