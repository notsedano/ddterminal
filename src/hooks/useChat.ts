/**
 * Chat Hook
 * Manages chat messages with hybrid storage (Supabase + IndexedDB)
 * Includes memory context for personalized interactions
 */

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
import { convertApiMessageToMessage, mergeMessages } from '@/utils/messageUtils';
import { createSSEStream, type SSEChunkEvent, type SSEMessageEvent } from '@/utils/sse';
import type { Message } from '@/types';
import type { KnowledgeSearchResult } from '@/types/knowledge';

export interface UseChatOptions {
  sessionId: string | null;
  agentId: string;
  roomId: string;
  onSessionInvalid?: (sessionId: string) => void;
  /** Enable memory context loading for personalized interactions */
  enableMemory?: boolean;
  /** Enable knowledge context from session articles for RAG */
  enableKnowledge?: boolean;
}

/**
 * Ensure session exists in Supabase before saving messages
 * This handles the case where a session was created before auth was ready
 */
async function ensureSessionInSupabase(
  sessionId: string,
  supabaseUserId: string
): Promise<void> {
  // Check if session exists in Supabase
  const supabaseSession = await getSessionFromSupabase(sessionId);
  
  if (!supabaseSession) {
    // Session doesn't exist in Supabase - try to get it from local storage and save it
    const localSession = await getLocalSession(sessionId);
    
    if (localSession) {
      console.log(`[useChat] Session ${sessionId.slice(0, 8)}... not in Supabase, saving from local storage`);
      await saveSessionToSupabase(localSession, supabaseUserId);
    } else {
      // Session doesn't exist locally either - this shouldn't happen
      console.warn(`[useChat] Session ${sessionId.slice(0, 8)}... not found in local storage or Supabase`);
    }
  }
}

/**
 * Save message to both local and Supabase storage
 */
async function saveMessage(
  message: Message,
  supabaseUserId: string | null,
  isAuthenticated: boolean
): Promise<void> {
  // Always save locally for offline support
  await saveLocalMessage(message);

  // Save to Supabase if authenticated
  if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
    // Ensure session exists in Supabase first (handles race condition where
    // session was created before supabaseUserId was populated)
    await ensureSessionInSupabase(message.sessionId, supabaseUserId);
    
    await saveMessageToSupabase(message, supabaseUserId);
  }
}

