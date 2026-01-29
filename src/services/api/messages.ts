import apiClient from './client';
import { getApiBase, getAuthToken } from '@/utils/config';
import type { SendMessageRequest, SendMessageResponse } from '@/types';

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
 * Send a message with SSE streaming response
 * Uses POST /api/messaging/sessions/:sessionId/messages with transport: 'sse'
 */
export async function sendMessageWithStreaming(
  sessionId: string,
  data: SendMessageRequest,
  handlers: StreamingHandlers = {}
): Promise<SendMessageResponse> {
  const apiBase = getApiBase();
  const authToken = getAuthToken();
  
  const url = `${apiBase}/api/messaging/sessions/${sessionId}/messages`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  let messageId = '';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: data.text,
        transport: 'sse', // Request SSE streaming response
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // Use default error message
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
                    handlers.onError?.({ message: errorMessage, code: parsed.code });
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
              } catch {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's a network error (fetch failed, CORS, no response)
    const isNetworkError = error instanceof TypeError && (
      error.message.includes('fetch') || 
      error.message.includes('Failed to fetch') ||
      error.message.includes('network error') ||
      error.message.includes('NetworkError') ||
      error.message.includes('CORS')
    );
    
    if (isNetworkError) {
      const networkError = { 
        message: `Network error connecting to ${url}. This may be a CORS issue or the server may be unreachable.`,
        code: 'NETWORK_ERROR' 
      };
      console.error('[sendMessageWithStreaming] Network/CORS error detected:', {
        url,
        originalError: error,
        errorMessage: networkError.message,
        code: networkError.code,
        hint: 'Check browser Network tab for CORS errors. The backend may need to allow this origin.',
      });
      handlers.onError?.(networkError);
    } else {
      const genericError = { 
        message: errorMessage,
        code: error instanceof Error ? 'FETCH_ERROR' : 'UNKNOWN_ERROR'
      };
      console.error('[sendMessageWithStreaming] Error:', {
        url,
        originalError: error,
        errorMessage: genericError.message,
        code: genericError.code,
      });
      handlers.onError?.(genericError);
    }
    
    throw error;
  }
}

/**
 * Send a message without streaming (original implementation)
 */
export async function sendMessage(sessionId: string, data: SendMessageRequest): Promise<SendMessageResponse> {
  console.log('[sendMessage] Sending message via REST API:', {
    sessionId,
    text: data.text.substring(0, 50) + '...',
    userId: data.userId,
  });
  
  const response = await apiClient.post<SendMessageAPIResponse>(
    `/messaging/sessions/${sessionId}/messages`,
    {
      content: data.text,
      userId: data.userId,
    }
  );
  
  console.log('[sendMessage] Response received:', {
    messageId: response.data.userMessage.id,
    sessionStatus: response.data.sessionStatus,
  });
  
  return {
    messageId: response.data.userMessage.id,
    sessionId,
  };
}
