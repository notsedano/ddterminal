import { getApiBase, getAuthToken } from '@/utils/config';
import { SessionNotFoundError } from './client';
import type { SendMessageRequest, SendMessageResponse } from '@/types';
import { sanitizeMetadata } from '@/utils/messageUtils';

interface SendMessageAPIResponse {
  success: boolean;
  userMessage: {
    id: string;
    channel_id: string;
    author_id: string;
    content: string;
    created_at: number;
    source_type: string;
    metadata: Record<string, unknown>;
  };
  sessionStatus: {
    expiresAt: string;
    renewalCount: number;
    wasRenewed: boolean;
    isNearExpiration: boolean;
  };
}

// SSE event types for streaming responses
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

export interface SSEThoughtEvent {
  thought: string;
  step?: string;
  progress?: number;
  phase?: 1 | 2 | 3; // Phase number for 3-part prediction responses
}

export interface StreamingHandlers {
  onOpen?: () => void;
  onChunk?: (data: SSEChunkEvent) => void;
  onMessage?: (data: SSEMessageEvent) => void;
  onThought?: (data: SSEThoughtEvent) => void;
  onError?: (error: { message: string; code?: string }) => void;
  onDone?: (data?: { text?: string }) => void;
}

/**
 * Safely stringify an object, handling circular references
 * Replaces circular references with '[Circular]' to prevent errors
 */
function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  const seenRefs = new WeakMap<object, string>();
  let refCounter = 0;
  
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        // Return a reference indicator instead of the circular reference
        if (!seenRefs.has(value)) {
          seenRefs.set(value, `[Circular-${refCounter++}]`);
        }
        return seenRefs.get(value);
      }
      seen.add(value);
    }
    // Handle functions, undefined, and other non-serializable values
    if (typeof value === 'function') {
      return '[Function]';
    }
    if (value === undefined) {
      return null;
    }
    return value;
  });
}

/**
 * Safely extract error message from any error type, handling circular references
 */
function safeExtractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || 'Unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    // Try to extract message property safely
    if ('message' in error) {
      const msg = (error as { message: unknown }).message;
      if (typeof msg === 'string') {
        return msg;
      }
      if (msg instanceof Error) {
        return msg.message || msg.name || 'Unknown error';
      }
    }
    if ('error' in error) {
      const err = (error as { error: unknown }).error;
      if (typeof err === 'string') {
        return err;
      }
      if (err instanceof Error) {
        return err.message || err.name || 'Unknown error';
      }
    }
    // Last resort: use safe stringify with circular reference handling
    try {
      const seen = new WeakSet();
      return JSON.stringify(error, (_key, value) => {
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
    } catch {
      return 'Error object could not be serialized';
    }
  }
  return String(error);
}

/**
 * Send a message with SSE streaming response
 * Uses POST /api/messaging/sessions/:sessionId/messages with transport: 'sse'
 */