export function useChat({ sessionId, agentId, roomId, onSessionInvalid, enableMemory = true, enableKnowledge = true }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [knowledgeContext, setKnowledgeContext] = useState<KnowledgeSearchResult[]>([]);
  const [sseConnected, setSseConnected] = useState(false); // Track actual SSE connection state
  const isNewSessionRef = useRef(true);
  const userId = getUserId();
  const { isAuthenticated, supabaseUserId, isLoading: isAuthLoading } = useAuth();

  // Track which session we've loaded to prevent duplicate loads
  const loadedSessionRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  // Use refs to avoid recreation of callbacks when auth state changes
  const authStateRef = useRef({ isAuthenticated, supabaseUserId });
  authStateRef.current = { isAuthenticated, supabaseUserId };
  
  const onSessionInvalidRef = useRef(onSessionInvalid);
  onSessionInvalidRef.current = onSessionInvalid;

  // Memory context for personalized interactions
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

  // Memory extraction for learning from conversations
  const { extractEntities, saveFact, saveIntent, summarizeConversation } = useMemoryExtraction(agentId, sessionId);

  // Check if session has knowledge articles
  const { data: hasKnowledge = false } = useQuery({
    queryKey: ['session-has-knowledge', sessionId],
    queryFn: () => sessionHasKnowledge(sessionId!),
    enabled: !!sessionId && enableKnowledge,
    staleTime: 30_000,
  });

  // Socket.IO connection - optional for bidirectional features (non-blocking)
  // SSE is used for streaming instead
  useSocket({
    agentId,
    roomId,
    enabled: false, // Disabled - using SSE for streaming instead
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

      await saveMessage(userMessage, supabaseUserId, isAuthenticated);
      setMessages((prev) => [...prev, userMessage]);

      // Track interaction and extract memories (non-blocking)
      if (enableMemory && isAuthenticated && supabaseUserId) {
        // Track as new session if this is the first message
        trackInteraction(1, isNewSessionRef.current).catch(console.error);
        isNewSessionRef.current = false;

        // Extract entities and save memories from user message
        extractEntities(text, response.messageId).catch(console.error);
      }

      return response;
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to send message:', error);

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

      // Poll for agent response (fallback when WebSocket unavailable)
      const pollForMessages = async () => {
        try {
          const messagesResponse = await getMessagesAPI(sessionId);
          if (!messagesResponse.messages?.length) return;

          const apiMessages = messagesResponse.messages.map((msg: any) =>
            convertApiMessageToMessage(msg, sessionId, agentId)
          );

          setMessages((prev) => mergeMessages(prev, apiMessages));

          // Save new messages to storage
          await Promise.all(
            apiMessages.map((m) => saveMessage(m, supabaseUserId, isAuthenticated))
          );
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };

      // Initial fetch after delay
      const initialTimeout = setTimeout(pollForMessages, 2000);

      // Poll periodically
      const pollInterval = setInterval(pollForMessages, 5000);

      // Clear polling after 30 seconds
      setTimeout(() => {
        clearTimeout(initialTimeout);
        clearInterval(pollInterval);
      }, 30000);
    },
  });

  // Ref to track current streaming message for onDone handler
  const streamingMessageRef = useRef('');
  useEffect(() => {
    streamingMessageRef.current = streamingMessage;
  }, [streamingMessage]);

  // SSE connection for streaming AI responses
  useEffect(() => {
    if (!sessionId || !agentId || !roomId) {
      console.log('[useChat] Skipping SSE - missing required params:', { sessionId: !!sessionId, agentId: !!agentId, roomId: !!roomId });
      return;
    }

    console.log('[useChat] Setting up SSE stream for streaming responses', { agentId, roomId, sessionId });

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
        // Handle complete message (alternative to chunk-based streaming)
        if (data.text) {
          const agentMessage: Message = {
            id: data.messageId || `agent-${Date.now()}-${Math.random()}`,
            text: data.text,
            userId: data.agentId,
            agentId: data.agentId,
            sessionId: data.sessionId || sessionId,
            createdAt: data.timestamp || new Date().toISOString(),
            role: 'agent',
          };

          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            // Replace streaming message if it exists
            if (lastMessage?.role === 'agent' && lastMessage.id.startsWith('agent-')) {
              return [...prev.slice(0, -1), agentMessage];
            }
            return [...prev, agentMessage];
          });

          const { isAuthenticated: auth, supabaseUserId: sbId } = authStateRef.current;
          saveMessage(agentMessage, sbId, auth);
          setStreamingMessage('');
          streamingMessageRef.current = '';
        }
      },
      onError: (error) => {
        console.error('[useChat] SSE error:', error);
        setSseConnected(false); // Mark as disconnected on error
        
        // If endpoint doesn't exist (404), log a helpful message but don't show error to user
        if (error.code === 'ENDPOINT_NOT_FOUND') {
          console.warn('[useChat] SSE endpoint not available - falling back to REST API polling');
          // SSE is optional - REST API polling will handle message delivery
        }
        // Don't set error state - SSE failures are non-critical, REST polling will handle it
      },
      onDone: () => {
        // Stream complete - finalize any pending streaming message
        const currentStreaming = streamingMessageRef.current;
        if (currentStreaming) {
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
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.role === 'agent' && lastMessage.id.startsWith('agent-')) {
              return [...prev.slice(0, -1), agentMessage];
            }
            return [...prev, agentMessage];
          });

          const { isAuthenticated: auth, supabaseUserId: sbId } = authStateRef.current;
          saveMessage(agentMessage, sbId, auth);
          setStreamingMessage('');
          streamingMessageRef.current = '';
        }
      },
      onOpen: () => {
        console.log('[useChat] ✅ SSE stream opened - using SSE for real-time streaming');
        setSseConnected(true); // Mark as connected
      },
      onClose: () => {
        console.log('[useChat] SSE stream closed');
        setSseConnected(false); // Mark as disconnected
      },
    });

    return cleanup;
  }, [sessionId, agentId, roomId]);

  // Update UI with streaming message chunks (debounced to avoid too many re-renders)
  useEffect(() => {
    if (!streamingMessage) return;

    // Create/update streaming message in UI
    const agentMessage: Message = {
      id: `agent-streaming-${sessionId}`, // Use consistent ID for streaming message
      text: streamingMessage,
      userId: agentId,
      agentId,
      sessionId: sessionId || '',
      createdAt: new Date().toISOString(),
      role: 'agent',
    };

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      // Replace existing streaming message or add new one
      if (lastMessage?.id === `agent-streaming-${sessionId}`) {
        return [...prev.slice(0, -1), agentMessage];
      }
      return [...prev, agentMessage];
    });
  }, [streamingMessage, agentId, sessionId]);

  // Load messages - called once per session
  useEffect(() => {
    // Skip if no session, auth is loading, already loading, or already loaded this session
    if (!sessionId || isAuthLoading || isLoadingRef.current) return;
    if (loadedSessionRef.current === sessionId) return;

    const loadMessages = async () => {
      isLoadingRef.current = true;
      loadedSessionRef.current = sessionId;

      const { isAuthenticated: isAuth, supabaseUserId: sbUserId } = authStateRef.current;
      let loaded = false;

      // Try to load from Supabase first if authenticated
      if (isAuth && sbUserId && isSupabaseConfigured()) {
        const supabaseMessages = await getMessagesFromSupabase(sessionId).catch(() => []);
        if (supabaseMessages.length > 0) {
          setMessages(supabaseMessages);
          loaded = true;
          // Also sync to local storage (non-blocking)
          Promise.all(supabaseMessages.map(saveLocalMessage)).catch(() => {});
        }
      }

      // Then try local storage (only if we haven't loaded from Supabase)
      if (!loaded) {
        const stored = await getStoredMessages(sessionId).catch(() => []);
        if (stored.length > 0) {
          setMessages(stored);
          loaded = true;
        }
      }

      // Then fetch from API to get latest messages (only once)
      const messagesResponse = await getMessagesAPI(sessionId).catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Check if session is invalid or Sessions API unavailable
        if (
          err instanceof SessionNotFoundError ||
          errorMessage.includes('not found') ||
          errorMessage.includes('Session') ||
          errorMessage.includes('SESSION_NOT_FOUND') ||
          errorMessage.includes('404') ||
          errorMessage.includes('400')
        ) {
          console.warn(`[useChat] Session ${sessionId.slice(0, 8)}... not found on backend`);
          onSessionInvalidRef.current?.(sessionId);
        } else if (!errorMessage.includes('Too many requests')) {
          console.error('Error loading messages from API:', err);
        }
        return null;
      });

      if (messagesResponse?.messages?.length) {
        const apiMessages = messagesResponse.messages.map((msg: any) =>
          convertApiMessageToMessage(msg, sessionId, agentId)
        );
        setMessages(apiMessages);
        
        const { isAuthenticated: currentAuth, supabaseUserId: currentSbId } = authStateRef.current;
        // Save to storage non-blocking
        Promise.all(
          apiMessages.map((m) => saveMessage(m, currentSbId, currentAuth))
        ).catch(() => {});
      }

      isLoadingRef.current = false;
    };

    loadMessages();
  }, [sessionId, isAuthLoading, agentId]);

  // Clear messages and reset state when session changes
  useEffect(() => {
    if (sessionId !== loadedSessionRef.current) {
      setMessages([]);
      setStreamingMessage('');
      setError(null);
      setSseConnected(false); // Reset SSE connection state on session change
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

  // Reset new session flag when session changes
  useEffect(() => {
    isNewSessionRef.current = true;
  }, [sessionId]);

  // Format knowledge context for prompt injection
  const knowledgeContextPrompt = knowledgeContext.length > 0
    ? formatSearchResultsForContext(knowledgeContext)
    : '';

  return {
    messages,
    sendMessage,
    isSending: sendMessageMutation.isPending,
    isConnected: sseConnected, // Track actual SSE connection status
    isTyping: !!streamingMessage, // Typing indicator based on streaming state
    status: streamingMessage ? 'processing' : 'idle',
    error,
    // Memory context
    memoryContext,
    memoryContextPrompt,
    isMemoryLoading,
    // Memory actions for components that need direct access
    memoryActions: {
      saveFact,
      saveIntent,
      saveSummary,
      updateSummary,
      summarizeConversation,
    },
    // Knowledge context from session articles
    knowledgeContext,
    knowledgeContextPrompt,
    hasKnowledge,
  };
}
