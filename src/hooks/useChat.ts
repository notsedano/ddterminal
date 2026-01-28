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
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import { useMemory, useMemoryExtraction } from './useMemory';
import { getUserId } from '@/utils/storage';
import { convertApiMessageToMessage, mergeMessages, isMessageRelated } from '@/utils/messageUtils';
import { createSSEStream, type SSEChunkEvent, type SSEMessageEvent } from '@/utils/sse';
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
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [knowledgeContext, setKnowledgeContext] = useState<KnowledgeSearchResult[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
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

  useSocket({
    agentId,
    roomId,
    enabled: false,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!sessionId) throw new Error('No session available');

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

      const response = await sendMessageAPI(sessionId, {
        text,
        userId,
      });

      const userMessage: Message = {
        id: response.messageId,
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

      await saveMessage(userMessage, supabaseUserId, isAuthenticated);
      setMessages((prev) => [...prev, userMessage]);

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

      const pollForMessages = async () => {
        try {
          const messagesResponse = await getMessagesAPI(sessionId);
          if (!messagesResponse.messages?.length) return;

          const apiMessages = messagesResponse.messages.map((msg: any) =>
            convertApiMessageToMessage(msg, sessionId, agentId)
          );

          setMessages((prev) => mergeMessages(prev, apiMessages));
          await Promise.all(
            apiMessages.map((m) => saveMessage(m, supabaseUserId, isAuthenticated))
          );
        } catch (error) {
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

  const streamingMessageRef = useRef('');
  useEffect(() => {
    streamingMessageRef.current = streamingMessage;
  }, [streamingMessage]);

  const lastUserMessageRef = useRef<{ text: string; timestamp: number } | null>(null);
  const lastAgentMessageTimeRef = useRef<number>(0);
  const hasReceivedAgentResponseRef = useRef<boolean>(false);
  
  const shouldFilterMessage = useCallback((
    agentText: string,
    now: number,
    _existingMessages: Message[]
  ): boolean => {
    const lastUserMsg = lastUserMessageRef.current;
    if (!lastUserMsg) return false;
    
    const timeSinceUserMessage = now - lastUserMsg.timestamp;
    const timeSinceLastAgent = now - lastAgentMessageTimeRef.current;
    const related = isMessageRelated(agentText, lastUserMsg.text);
    
    if (hasReceivedAgentResponseRef.current && !related && timeSinceUserMessage < 60000) {
      return true;
    }
    if (timeSinceLastAgent < 5000 && !related) {
      return true;
    }
    
    return false;
  }, []);

  useEffect(() => {
    if (!sessionId || !agentId || !roomId) return;

    const cleanup = createSSEStream(agentId, roomId, {
      onChunk: (data: SSEChunkEvent) => {
        // Handle streaming chunks
        if (data.chunk) {
          setStreamingMessage((prev) => {
            const updated = prev + data.chunk;
            streamingMessageRef.current = updated;
            return updated;
          });
        }
      },
      onMessage: (data: SSEMessageEvent) => {
        if (!data.text) return;
        
        const now = Date.now();
        const messageId = data.messageId || `agent-${Date.now()}-${Math.random()}`;
        
        const agentMessage: Message = {
          id: messageId,
          text: data.text,
          userId: data.agentId,
          agentId: data.agentId,
          sessionId: data.sessionId || sessionId,
          createdAt: data.timestamp || new Date().toISOString(),
          role: 'agent',
        };
        
        setMessages((prev) => {
          // Check for duplicate ID
          if (prev.some(m => m.id === messageId)) {
            return prev;
          }
          
          // Check if should be filtered
          if (shouldFilterMessage(data.text, now, prev)) {
            return prev;
          }
          
          // Merge and add message
          const merged = mergeMessages(prev, [agentMessage]);
          const lastMessage = merged[merged.length - 1];
          
          // Replace streaming message if exists
          if (lastMessage?.role === 'agent' && lastMessage.id.startsWith('agent-streaming-')) {
            return [...merged.slice(0, -1), agentMessage];
          }
          
          return merged;
        });
        
        // Update tracking and save
        lastAgentMessageTimeRef.current = now;
        hasReceivedAgentResponseRef.current = true;
        setStreamingMessage('');
        streamingMessageRef.current = '';
        
        const { isAuthenticated: auth, supabaseUserId: sbId } = authStateRef.current;
        saveMessage(agentMessage, sbId, auth).catch((err) => {
          console.error('[useChat] Failed to save streaming message:', err);
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'saveStreamingMessage',
            sessionId: sessionId || undefined,
            userId: sbId || undefined,
            metadata: { messageId: agentMessage.id, source: 'SSE_done' },
          });
        });
      },
      onError: (error) => {
        console.error('[useChat] SSE error:', error);
        setSseConnected(false);
        if (error.code === 'ENDPOINT_NOT_FOUND') {
          console.warn('[useChat] SSE endpoint not available - falling back to REST API polling');
        } else {
          captureError(error instanceof Error ? error : new Error(String(error)), {
            component: 'useChat',
            action: 'SSE_connection',
            sessionId: sessionId || undefined,
            agentId,
            metadata: { errorCode: error.code, roomId },
          });
        }
      },
      onDone: () => {
        const currentStreaming = streamingMessageRef.current;
        if (!currentStreaming) return;
        
        const now = Date.now();
        
        setMessages((prev) => {
          if (shouldFilterMessage(currentStreaming, now, prev)) {
            setStreamingMessage('');
            streamingMessageRef.current = '';
            return prev;
          }
          return prev;
        });
        
        if (!streamingMessageRef.current) return;
        
        const agentMessage: Message = {
          id: `agent-${Date.now()}-${Math.random()}`,
          text: currentStreaming,
          userId: agentId,
          agentId,
          sessionId: sessionId || '',
          createdAt: new Date().toISOString(),
          role: 'agent',
        };

        setMessages((prev) => {
          const merged = mergeMessages(prev, [agentMessage]);
          const lastMessage = merged[merged.length - 1];
          if (lastMessage?.role === 'agent' && lastMessage.id.startsWith('agent-streaming-')) {
            return [...merged.slice(0, -1), agentMessage];
          }
          return merged;
        });

        lastAgentMessageTimeRef.current = now;
        hasReceivedAgentResponseRef.current = true;
        const { isAuthenticated: auth, supabaseUserId: sbId } = authStateRef.current;
        saveMessage(agentMessage, sbId, auth).catch((err) => {
          console.error('[useChat] Failed to save streaming message:', err);
          captureError(err instanceof Error ? err : new Error(String(err)), {
            component: 'useChat',
            action: 'saveStreamingMessage',
            sessionId: sessionId || undefined,
            userId: sbId || undefined,
            metadata: { messageId: agentMessage.id, source: 'SSE_done' },
          });
        });
        setStreamingMessage('');
        streamingMessageRef.current = '';
      },
      onOpen: () => {
        setSseConnected(true);
      },
      onClose: () => {
        setSseConnected(false);
      },
    });

    return cleanup;
  }, [sessionId, agentId, roomId]);

  useEffect(() => {
    if (!streamingMessage) return;

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
        return [...prev.slice(0, -1), agentMessage];
      }
      return [...prev, agentMessage];
    });
  }, [streamingMessage, agentId, sessionId]);

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
          setMessages(supabaseMessages);
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
          setMessages(stored);
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
        setMessages(apiMessages);
        
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
      setStreamingMessage('');
      setError(null);
      setSseConnected(false);
      loadedSessionRef.current = null;
      isLoadingRef.current = false;
    }
  }, [sessionId]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !sessionId) return;
      sendMessageMutation.mutate(text);
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
    isConnected: sseConnected,
    isTyping: !!streamingMessage,
    status: streamingMessage ? 'processing' : 'idle',
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