export async function sendMessageWithStreaming(
  sessionId: string,
  data: SendMessageRequest,
  handlers: StreamingHandlers = {},
  metadata?: {
    action?: 'predict';
    context?: {
      matchup?: Record<string, unknown>;
      stats?: Record<string, unknown>;
      market?: Record<string, unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
): Promise<SendMessageResponse> {
  const apiBase = getApiBase();
  const authToken = getAuthToken();
  
  const url = `${apiBase}/api/messaging/sessions/${sessionId}/messages`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream', // Required by backend
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  // Build request body - predictions require metadata.action: 'predict' and metadata.context
  const requestBody: {
    content: string;
    transport: 'sse';
    metadata?: {
      action?: 'predict';
      context?: Record<string, unknown>;
      [key: string]: unknown;
    };
  } = {
    content: data.text,
    transport: 'sse', // Required by backend
  };
  
  // Add metadata for predictions - sanitize to prevent circular references
  if (metadata) {
    requestBody.metadata = sanitizeMetadata(metadata) as typeof metadata;
  }
  
  console.log('[sendMessageWithStreaming] Sending message:', {
    sessionId,
    isPrediction: metadata?.action === 'predict',
    hasContext: !!metadata?.context,
  });
  
  let messageId = '';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: safeStringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed: ${response.status}`;
      let errorCode: string | undefined;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        errorCode = errorJson.error?.code || errorJson.code;
      } catch {
        // Use default error message
      }
      
      // Check if it's a session not found error (404 or 400 with session-related message)
      if (response.status === 404 || (response.status === 400 && (
        errorMessage.includes('Session') && errorMessage.includes('not found') ||
        errorCode === 'SESSION_NOT_FOUND'
      ))) {
        const sessionError = new SessionNotFoundError(errorMessage, errorCode || 'SESSION_NOT_FOUND');
        handlers.onError?.({ message: errorMessage, code: errorCode || 'SESSION_NOT_FOUND' });
        throw sessionError;
      }

      // Check if it's a content length error
      if (response.status === 400 && (
        errorMessage.includes('Content exceeds maximum length') ||
        errorMessage.includes('content exceeds') ||
        errorMessage.includes('maximum length') ||
        errorMessage.includes('characters') ||
        errorCode === 'CONTENT_TOO_LONG'
      )) {
        handlers.onError?.({ message: errorMessage, code: errorCode || 'CONTENT_TOO_LONG' });
        throw new Error(errorMessage);
      }
      
      handlers.onError?.({ message: errorMessage, code: String(response.status) });
      throw new Error(errorMessage);
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // Check if response is SSE stream
    if (contentType.includes('text/event-stream')) {
      // Call onOpen when stream is confirmed
      handlers.onOpen?.();
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            handlers.onDone?.();
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          let currentEventType = 'message';
          let currentData = '';
          
          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              currentData = line.slice(5).trim();
              
              if (currentData) {
                try {
                  const parsed = JSON.parse(currentData);
                  
                  // Extract messageId from any event
                  if (parsed.messageId) {
                    messageId = parsed.messageId;
                  }
                  
                  switch (currentEventType) {
                    case 'user_message':
                      // Acknowledgement event - can be ignored or logged
                      // messageId might be in this event
                      // IMPORTANT: Do not update user messages from this event - it may contain actual content
                      // For prediction messages, we want to preserve displayText, not overwrite with actual content
                      if (parsed.id) {
                        messageId = parsed.id;
                      }
                      break;
                    case 'chunk':
                      handlers.onChunk?.(parsed as SSEChunkEvent);
                      break;
                    case 'message':
                      handlers.onMessage?.(parsed as SSEMessageEvent);
                      break;
                    case 'thought':
                      handlers.onThought?.(parsed as SSEThoughtEvent);
                      break;
                    case 'error':
                      // Backend sends { error: string }
                      const errorMessage = parsed.error || parsed.message || 'Unknown error';
                      const errorCode = parsed.code || 'SSE_ERROR';
                      handlers.onError?.({ message: String(errorMessage), code: String(errorCode) });
                      break;
                    case 'done':
                      // Backend sends { text: string } in done event
                      handlers.onDone?.(parsed);
                      break;
                    default:
                      // Handle unknown event types - try to parse as chunk or message
                      if (parsed.chunk) {
                        handlers.onChunk?.(parsed as SSEChunkEvent);
                      } else if (parsed.text && parsed.messageId) {
                        handlers.onMessage?.(parsed as SSEMessageEvent);
                      } else if (parsed.thought) {
                        handlers.onThought?.(parsed as SSEThoughtEvent);
                      }
                  }
                } catch (parseError) {
                  // If not JSON, treat as plain text chunk
                  if (currentData.trim()) {
                    handlers.onChunk?.({ chunk: currentData });
                  }
                }
              }
              
              currentData = '';
            } else if (line === '') {
              // Empty line marks end of event
              currentEventType = 'message';
            }
          }
        }
      } catch (streamError) {
        // Handle stream reading errors safely
        const streamErrorMessage = safeExtractErrorMessage(streamError);
        handlers.onError?.({ 
          message: `SSE stream error: ${streamErrorMessage}`, 
          code: 'STREAM_ERROR' 
        });
        // Re-throw with safe message
        throw new Error(`SSE stream error: ${streamErrorMessage}`);
      }
    } else {
      // Non-streaming response (fallback to JSON)
      const jsonResponse = await response.json() as SendMessageAPIResponse;
      messageId = jsonResponse.userMessage.id;
    }
    
    return {
      messageId: messageId || `msg-${Date.now()}`,
      sessionId,
    };
  } catch (error) {
    // Safely extract error message to avoid circular reference issues
    const errorMessage = safeExtractErrorMessage(error);
    
    // Check if it's a network error (fetch failed, CORS, no response)
    const isNetworkError = error instanceof TypeError && (
      errorMessage.includes('fetch') || 
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('network error') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('CORS')
    );
    
    if (isNetworkError) {
      const networkError = { 
        message: `Network error connecting to ${url}. This may be a CORS issue or the server may be unreachable.`,
        code: 'NETWORK_ERROR' as const
      };
      try {
        console.error('[sendMessageWithStreaming] Network/CORS error detected:', {
          url,
          originalError: errorMessage,
          errorMessage: networkError.message,
          code: networkError.code,
          hint: 'Check browser Network tab for CORS errors. The backend may need to allow this origin.',
        });
      } catch {
        console.error('[sendMessageWithStreaming] Network/CORS error detected:', networkError.message);
      }
      handlers.onError?.(networkError);
    } else {
      const code = error instanceof Error ? 'FETCH_ERROR' as const : 'UNKNOWN_ERROR' as const;
      const genericError = { 
        message: errorMessage,
        code
      };
      try {
        console.error('[sendMessageWithStreaming] Error:', {
          url,
          originalError: errorMessage,
          errorMessage: genericError.message,
          code: genericError.code,
        });
      } catch {
        console.error('[sendMessageWithStreaming] Error:', genericError.message);
      }
      handlers.onError?.(genericError);
    }
    
    // Re-throw a new Error with the safe message to avoid circular references
    throw new Error(errorMessage);
  }
}

/**
 * Send a regular message via SSE (backend requires transport: 'sse' for all messages)
 * Regular messages use SSE but don't include metadata.action: 'predict'
 * Response events: user_message, chunk, done, error (no thought events)
 */
export async function sendMessage(
  sessionId: string, 
  data: SendMessageRequest,
  handlers: StreamingHandlers = {}
): Promise<SendMessageResponse> {
  const apiBase = getApiBase();
  const authToken = getAuthToken();
  
  const url = `${apiBase}/api/messaging/sessions/${sessionId}/messages`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream', // Required by backend
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  // Regular message payload (no metadata.action: 'predict')
  const requestBody = {
    content: data.text,
    transport: 'sse', // Required by backend
    // No metadata - this is a regular message, not a prediction
  };
  
  console.log('[sendMessage] Sending regular message via SSE:', {
    sessionId,
    endpoint: `/messaging/sessions/${sessionId}/messages`,
    requestBody: {
      content: data.text.substring(0, 50) + '...',
      transport: 'sse',
    },
  });
  
  let messageId = '';
  let accumulatedChunks = '';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: safeStringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed: ${response.status}`;
      let errorCode: string | undefined;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        errorCode = errorJson.error?.code || errorJson.code;
      } catch {
        // Use default error message
      }
      
      // Check if it's a session not found error (404 or 400 with session-related message)
      if (response.status === 404 || (response.status === 400 && (
        errorMessage.includes('Session') && errorMessage.includes('not found') ||
        errorCode === 'SESSION_NOT_FOUND'
      ))) {
        const sessionError = new SessionNotFoundError(errorMessage, errorCode || 'SESSION_NOT_FOUND');
        handlers.onError?.({ message: errorMessage, code: errorCode || 'SESSION_NOT_FOUND' });
        throw sessionError;
      }

      // Check if it's a content length error
      if (response.status === 400 && (
        errorMessage.includes('Content exceeds maximum length') ||
        errorMessage.includes('content exceeds') ||
        errorMessage.includes('maximum length') ||
        errorMessage.includes('characters') ||
        errorCode === 'CONTENT_TOO_LONG'
      )) {
        handlers.onError?.({ message: errorMessage, code: errorCode || 'CONTENT_TOO_LONG' });
        throw new Error(errorMessage);
      }
      
      handlers.onError?.({ message: errorMessage, code: String(response.status) });
      throw new Error(errorMessage);
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    if (!contentType.includes('text/event-stream')) {
      console.warn('[sendMessage] Unexpected content-type:', contentType);
    }
    
    handlers.onOpen?.();
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = 'message';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          handlers.onDone?.({ text: accumulatedChunks });
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        let currentData = '';
        
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim();
            
            if (currentData) {
              try {
                const parsed = JSON.parse(currentData);
                
                switch (currentEventType) {
                  case 'user_message':
                    // Acknowledgement - extract messageId if present
                    if (parsed.id) {
                      messageId = parsed.id;
                    }
                    break;
                  case 'chunk':
                    // Accumulate chunks for final message
                    const chunkText = parsed.chunk || '';
                    accumulatedChunks += chunkText;
                    handlers.onChunk?.(parsed as SSEChunkEvent);
                    break;
                  case 'message':
                    // Final complete message
                    if (parsed.messageId) {
                      messageId = parsed.messageId;
                    }
                    handlers.onMessage?.(parsed as SSEMessageEvent);
                    break;
                  case 'done':
                    // Completion event
                    handlers.onDone?.(parsed);
                    break;
                  case 'error':
                    const errorMessage = String(parsed.error || parsed.message || 'Unknown error');
                    const errorCode = String(parsed.code || 'SSE_ERROR');
                    
                    // Log detailed error information - safely serialize parsed to avoid circular references
                    try {
                      const safeParsed = safeStringify(parsed);
                      console.error('[sendMessage] SSE error event received:', {
                        error: errorMessage,
                        code: errorCode,
                        fullError: safeParsed,
                      });
                    } catch {
                      console.error('[sendMessage] SSE error event received:', {
                        error: errorMessage,
                        code: errorCode,
                      });
                    }
                    
                    // Call error handler but don't throw - let stream continue
                    // Backend might send error event but still complete the stream
                    handlers.onError?.({ message: errorMessage, code: errorCode });
                    break;
                  case 'thought':
                    // Regular messages should not receive thought events
                    // Only predictions get thought events
                    console.warn('[sendMessage] Received thought event in regular message (unexpected)');
                    break;
                  default:
                    // Handle unknown event types
                    if (parsed.chunk) {
                      accumulatedChunks += parsed.chunk;
                      handlers.onChunk?.(parsed as SSEChunkEvent);
                    } else if (parsed.text && parsed.messageId) {
                      messageId = parsed.messageId;
                      handlers.onMessage?.(parsed as SSEMessageEvent);
                    }
                }
              } catch (parseError) {
                // If not JSON, treat as plain text chunk
                if (currentData.trim()) {
                  accumulatedChunks += currentData;
                  handlers.onChunk?.({ chunk: currentData });
                }
              }
            }
            
            currentData = '';
          } else if (line === '') {
            currentEventType = 'message';
          }
        }
      }
    } catch (streamError) {
      // Handle stream reading errors safely
      const streamErrorMessage = safeExtractErrorMessage(streamError);
      handlers.onError?.({ 
        message: `SSE stream error: ${streamErrorMessage}`, 
        code: 'STREAM_ERROR' 
      });
      // Re-throw with safe message
      throw new Error(`SSE stream error: ${streamErrorMessage}`);
    }
    
    return {
      messageId: messageId || `msg-${Date.now()}`,
      sessionId,
    };
  } catch (error) {
    // Safely extract error message to avoid circular reference issues
    const errorMessage = safeExtractErrorMessage(error);
    
    const isNetworkError = error instanceof TypeError && (
      errorMessage.includes('fetch') || 
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('network error') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('CORS')
    );
    
    if (isNetworkError) {
      const networkError = { 
        message: `Network error connecting to ${url}. This may be a CORS issue or the server may be unreachable.`,
        code: 'NETWORK_ERROR' as const
      };
      try {
        console.error('[sendMessage] Network/CORS error detected:', {
          url,
          originalError: errorMessage,
          errorMessage: networkError.message,
          code: networkError.code,
        });
      } catch {
        console.error('[sendMessage] Network/CORS error detected:', networkError.message);
      }
      handlers.onError?.(networkError);
    } else {
      const code = error instanceof Error ? 'FETCH_ERROR' as const : 'UNKNOWN_ERROR' as const;
      const genericError = { 
        message: errorMessage,
        code
      };
      try {
        console.error('[sendMessage] Error:', {
          url,
          originalError: errorMessage,
          errorMessage: genericError.message,
          code: genericError.code,
        });
      } catch {
        console.error('[sendMessage] Error:', genericError.message);
      }
      handlers.onError?.(genericError);
    }
    
    // Re-throw a new Error with the safe message to avoid circular references
    throw new Error(errorMessage);
  }
}
