import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  sendMessageWithStreaming, 
  type SSEChunkEvent, 
  type SSEMessageEvent,
  type SSEThoughtEvent 
} from '@/services/api/messages';
import { getMessages as getMessagesAPI } from '@/services/api/sessions';
import { SessionNotFoundError } from '@/services/api/client';
import {
  saveMessage as saveLocalMessage,
  getMessages as getStoredMessages,
} from '@/services/storage/conversationStorage';
import {
  saveMessageToSupabase,
  getMessagesFromSupabase,
  isSupabaseConfigured,
  getSessionFromSupabase,
  saveSessionToSupabase,
  sessionHasKnowledge,
  searchSessionKnowledge,
  formatSearchResultsForContext,
} from '@/services/supabase';
import { getSession as getLocalSession } from '@/services/storage/conversationStorage';
// SSE streaming is now handled via POST /api/messaging/sessions/:sessionId/messages with transport: 'sse'
import { useAuth } from './useAuth';
import { useMemory, useMemoryExtraction } from './useMemory';
import { getUserId } from '@/utils/storage';
import { convertApiMessageToMessage, mergeMessages, sanitizeMetadata } from '@/utils/messageUtils';
import { captureError } from '@/utils/errorTracking';
import type { Message, SendMessageResponse } from '@/types';
import type { KnowledgeSearchResult } from '@/types/knowledge';

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

export interface UseChatOptions {
  sessionId: string | null;
  agentId: string;
  roomId: string;
  onSessionInvalid?: (sessionId: string) => void;
  enableMemory?: boolean;
  enableKnowledge?: boolean;
  onThought?: (thought: SSEThoughtEvent) => void;
}

async function ensureSessionInSupabase(
  sessionId: string,
  supabaseUserId: string
): Promise<boolean> {
  const supabaseSession = await getSessionFromSupabase(sessionId);
  if (supabaseSession) return true;
  
  let session = await getLocalSession(sessionId);
  
  if (!session) {
    try {
      const { getSession } = await import('@/services/api/sessions');
      session = await getSession(sessionId);
    } catch (error) {
      console.warn(`[useChat] Session ${sessionId.slice(0, 8)}... not found:`, safeExtractErrorMessage(error));
      captureError(error instanceof Error ? error : new Error(String(error)), {
        component: 'useChat',
        action: 'ensureSessionInSupabase',
        sessionId,
        metadata: { step: 'fetchFromAPI' },
      });
    }
  }
  
  if (session) {
    try {
      await saveSessionToSupabase(session, supabaseUserId);
      return true;
    } catch (error) {
      console.error(`[useChat] Failed to save session:`, safeExtractErrorMessage(error));
      captureError(error instanceof Error ? error : new Error(String(error)), {
        component: 'useChat',
        action: 'ensureSessionInSupabase',
        sessionId,
        metadata: { step: 'saveToSupabase', supabaseUserId },
      });
      return false;
    }
  }
  
  return false;
}

/**
 * Sanitize prediction messages - replace actual prompt content with display text
 * This ensures prediction prompts are never shown to users, even if loaded from backend
 */
function sanitizePredictionMessage(message: Message): Message {
  // If already has displayText in metadata, use it
  if (message.metadata?.isPredictionMessage && message.metadata?.displayText) {
    return {
      ...message,
      text: message.metadata.displayText as string,
    };
  }
  
  // Detect prediction messages by content pattern (backend might return without metadata)
  if (message.role === 'user' && (
    message.text.includes('PREDICTION REQUEST - PART 1/3') ||
    message.text.includes('PREDICTION REQUEST - PART 2/3') ||
    message.text.includes('PREDICTION REQUEST - PART 3/3')
  )) {
    if (message.text.includes('PART 1/3')) {
      return {
        ...message,
        text: "Winner winner, chicken dinner!",
        metadata: {
          ...message.metadata,
          isPredictionMessage: true,
          displayText: "Winner winner, chicken dinner!",
        },
      };
    } else {
      // Parts 2 and 3 should be hidden
      return {
        ...message,
        text: "",
        metadata: {
          ...message.metadata,
          isPredictionMessage: true,
          displayText: "",
        },
      };
    }
  }
  
  return message;
}

