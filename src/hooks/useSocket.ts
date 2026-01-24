import { useEffect, useRef, useState, useCallback } from 'react';
import ElizaSocketClient, { type SocketEventHandlers } from '@/services/websocket/socketClient';
import type { SocketMessageEvent } from '@/types';

export interface UseSocketOptions {
  agentId: string;
  roomId: string;
  enabled?: boolean;
}

export function useSocket({ agentId, roomId, enabled = true }: UseSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'typing' | 'error'>('idle');
  const socketRef = useRef<ElizaSocketClient | null>(null);
  const messageHandlersRef = useRef<{
    onMessage?: (data: SocketMessageEvent) => void;
  }>({});

  const wsUrl = (() => {
    if (typeof window !== 'undefined' && window.ELIZA_CONFIG?.apiBase) {
      return window.ELIZA_CONFIG.apiBase;
    }
    return import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';
  })();

  const connect = useCallback(() => {
    if (!enabled || !wsUrl || socketRef.current) return;

    const socket = new ElizaSocketClient(wsUrl);
    socketRef.current = socket;

    const handlers: SocketEventHandlers = {
      onConnected: () => {
        setIsConnected(true);
        setStatus('idle');
      },
      onDisconnected: () => {
        setIsConnected(false);
        setStatus('idle');
      },
      onMessage: (data) => {
        messageHandlersRef.current.onMessage?.(data);
        setIsTyping(false);
        setStatus('idle');
      },
      onTyping: (data) => {
        setIsTyping(data.isTyping);
        setStatus(data.isTyping ? 'typing' : 'idle');
      },
      onStatus: (data) => {
        setStatus(data.status);
        if (data.status === 'error') {
          console.error('Socket status error:', data.message);
        }
      },
      onError: (error) => {
        console.error('Socket error:', error);
        setStatus('error');
      },
    };

    socket.connect(agentId, roomId, handlers);
  }, [agentId, roomId, enabled, wsUrl]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setStatus('idle');
      setIsTyping(false);
    }
  }, []);

  const sendMessage = useCallback((text: string, userId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.sendMessage(agentId, text, userId, roomId);
      setStatus('processing');
    }
  }, [agentId, roomId, isConnected]);

  const onMessage = useCallback((handler: (data: SocketMessageEvent) => void) => {
    messageHandlersRef.current.onMessage = handler;
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    isTyping,
    status,
    sendMessage,
    onMessage,
    connect,
    disconnect,
  };
}
