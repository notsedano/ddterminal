import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { sendMessage as sendMessageAPI } from '@/services/api/messages';
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
import { convertApiMessageToMessage, mergeMessages, isMessageRelated } from '@/utils/messageUtils';
import { captureError } from '@/utils/errorTracking';
import type { Message } from '@/types';
import type { KnowledgeSearchResult } from '@/types/knowledge';

export interface UseChatOptions {
  sessionId: string | null;
  agentId: string;
  roomId: string;
  onSessionInvalid?: (sessionId: string) => void;
  enableMemory?: boolean;
  enableKnowledge?: boolean;
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
      console.warn(`[useChat] Session ${sessionId.slice(0, 8)}... not found:`, error);
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
      console.error(`[useChat] Failed to save session:`, error);
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

async function saveMessage(
  message: Message,
  supabaseUserId: string | null,
  isAuthenticated: boolean
): Promise<void> {
  await saveLocalMessage(message);

  if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
    try {
      const sessionExists = await ensureSessionInSupabase(message.sessionId, supabaseUserId);
      if (!sessionExists) {
        console.warn(`[useChat] Skipping Supabase save - session doesn't exist`);
        return;
      }
      await saveMessageToSupabase(message, supabaseUserId);
    } catch (error) {
      console.error(`[useChat] Failed to save message to Supabase:`, error);
      captureError(error instanceof Error ? error : new Error(String(error)), {
        component: 'useChat',
        action: 'saveMessage',
        sessionId: message.sessionId,
        userId: supabaseUserId || undefined,
        metadata: { messageId: message.id, role: message.role },
      });
    }
  }
}