async function saveMessage(
  message: Message,
  supabaseUserId: string | null,
  isAuthenticated: boolean
): Promise<void> {
  // Sanitize prediction messages before saving
  const sanitized = sanitizePredictionMessage(message);
  await saveLocalMessage(sanitized);

  if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
    try {
      const sessionExists = await ensureSessionInSupabase(sanitized.sessionId, supabaseUserId);
      if (!sessionExists) {
        console.warn(`[useChat] Skipping Supabase save - session doesn't exist`);
        return;
      }
      await saveMessageToSupabase(sanitized, supabaseUserId);
    } catch (error) {
      // Extract error message safely to avoid circular reference issues
      const errorMessage = safeExtractErrorMessage(error);
      
      console.error(`[useChat] Failed to save message to Supabase:`, errorMessage);
      
      // Only capture error if it's not a circular reference error (those are handled by saveMessageToSupabase)
      if (!errorMessage.includes('circular') && !errorMessage.includes('cyclic') && !errorMessage.includes('JSON.stringify')) {
        captureError(error instanceof Error ? error : new Error(errorMessage), {
          component: 'useChat',
          action: 'saveMessage',
          sessionId: sanitized.sessionId,
          userId: supabaseUserId || undefined,
          metadata: { messageId: sanitized.id, role: sanitized.role },
        });
      } else {
        // For circular reference errors, log but don't capture (to avoid recursive issues)
        console.error('[useChat] Circular reference detected in message metadata. Message may not be saved to Supabase.');
      }
    }
  }
}

