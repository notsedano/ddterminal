/**
 * Server-Sent Events (SSE) utility for streaming AI responses
 * Uses native EventSource API - works over standard HTTP (no WebSocket upgrade needed)
 */

import { getApiBase, getAuthToken } from './config';

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

/**
 * Create an SSE connection to stream agent responses
 * @param agentId - The agent ID to stream from
 * @param roomId - The room/session ID
 * @param handlers - Event handlers for SSE events
 * @returns Cleanup function to close the connection
 */
export function createSSEStream(
  agentId: string,
  roomId: string,
  handlers: SSEHandlers = {}
): () => void {
  const apiBase = getApiBase();
  if (!apiBase) {
    console.error('[SSE] No API base URL configured');
    handlers.onError?.({ message: 'No API base URL configured' });
    return () => {}; // Return no-op cleanup
  }

  // Build SSE URL with query parameters
  // Note: EventSource doesn't support custom headers, so auth must be via query param or cookie
  const authToken = getAuthToken();
  
  // Validate inputs
  if (!agentId || !roomId) {
    console.error('[SSE] Missing required parameters:', { agentId, roomId });
    handlers.onError?.({ message: 'Missing agentId or roomId', code: 'INVALID_PARAMS' });
    return () => {};
  }
  
  // elizaOS may mount plugin routes without the /api/ prefix
  // Try without /api/ first (most common case)
  const url = new URL(`${apiBase}/agents/${agentId}/stream`);
  url.searchParams.set('roomId', roomId);
  if (authToken) {
    url.searchParams.set('token', authToken);
  }
  
  const fullUrl = url.toString();
  console.log('[SSE] Full URL:', fullUrl);
  console.log('[SSE] Parameters:', { agentId, roomId, hasToken: !!authToken, apiBase });
  
  // Pre-flight check: Test if endpoint exists before creating EventSource
  // This helps diagnose 404 errors better
  // Try both with and without /api/ prefix
  const testEndpoint = async () => {
    const urlsToTry = [
      fullUrl, // Without /api/ (current)
      fullUrl.replace('/agents/', '/api/agents/'), // With /api/
    ];
    
    for (const testUrl of urlsToTry) {
      try {
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
          },
        });
        console.log('[SSE] Pre-flight check - Status:', response.status, response.statusText, 'for', testUrl);
        if (response.ok) {
          console.log('[SSE] ✅ Found working endpoint at:', testUrl);
          // Update the URL if we found a working one with /api/
          if (testUrl.includes('/api/agents/')) {
            console.log('[SSE] ⚠️ Endpoint uses /api/ prefix - updating URL');
            // Note: We can't change the URL after EventSource is created, but we can log it
          }
          return true;
        }
      } catch (error) {
        // Continue to next URL
      }
    }
    return false;
  };

  let eventSource: EventSource | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isManuallyClosed = false;
  let reconnectAttempts = 0;
  
  // Track connection for status checking (if window is available)
  if (typeof window !== 'undefined') {
    if (!(window as any).__activeSSEConnections) {
      (window as any).__activeSSEConnections = new Set<EventSource>();
    }
  }
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000; // Start with 1 second

  const connect = async () => {
    if (isManuallyClosed) return;

    try {
      // Pre-flight check (non-blocking - don't wait, just log)
      testEndpoint().then(exists => {
        if (!exists) {
          console.warn('[SSE] ⚠️ Pre-flight check suggests endpoint may not exist');
        }
      });
      
      console.log('[SSE] Creating EventSource connection to:', fullUrl);
      eventSource = new EventSource(fullUrl);
      
      // Track connection for status checking
      if (typeof window !== 'undefined' && (window as any).__activeSSEConnections) {
        (window as any).__activeSSEConnections.add(eventSource);
      }

      eventSource.onopen = () => {
        console.log('[SSE] ✅ Connection opened - SSE streaming active!');
        reconnectAttempts = 0; // Reset on successful connection
        handlers.onOpen?.();
      };

      // Handle default 'message' event (fallback if backend doesn't use custom event types)
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          // Check if it's a chunk or complete message based on structure
          if (data.chunk) {
            console.log('[SSE] Received chunk (via default message):', data.chunk?.substring(0, 50) + '...');
            handlers.onChunk?.(data as SSEChunkEvent);
          } else if (data.text && data.messageId) {
            console.log('[SSE] Received message (via default message):', data.messageId);
            handlers.onMessage?.(data as SSEMessageEvent);
          }
        } catch (error) {
          // If not JSON, might be plain text chunk
          if (typeof event.data === 'string' && event.data.trim()) {
            console.log('[SSE] Received text chunk (plain):', event.data.substring(0, 50) + '...');
            handlers.onChunk?.({ chunk: event.data });
          }
        }
      };

      eventSource.addEventListener('chunk', (event: MessageEvent) => {
        try {
          const data: SSEChunkEvent = JSON.parse(event.data);
          console.log('[SSE] Received chunk:', data.chunk?.substring(0, 50) + '...');
          handlers.onChunk?.(data);
        } catch (error) {
          console.error('[SSE] Error parsing chunk event:', error, event.data);
        }
      });

      eventSource.addEventListener('message', (event: MessageEvent) => {
        try {
          const data: SSEMessageEvent = JSON.parse(event.data);
          console.log('[SSE] Received complete message:', data.messageId);
          handlers.onMessage?.(data);
        } catch (error) {
          console.error('[SSE] Error parsing message event:', error, event.data);
        }
      });

      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const data: SSEErrorEvent = JSON.parse(event.data);
          handlers.onError?.(data);
        } catch (error) {
          // If parsing fails, it might be a connection error
          console.error('[SSE] Error event:', event);
          handlers.onError?.({ message: 'SSE connection error' });
        }
      });

      eventSource.addEventListener('done', () => {
        console.log('[SSE] ✅ Stream complete');
        handlers.onDone?.();
        // Don't close immediately - keep connection open for potential new streams
      });

      // Handle connection errors (network issues, server closed, etc.)
      eventSource.onerror = (error) => {
        const readyState = eventSource?.readyState;
        
        // EventSource.CONNECTING = 0, EventSource.OPEN = 1, EventSource.CLOSED = 2
        if (readyState === EventSource.CLOSED) {
          // Check if it's a 404 (endpoint doesn't exist) - don't retry
          // EventSource doesn't give us status code directly, but we can infer from immediate close
          if (reconnectAttempts === 0) {
            // First failure - likely 404 or endpoint doesn't exist
            console.error('[SSE] ❌ Connection failed immediately - endpoint may not exist (404)');
            console.error('[SSE] URL attempted:', fullUrl);
            console.error('[SSE] This usually means:');
            console.error('  1. The backend endpoint path is incorrect');
            console.error('  2. The backend endpoint doesn\'t exist yet');
            console.error('  3. CORS is blocking the connection');
            console.error('  4. Authentication is required but token is missing/invalid');
            console.error('[SSE] Check Network tab for the exact HTTP status code');
            handlers.onError?.({ 
              message: 'SSE endpoint not found (404). The backend may not support SSE streaming yet.', 
              code: 'ENDPOINT_NOT_FOUND' 
            });
            // Don't retry on 404 - endpoint doesn't exist
            return;
          }
          
          // Connection closed - attempt reconnect if not manually closed
          if (!isManuallyClosed && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1); // Exponential backoff
            console.warn(`[SSE] Connection closed, reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
            
            reconnectTimeout = setTimeout(() => {
              connect();
            }, delay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.error('[SSE] ❌ Max reconnection attempts reached');
            handlers.onError?.({ message: 'SSE connection failed after multiple attempts', code: 'CONNECTION_FAILED' });
          }
        } else if (readyState === EventSource.CONNECTING) {
          // Still connecting - this is normal, don't log as error
          console.log('[SSE] Connecting...');
        } else {
          // Other error states
          console.warn('[SSE] Connection error, readyState:', readyState);
        }
      };
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      handlers.onError?.({ 
        message: error instanceof Error ? error.message : 'Failed to create SSE connection',
        code: 'INIT_FAILED'
      });
    }
  };

  // Start connection
  connect();

  // Return cleanup function
  return () => {
    console.log('[SSE] Closing connection...');
    isManuallyClosed = true;
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (eventSource) {
      // Remove from tracking
      if (typeof window !== 'undefined' && (window as any).__activeSSEConnections) {
        (window as any).__activeSSEConnections.delete(eventSource);
      }
      eventSource.close();
      eventSource = null;
    }
    
    handlers.onClose?.();
  };
}

/**
 * Test SSE endpoint (for debugging)
 * Call this in browser console: window.testSSEEndpoint(agentId, roomId)
 * 
 * Also available: window.checkSSEStatus() - checks if SSE is currently connected
 */
if (typeof window !== 'undefined') {
  // Store active EventSource connections for status checking
  (window as any).__activeSSEConnections = new Set<EventSource>();
  
  (window as any).checkSSEStatus = () => {
    const networkRequests = performance.getEntriesByType('resource')
      .filter((r: PerformanceResourceTiming) => r.name.includes('/stream'));
    
    console.log('=== SSE Connection Status ===');
    console.log('Network requests to /stream:', networkRequests.length);
    
    const active = networkRequests.filter((r: PerformanceResourceTiming) => r.duration === 0);
    if (active.length > 0) {
      console.log('✅ SSE connection is ACTIVE');
      active.forEach((r: PerformanceResourceTiming) => {
        console.log('  - Active connection:', r.name);
      });
    } else {
      console.log('⚠️ No active SSE connection found');
    }
    
    const connections = (window as any).__activeSSEConnections;
    if (connections && connections.size > 0) {
      console.log(`✅ ${connections.size} EventSource object(s) in memory`);
      connections.forEach((es: EventSource) => {
        const states = ['CONNECTING', 'OPEN', 'CLOSED'];
        console.log(`  - ReadyState: ${states[es.readyState]} (${es.url})`);
      });
    } else {
      console.log('⚠️ No EventSource objects found in memory');
    }
    
    return {
      hasActiveNetworkConnection: active.length > 0,
      hasEventSourceObjects: connections?.size > 0 || false,
      networkRequests: networkRequests.length,
    };
  };
  
  (window as any).testSSEEndpoint = async (agentId: string, roomId: string) => {
    const apiBase = getApiBase();
    if (!apiBase) {
      console.error('No API base URL configured');
      return;
    }
    
    const authToken = getAuthToken();
    
    // Try without /api/ first (elizaOS plugin routes often don't have /api/ prefix)
    let url = new URL(`${apiBase}/agents/${agentId}/stream`);
    url.searchParams.set('roomId', roomId);
    if (authToken) {
      url.searchParams.set('token', authToken);
    }
    
    console.log('Testing SSE endpoint (without /api/):', url.toString());
    
    // Also try with /api/ prefix
    const urlWithApi = new URL(`${apiBase}/api/agents/${agentId}/stream`);
    urlWithApi.searchParams.set('roomId', roomId);
    if (authToken) {
      urlWithApi.searchParams.set('token', authToken);
    }
    console.log('Alternative (with /api/):', urlWithApi.toString());
    
    // Test with fetch first
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
      });
      console.log('Fetch test - Status:', response.status, response.statusText);
      console.log('Fetch test - Headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        console.log('✅ Endpoint exists! Status:', response.status);
      } else {
        const text = await response.text().catch(() => '');
        console.error('❌ Endpoint returned error:', response.status);
        console.error('Response:', text.substring(0, 500));
      }
    } catch (error) {
      console.error('❌ Fetch test failed:', error);
    }
    
    // Test with EventSource
    console.log('\nTesting with EventSource...');
    const es = new EventSource(url.toString());
    
    // Track for status checking
    (window as any).__activeSSEConnections?.add(es);
    
    es.onopen = () => {
      console.log('✅ EventSource connection opened!');
      console.log('ReadyState:', es.readyState, '(1=OPEN)');
    };
    
    es.onerror = (e) => {
      console.error('❌ EventSource error:', e);
      console.error('ReadyState:', es.readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSED)');
      if (es.readyState === EventSource.CLOSED) {
        console.error('Connection closed - likely 404 or server error');
      }
      (window as any).__activeSSEConnections?.delete(es);
      es.close();
    };
    
    es.addEventListener('chunk', (e) => {
      console.log('✅ Received chunk event:', e.data?.substring(0, 100) + '...');
    });
    
    es.addEventListener('message', (e) => {
      console.log('✅ Received message event:', e.data?.substring(0, 100) + '...');
    });
    
    es.addEventListener('done', () => {
      console.log('✅ Received done event');
    });
    
    // Close after 10 seconds
    setTimeout(() => {
      console.log('Test complete - EventSource closed');
      (window as any).__activeSSEConnections?.delete(es);
      es.close();
    }, 10000);
  };
}