export function useChat({ sessionId, agentId, roomId, onSessionInvalid, enableMemory = true, enableKnowledge = true }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [knowledgeContext, setKnowledgeContext] = useState<KnowledgeSearchResult[]>([]);
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

  // Regular chat uses REST API (no streaming)
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, displayText }: { text: string; displayText?: string }) => {
      if (!sessionId) throw new Error('No session available');

      // Use displayText for UI, but send actual text to backend
      const messageToDisplay = displayText || text;

      // Search for relevant knowledge context if session has knowledge
      if (enableKnowledge && hasKnowledge) {
        searchSessionKnowledge(sessionId, text, 5)
          .then((results) => {
            setKnowledgeContext(results);
          })
          .catch((err) => {
            console.warn('[useChat] Knowledge search failed:', err);
            captureError(err instanceof Error ? err : new Error(String(err)), {
              component: 'useChat',
              action: 'searchKnowledge',
              sessionId: sessionId || undefined,
              metadata: { query: text.substring(0, 100) },
            });
          });
      }

      // Add user message immediately with display text
      const tempUserMessageId = `user-${Date.now()}`;
      const userMessage: Message = {
        id: tempUserMessageId,
        text: messageToDisplay,
        userId,
        sessionId,
        createdAt: new Date().toISOString(),
        role: 'user',
      };

      lastUserMessageRef.current = {
        text: messageToDisplay,
        timestamp: Date.now(),
      };
      lastAgentMessageTimeRef.current = 0;
      hasReceivedAgentResponseRef.current = false;

      setMessages((prev) => [...prev, userMessage]);

      // Try SSE streaming first (backend requires transport: 'sse' to generate responses)
      // Fall back to REST API if SSE fails
      let response: SendMessageResponse;
      let useSSE = true;
      
      try {
        const { sendMessageWithStreaming } = await import('@/services/api/messages');
        console.log('[useChat] Attempting SSE streaming for message...');
        
        response = await sendMessageWithStreaming(
          sessionId,
          { text, userId },
          {
            onChunk: (chunkEvent) => {
              console.log('[useChat] SSE chunk received:', chunkEvent.chunk.substring(0, 50));
              // Handle streaming chunks - add to messages as they arrive
              if (chunkEvent.messageId) {
                setMessages((prev) => {
                  const existingIndex = prev.findIndex(m => m.id === chunkEvent.messageId);
                  if (existingIndex >= 0) {
                    // Update existing message with new chunk
                    const updated = [...prev];
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      text: (updated[existingIndex].text || '') + chunkEvent.chunk,
                    };
                    return updated;
                  } else {
                    // Create new streaming message
                    return [...prev, {
                      id: chunkEvent.messageId || `streaming-${Date.now()}`,
                      text: chunkEvent.chunk,
                      userId: agentId,
                      sessionId,
                      createdAt: new Date().toISOString(),
                      role: 'assistant',
                    }];
                  }
                });
              }
            },
            onMessage: (messageEvent) => {
              console.log('[useChat] SSE message received:', messageEvent.text.substring(0, 50));
              // Final complete message
              const agentMessage: Message = {
                id: messageEvent.messageId,
                text: messageEvent.text,
                userId: messageEvent.agentId,
                sessionId: messageEvent.sessionId || sessionId,
                createdAt: messageEvent.timestamp || new Date().toISOString(),
                role: 'assistant',
              };
              setMessages((prev) => mergeMessages(prev, [agentMessage]));
              saveMessage(agentMessage, supabaseUserId, isAuthenticated).catch(console.error);
              hasReceivedAgentResponseRef.current = true;
            },
            onError: (error) => {
              console.error('[useChat] SSE error:', error);
              // Fall back to REST API
              useSSE = false;
            },
            onDone: () => {
              console.log('[useChat] SSE stream completed');
              hasReceivedAgentResponseRef.current = true;
            },
          }
        );
        console.log('[useChat] SSE streaming successful');
      } catch (sseError) {
        console.warn('[useChat] SSE streaming failed, falling back to REST API:', sseError);
        useSSE = false;
        // Fall back to REST API
        response = await sendMessageAPI(sessionId, { text, userId });
      }
      
      // Store whether we used SSE for the onSuccess handler
      lastMessageUsedSSERef.current = useSSE;

      // Update user message with actual ID from response
      if (response.messageId !== tempUserMessageId) {
        setMessages((prev) => 
          prev.map(m => m.id === tempUserMessageId ? { ...m, id: response.messageId } : m)
        );
      }

      // Save message with display text for UI consistency
      await saveMessage({ ...userMessage, id: response.messageId }, supabaseUserId, isAuthenticated);

      if (enableMemory && isAuthenticated && supabaseUserId) {
        trackInteraction(1, isNewSessionRef.current).catch((err) => {
          console.error('[useChat] Failed to track interaction:', err);
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
          console.error('[useChat] Failed to extract entities:', err);
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'extractEntities',
            sessionId,
            userId: supabaseUserId || undefined,
            metadata: { messageId: response.messageId },
          });
        });
      }

      // Fetch agent response after sending message
      // The backend will process the message and we'll get it via polling
      console.log('[useChat] Message sent successfully, starting polling for agent response');
      return response;
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to send message:', error);
      captureError(error instanceof Error ? error : new Error(String(error)), {
        component: 'useChat',
        action: 'sendMessage',
        sessionId: sessionId || undefined,
        userId,
        agentId,
        metadata: { errorMessage },
      });

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
      
      // Check if we used SSE streaming
      if (lastMessageUsedSSERef.current) {
        console.log('[useChat] SSE streaming used, skipping polling');
        lastMessageUsedSSERef.current = false; // Reset for next message
        return; // SSE handles responses in real-time via callbacks
      }

      console.log('[useChat] Using REST API, starting polling for agent response');
      let shouldStopPolling = false;

      const pollForMessages = async () => {
        if (shouldStopPolling) {
          console.log('[useChat] Polling stopped');
          return;
        }
        
        try {
          console.log('[useChat] Polling for messages...');
          const messagesResponse = await getMessagesAPI(sessionId);
          console.log('[useChat] Poll response:', {
            messageCount: messagesResponse.messages?.length || 0,
            messages: messagesResponse.messages?.map((m: any) => ({
              id: m.id,
              role: m.author_id === agentId ? 'agent' : 'user',
              content: m.content?.substring(0, 50) + '...',
            })),
          });
          
          if (!messagesResponse.messages?.length) {
            console.log('[useChat] No new messages in poll response');
            return;
          }

          const apiMessages = messagesResponse.messages.map((msg: any) =>
            convertApiMessageToMessage(msg, sessionId, agentId)
          );

          console.log('[useChat] Adding messages to UI:', apiMessages.length);
          setMessages((prev) => mergeMessages(prev, apiMessages));
          await Promise.all(
            apiMessages.map((m) => saveMessage(m, supabaseUserId, isAuthenticated))
          );
          
          // Check if we got an agent response
          const agentMessages = apiMessages.filter(m => m.role === 'assistant');
          if (agentMessages.length > 0) {
            console.log('[useChat] Agent response received!', agentMessages.length, 'message(s)');
            hasReceivedAgentResponseRef.current = true;
            shouldStopPolling = true; // Stop polling once we get a response
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Stop polling if session is not found
          if (
            error instanceof SessionNotFoundError ||
            errorMessage.includes('404') ||
            errorMessage.includes('not found')
          ) {
            shouldStopPolling = true;
            console.warn('[useChat] Session not found, stopping poll');
            return;
          }
          console.error('Error fetching messages:', error);
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
  const lastMessageUsedSSERef = useRef<boolean>(false);

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
          console.warn('[useChat] Failed to load from Supabase:', err);
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
          // Use mergeMessages to preserve any messages added during the fetch
          setMessages((prev) => mergeMessages(prev, supabaseMessages));
          loaded = true;
          Promise.all(supabaseMessages.map(saveLocalMessage)).catch((err) => {
            console.warn('[useChat] Failed to sync to local:', err);
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
          console.warn('[useChat] Failed to load from local:', err);
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'loadMessages',
            sessionId,
            metadata: { source: 'localStorage' },
          });
          return [];
        });
        if (stored.length > 0) {
          // Use mergeMessages to preserve any messages added during the fetch
          setMessages((prev) => mergeMessages(prev, stored));
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
          console.error('Error loading messages:', err);
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
        const apiMessages = messagesResponse.messages.map((msg: any) =>
          convertApiMessageToMessage(msg, sessionId, agentId)
        );
        // Use mergeMessages to preserve any messages added during the fetch
        setMessages((prev) => mergeMessages(prev, apiMessages));
        
        const { isAuthenticated: currentAuth, supabaseUserId: currentSbId } = authStateRef.current;
        Promise.all(
          apiMessages.map((m) => saveMessage(m, currentSbId, currentAuth))
        ).catch((err) => {
          console.warn('[useChat] Failed to save API messages:', err);
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
      setError(null);
      loadedSessionRef.current = null;
      isLoadingRef.current = false;
    }
  }, [sessionId]);

  const sendMessage = useCallback(
    (text: string, displayText?: string) => {
      if (!text.trim() || !sessionId) {
        return;
      }
      sendMessageMutation.mutate({ text, displayText });
    },
    [sendMessageMutation, sessionId]
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
    isSending: sendMessageMutation.isPending,
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
