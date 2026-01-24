import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage as sendMessageAPI } from '@/services/api/messages';
import { getMessages as getMessagesAPI } from '@/services/api/sessions';
import { saveMessage, getMessages as getStoredMessages } from '@/services/storage/conversationStorage';
import { useSocket } from './useSocket';
import { getUserId } from '@/utils/storage';
import { convertApiMessageToMessage, mergeMessages } from '@/utils/messageUtils';
import type { Message, SocketMessageEvent } from '@/types';

export interface UseChatOptions {
  sessionId: string | null;
  agentId: string;
  roomId: string;
  onSessionInvalid?: (sessionId: string) => void;
}

export function useChat({ sessionId, agentId, roomId, onSessionInvalid }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const userId = getUserId();

  const socket = useSocket({
    agentId,
    roomId,
    enabled: !!sessionId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!sessionId) throw new Error('No session available');
      
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

      await saveMessage(userMessage);
      setMessages((prev) => [...prev, userMessage]);
      
      return response;
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to send message:', error);
      
      // Check if session is invalid/not found
      if (errorMessage.includes('not found') || errorMessage.includes('Session')) {
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
          await Promise.all(apiMessages.map(saveMessage));
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

  useEffect(() => {
    const handler = (data: SocketMessageEvent) => {
      if (data.text) {
        setStreamingMessage((prev) => prev + data.text);
      }
    };
    
    socket.onMessage(handler);
  }, [socket, sessionId]);

  useEffect(() => {
    if (streamingMessage && !socket.isTyping) {
      const agentMessage: Message = {
        id: `agent-${Date.now()}-${Math.random()}`,
        text: streamingMessage,
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

      saveMessage(agentMessage);
      setStreamingMessage('');
    }
  }, [streamingMessage, socket.isTyping, agentId, sessionId]);

  const loadMessages = useCallback(async () => {
    if (!sessionId) return;

    // Try to load from storage first for instant display
    const stored = await getStoredMessages(sessionId);
    if (stored.length > 0) {
      setMessages(stored);
    }

      // Then fetch from API to get latest messages
      try {
        const messagesResponse = await getMessagesAPI(sessionId);
        if (messagesResponse.messages?.length) {
          const apiMessages = messagesResponse.messages.map((msg: any) =>
            convertApiMessageToMessage(msg, sessionId, agentId)
          );
          
          setMessages(apiMessages);
          await Promise.all(apiMessages.map(saveMessage));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error loading messages from API:', error);
        
        // Check if session is invalid
        if (errorMessage.includes('not found') || errorMessage.includes('Session')) {
          setError('This session has expired or been deleted.');
          onSessionInvalid?.(sessionId);
        }
        // Fall back to stored messages if API fails
      }

    queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
  }, [sessionId, queryClient, agentId, onSessionInvalid]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || !sessionId) return;
    sendMessageMutation.mutate(text);
  }, [sendMessageMutation, sessionId]);

  // Clear error when session changes
  useEffect(() => {
    setError(null);
  }, [sessionId]);

  return {
    messages,
    sendMessage,
    isSending: sendMessageMutation.isPending,
    isConnected: socket.isConnected,
    isTyping: socket.isTyping,
    status: socket.status,
    error,
  };
}