export function useChat({ sessionId, agentId, roomId: _roomId, onSessionInvalid, enableMemory = true, enableKnowledge = true, onThought }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [thoughtProcess, setThoughtProcess] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [knowledgeContext, setKnowledgeContext] = useState<KnowledgeSearchResult[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const isNewSessionRef = useRef(true);
  const userId = getUserId();
  const { isAuthenticated, supabaseUserId, isLoading: isAuthLoading } = useAuth();

  const loadedSessionRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  const authStateRef = useRef({ isAuthenticated, supabaseUserId });
  authStateRef.current = { isAuthenticated, supabaseUserId };
  
  const onSessionInvalidRef = useRef(onSessionInvalid);
  onSessionInvalidRef.current = onSessionInvalid;

  const {
    context: memoryContext,
    contextPrompt: memoryContextPrompt,
    isLoading: isMemoryLoading,
    trackInteraction,
    saveSummary,
    updateSummary,
  } = useMemory({
    agentId,
    sessionId,
    enabled: enableMemory,
  });

  const { extractEntities, saveFact, saveIntent, summarizeConversation } = useMemoryExtraction(agentId, sessionId);

  const { data: hasKnowledge = false } = useQuery({
    queryKey: ['session-has-knowledge', sessionId],
    queryFn: () => sessionHasKnowledge(sessionId!),
    enabled: !!sessionId && enableKnowledge,
    staleTime: 30_000,
  });

  // SSE streaming is now handled via POST /api/messaging/sessions/:sessionId/messages with transport: 'sse'
  // The sendMessageWithStreaming function handles the SSE response stream directly

  const streamingMessageRef = useRef('');
  const thoughtProcessRef = useRef('');
  const recentlySentMessageIdsRef = useRef<Set<string>>(new Set());

  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, displayText: _displayText, metadata, skipAddingUserMessage = false }: { text: string; displayText?: string; metadata?: { action?: 'predict'; context?: Record<string, unknown> }; skipAddingUserMessage?: boolean }) => {
      if (!sessionId) throw new Error('No session available');

      // Search for relevant knowledge context if session has knowledge
      if (enableKnowledge && hasKnowledge) {
        searchSessionKnowledge(sessionId, text, 5)
          .then((results) => {
            setKnowledgeContext(results);
          })
          .catch((err) => {
            console.warn('[useChat] Knowledge search failed:', safeExtractErrorMessage(err));
            captureError(err instanceof Error ? err : new Error(String(err)), {
              component: 'useChat',
              action: 'searchKnowledge',
              sessionId: sessionId || undefined,
              metadata: { query: text.substring(0, 100) },
            });
          });
      }

      // Reset streaming state
      setStreamingMessage('');
      setThoughtProcess('');
      streamingMessageRef.current = '';
      thoughtProcessRef.current = '';
      setIsStreaming(true);
      setIsWaitingForResponse(true);
      setSseConnected(true);

      // Add user message immediately (unless we're skipping it for display text)
      const tempUserMessageId = `user-${Date.now()}`;
      const userMessage: Message = {
        id: tempUserMessageId,
        text,
        userId,
        sessionId,
        createdAt: new Date().toISOString(),
        role: 'user',
      };

      lastUserMessageRef.current = {
        text,
        timestamp: Date.now(),
      };
      lastAgentMessageTimeRef.current = 0;
      hasReceivedAgentResponseRef.current = false;

      if (!skipAddingUserMessage) {
        setMessages((prev) => [...prev, sanitizePredictionMessage(userMessage)]);
      }

      // Send message with SSE streaming
      const response = await sendMessageWithStreaming(
        sessionId,
        { text, userId },
        {
          onChunk: (data: SSEChunkEvent) => {
            if (data.chunk) {
              streamingMessageRef.current += data.chunk;
              setStreamingMessage(streamingMessageRef.current);
            }
          },
          onMessage: (data: SSEMessageEvent) => {
            if (data.text) {
              const agentMessage: Message = {
                id: data.messageId || `agent-${Date.now()}`,
                text: data.text,
                userId: data.agentId || agentId,
                agentId: data.agentId || agentId,
                sessionId: data.sessionId || sessionId,
                createdAt: data.timestamp || new Date().toISOString(),
                role: 'agent',
              };

              setMessages((prev) => {
                // Remove streaming message placeholder if exists
                const filtered = prev.filter(m => !m.id.startsWith('agent-streaming-'));
                // Check for duplicate
                if (filtered.some(m => m.id === agentMessage.id)) {
                  return filtered;
                }
                // Sanitize all messages to ensure prediction prompts are hidden
                return [...filtered, agentMessage].map(sanitizePredictionMessage);
              });

              lastAgentMessageTimeRef.current = Date.now();
              hasReceivedAgentResponseRef.current = true;
              setIsWaitingForResponse(false);
              
              // Save agent message (but don't block UI if it fails)
              const { isAuthenticated: auth, supabaseUserId: sbId } = authStateRef.current;
              saveMessage(agentMessage, sbId, auth).catch((err) => {
                // Extract error message safely
                const errorMsg = safeExtractErrorMessage(err);
                console.error('[useChat] Failed to save agent message:', errorMsg);
                // Don't set error state - message is already displayed, saving is just for persistence
              });
            }
          },
          onThought: (data: SSEThoughtEvent) => {
            if (data.thought) {
              thoughtProcessRef.current += data.thought + '\n';
              setThoughtProcess(thoughtProcessRef.current);
              // Forward to external callback if provided (for prediction UI)
              if (onThought) {
                onThought(data);
              }
            }
          },
          onError: (error) => {
            // Safely extract error message to avoid circular reference issues
            const errorMessage = safeExtractErrorMessage(error);
            
            // Now safely log and set the error
            try {
              console.error('[useChat] SSE streaming error:', errorMessage);
            } catch {
              // If console.error fails (unlikely but possible), continue silently
            }
            
            setError(errorMessage);
            setSseConnected(false);
            setIsWaitingForResponse(false);
          },
          onDone: () => {
            setIsStreaming(false);
            setIsWaitingForResponse(false);
            
            // If we have streaming content but no final message, create one
            if (streamingMessageRef.current && !hasReceivedAgentResponseRef.current) {
              const agentMessage: Message = {
                id: `agent-${Date.now()}-${Math.random()}`,
                text: streamingMessageRef.current,
                userId: agentId,
                agentId,
                sessionId: sessionId || '',
                createdAt: new Date().toISOString(),
                role: 'agent',
              };

              setMessages((prev) => {
                const filtered = prev.filter(m => !m.id.startsWith('agent-streaming-'));
                // Sanitize all messages to ensure prediction prompts are hidden
                return [...filtered, agentMessage].map(sanitizePredictionMessage);
              });

              lastAgentMessageTimeRef.current = Date.now();
              hasReceivedAgentResponseRef.current = true;
              
              // Save agent message (but don't block UI if it fails)
              const { isAuthenticated: auth, supabaseUserId: sbId } = authStateRef.current;
              saveMessage(agentMessage, sbId, auth).catch((err) => {
                // Extract error message safely
                const errorMsg = safeExtractErrorMessage(err);
                console.error('[useChat] Failed to save streaming message:', errorMsg);
                // Don't set error state - message is already displayed, saving is just for persistence
              });
            }
            
            setStreamingMessage('');
            streamingMessageRef.current = '';
          },
        },
        metadata
      );

      // Track the message ID we just sent so polling doesn't fetch it again
      if (response.messageId) {
        recentlySentMessageIdsRef.current.add(response.messageId);
        // Clean up after 10 seconds (polling happens at 2s and 5s intervals)
        setTimeout(() => {
          recentlySentMessageIdsRef.current.delete(response.messageId);
        }, 10000);
      }

      // Update user message with actual ID from response
      // IMPORTANT: Preserve displayText for prediction messages
      if (response.messageId !== tempUserMessageId && !skipAddingUserMessage) {
        setMessages((prev) => 
          prev.map(m => {
            if (m.id === tempUserMessageId) {
              const updated = { ...m, id: response.messageId };
              // Re-sanitize to ensure displayText is preserved
              return sanitizePredictionMessage(updated);
            }
            return m;
          })
        );
      }

      // Only save user message if we added it to UI
      // For prediction messages with displayText, save the display version, not the actual text
      if (!skipAddingUserMessage) {
        await saveMessage({ ...userMessage, id: response.messageId }, supabaseUserId, isAuthenticated);
      } else {
        // For messages with displayText (prediction messages), save the display version
        // The actual text is stored in metadata.actualText
        const messageToSave = userMessage.metadata?.displayText 
          ? { ...userMessage, text: userMessage.metadata.displayText as string, id: response.messageId }
          : { ...userMessage, id: response.messageId };
        await saveMessage(messageToSave, supabaseUserId, isAuthenticated);
      }

      if (enableMemory && isAuthenticated && supabaseUserId) {
        trackInteraction(1, isNewSessionRef.current).catch((err) => {
          console.error('[useChat] Failed to track interaction:', safeExtractErrorMessage(err));
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'trackInteraction',
            sessionId,
            userId: supabaseUserId || undefined,
            metadata: { isNewSession: isNewSessionRef.current },
          });
        });
        isNewSessionRef.current = false;
        extractEntities(text, response.messageId).catch((err) => {
          console.error('[useChat] Failed to extract entities:', safeExtractErrorMessage(err));
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'extractEntities',
            sessionId,
            userId: supabaseUserId || undefined,
            metadata: { messageId: response.messageId },
          });
        });
      }

      return response;
    },
    onError: (error) => {
      // Safely extract error message to avoid circular reference issues
      const errorMessage = safeExtractErrorMessage(error);
      
      console.error('Failed to send message:', errorMessage);
      
      // Only capture error if it's not a circular reference error
      if (!errorMessage.includes('circular') && !errorMessage.includes('cyclic') && !errorMessage.includes('JSON.stringify')) {
        captureError(error instanceof Error ? error : new Error(errorMessage), {
          component: 'useChat',
          action: 'sendMessage',
          sessionId: sessionId || undefined,
          userId,
          agentId,
          metadata: { errorMessage },
        });
      }

      // Check if session is invalid/not found
      if (
        error instanceof SessionNotFoundError ||
        errorMessage.includes('not found') ||
        errorMessage.includes('Session') ||
        errorMessage.includes('SESSION_NOT_FOUND')
      ) {
        setError('This session has expired or been deleted. Please create a new session.');
        if (sessionId) onSessionInvalid?.(sessionId);
      } else {
        setError(errorMessage);
      }
    },
    onSuccess: async () => {
      if (!sessionId) return;

      const pollForMessages = async () => {
        try {
          const messagesResponse = await getMessagesAPI(sessionId);
          if (!messagesResponse.messages?.length) return;

          const apiMessages = messagesResponse.messages
            .map((msg: any) => convertApiMessageToMessage(msg, sessionId, agentId))
            // EXCLUDE messages we just sent - this prevents duplicates
            .filter(msg => !recentlySentMessageIdsRef.current.has(msg.id));

          if (apiMessages.length === 0) return;

          // Merge messages and sanitize all to hide prediction prompts
          setMessages((prev) => {
            const merged = mergeMessages(prev, apiMessages);
            // Sanitize all messages to ensure prediction prompts are hidden
            return merged.map(sanitizePredictionMessage);
          });
          
          // Only save non-prediction messages or prediction messages with displayText preserved
          const messagesToSave = apiMessages.map(m => {
            // If this is a prediction message, check if we should save it
            // Don't save prediction messages that would overwrite displayText
            if (m.metadata?.isPredictionMessage) {
              // Only save if it has displayText in metadata
              if (m.metadata?.displayText) {
                return {
                  ...m,
                  text: m.metadata.displayText as string,
                };
              }
              // Don't save prediction messages without displayText - they would overwrite our display version
              return null;
            }
            return m;
          }).filter((m): m is Message => m !== null);
          
          if (messagesToSave.length > 0) {
            await Promise.all(
              messagesToSave.map((m) => saveMessage(m, supabaseUserId, isAuthenticated))
            );
          }
        } catch (error) {
          console.error('Error fetching messages:', safeExtractErrorMessage(error));
          captureError(error instanceof Error ? error : new Error(String(error)), {
            component: 'useChat',
            action: 'pollForMessages',
            sessionId,
            metadata: { source: 'REST_API' },
          });
        }
      };

      const initialTimeout = setTimeout(pollForMessages, 2000);
      const pollInterval = setInterval(pollForMessages, 5000);
      setTimeout(() => {
        clearTimeout(initialTimeout);
        clearInterval(pollInterval);
      }, 30000);
    },
  });

  const lastUserMessageRef = useRef<{ text: string; timestamp: number } | null>(null);
  const lastAgentMessageTimeRef = useRef<number>(0);
  const hasReceivedAgentResponseRef = useRef<boolean>(false);

  // Update streaming message in UI as it arrives
  useEffect(() => {
    if (!streamingMessage || !isStreaming) return;

    const agentMessage: Message = {
      id: `agent-streaming-${sessionId}`,
      text: streamingMessage,
      userId: agentId,
      agentId,
      sessionId: sessionId || '',
      createdAt: new Date().toISOString(),
      role: 'agent',
    };

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.id === `agent-streaming-${sessionId}`) {
        // Sanitize all messages to ensure prediction prompts are hidden
        return [...prev.slice(0, -1), agentMessage].map(sanitizePredictionMessage);
      }
      // Only add if we don't already have a final agent message
      if (lastMessage?.role === 'agent' && !lastMessage.id.startsWith('agent-streaming-')) {
        return prev.map(sanitizePredictionMessage);
      }
      // Sanitize all messages to ensure prediction prompts are hidden
      return [...prev, agentMessage].map(sanitizePredictionMessage);
    });
  }, [streamingMessage, agentId, sessionId, isStreaming]);

  useEffect(() => {
    if (!sessionId || isAuthLoading || isLoadingRef.current) return;
    if (loadedSessionRef.current === sessionId) return;

    const loadMessages = async () => {
      isLoadingRef.current = true;
      loadedSessionRef.current = sessionId;

      const { isAuthenticated: isAuth, supabaseUserId: sbUserId } = authStateRef.current;
      let loaded = false;

      if (isAuth && sbUserId && isSupabaseConfigured()) {
        const supabaseMessages = await getMessagesFromSupabase(sessionId).catch((err) => {
          console.warn('[useChat] Failed to load from Supabase:', safeExtractErrorMessage(err));
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'loadMessages',
            sessionId,
            userId: sbUserId || undefined,
            metadata: { source: 'Supabase' },
          });
          return [];
        });
        if (supabaseMessages.length > 0) {
          // Sanitize all messages to hide prediction prompts
          const processedMessages = supabaseMessages.map(sanitizePredictionMessage);
          setMessages(processedMessages);
          loaded = true;
          Promise.all(supabaseMessages.map(saveLocalMessage)).catch((err) => {
            console.warn('[useChat] Failed to sync to local:', safeExtractErrorMessage(err));
            captureError(err instanceof Error ? err : new Error(String(err)), {
              component: 'useChat',
              action: 'syncToLocal',
              sessionId,
              metadata: { messageCount: supabaseMessages.length },
            });
          });
        }
      }

      if (!loaded) {
        const stored = await getStoredMessages(sessionId).catch((err) => {
          console.warn('[useChat] Failed to load from local:', safeExtractErrorMessage(err));
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'loadMessages',
            sessionId,
            metadata: { source: 'localStorage' },
          });
          return [];
        });
        if (stored.length > 0) {
          // Sanitize all messages to hide prediction prompts
          const processedMessages = stored.map(sanitizePredictionMessage);
          setMessages(processedMessages);
          loaded = true;
        }
      }

      const messagesResponse = await getMessagesAPI(sessionId).catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (
          err instanceof SessionNotFoundError ||
          errorMessage.includes('not found') ||
          errorMessage.includes('Session') ||
          errorMessage.includes('SESSION_NOT_FOUND') ||
          errorMessage.includes('404') ||
          errorMessage.includes('400')
        ) {
          onSessionInvalidRef.current?.(sessionId);
        } else if (!errorMessage.includes('Too many requests')) {
          console.error('Error loading messages:', safeExtractErrorMessage(err));
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'loadMessages',
            sessionId,
            metadata: { source: 'API', errorMessage },
          });
        }
        return null;
      });

      if (messagesResponse?.messages?.length) {
        const apiMessages = messagesResponse.messages
          .map((msg: any) => convertApiMessageToMessage(msg, sessionId, agentId))
          .map(sanitizePredictionMessage);
        setMessages(apiMessages);
        
        const { isAuthenticated: currentAuth, supabaseUserId: currentSbId } = authStateRef.current;
        Promise.all(
          apiMessages.map((m) => saveMessage(m, currentSbId, currentAuth))
        ).catch((err) => {
          console.warn('[useChat] Failed to save API messages:', safeExtractErrorMessage(err));
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'saveAPIMessages',
            sessionId,
            userId: currentSbId || undefined,
            metadata: { messageCount: apiMessages.length },
          });
        });
      }

      isLoadingRef.current = false;
    };

    loadMessages();
  }, [sessionId, isAuthLoading, agentId]);

  useEffect(() => {
    if (sessionId !== loadedSessionRef.current) {
      setMessages([]);
      setStreamingMessage('');
      setError(null);
      setSseConnected(false);
      loadedSessionRef.current = null;
      isLoadingRef.current = false;
    }
  }, [sessionId]);

  const sendMessage = useCallback(
    (text: string, displayText?: string, metadata?: { action?: 'predict'; context?: Record<string, unknown> }) => {
      if (!text.trim() || !sessionId) return;
      sendMessageMutation.mutate({ text, displayText, metadata, skipAddingUserMessage: false });
    },
    [sendMessageMutation, sessionId]
  );

  const sendMessageWithDisplayText = useCallback(
    (displayText: string, actualText: string, metadata?: { action?: 'predict'; context?: Record<string, unknown> }) => {
      if (!actualText.trim() || !sessionId) {
        return Promise.reject(new Error('Invalid message or session'));
      }
      
      const shouldShowDisplayMessage = displayText.trim().length > 0;
      const tempUserMessageId = shouldShowDisplayMessage ? `user-${Date.now()}` : undefined;
      
      // Sanitize metadata before using it to prevent circular references
      const sanitizedMetadata = metadata ? sanitizeMetadata(metadata) : undefined;
      
      if (shouldShowDisplayMessage && tempUserMessageId) {
        const displayMessage: Message = {
          id: tempUserMessageId,
          text: displayText,
          userId,
          sessionId,
          createdAt: new Date().toISOString(),
          role: 'user',
          metadata: sanitizeMetadata({
            ...sanitizedMetadata,
            displayText: displayText,
            isPredictionMessage: true,
            actualText: actualText,
          }),
        };
        setMessages((prev) => [...prev, sanitizePredictionMessage(displayMessage)]);
      }
      
      return new Promise<SendMessageResponse>((resolve, reject) => {
        sendMessageMutation.mutate(
          { text: actualText, metadata: sanitizedMetadata, skipAddingUserMessage: true },
          {
            onSuccess: (response) => {
              if (shouldShowDisplayMessage && tempUserMessageId) {
                const realMessageId = response.messageId;
                
                // Track this message ID so polling doesn't fetch it
                if (realMessageId) {
                  recentlySentMessageIdsRef.current.add(realMessageId);
                  setTimeout(() => {
                    recentlySentMessageIdsRef.current.delete(realMessageId);
                  }, 10000);
                }
                
                // Update temp ID to real ID immediately
                setMessages((prev) => 
                  prev.map(m => {
                    if (m.id === tempUserMessageId) {
                      return {
                        ...m,
                        id: realMessageId,
                        text: displayText, // Ensure text is always displayText for prediction messages
                        metadata: sanitizeMetadata({
                          ...m.metadata,
                          displayText: displayText,
                          isPredictionMessage: true,
                          actualText: actualText,
                        }),
                      };
                    }
                    return m;
                  })
                );
              }
              resolve(response);
            },
            onError: (error) => {
              if (shouldShowDisplayMessage && tempUserMessageId) {
                setMessages((prev) => prev.filter(m => m.id !== tempUserMessageId));
              }
              reject(error);
            },
          }
        );
      });
    },
    [sendMessageMutation, sessionId, userId]
  );

  useEffect(() => {
    isNewSessionRef.current = true;
  }, [sessionId]);

  const knowledgeContextPrompt = knowledgeContext.length > 0
    ? formatSearchResultsForContext(knowledgeContext)
    : '';

  return {
    messages,
    sendMessage,
    sendMessageWithDisplayText,
    isSending: sendMessageMutation.isPending,
    isWaitingForResponse,
    isConnected: sseConnected,
    isTyping: !!streamingMessage,
    isStreaming,
    thoughtProcess,
    status: isStreaming ? 'processing' : streamingMessage ? 'typing' : 'idle',
    error,
    memoryContext,
    memoryContextPrompt,
    isMemoryLoading,
    memoryActions: {
      saveFact,
      saveIntent,
      saveSummary,
      updateSummary,
      summarizeConversation,
    },
    knowledgeContext,
    knowledgeContextPrompt,
    hasKnowledge,
  };
}
