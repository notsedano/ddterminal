import { useEffect, useRef, useState, useCallback } from 'react';
import ElizaSocketClient, { type SocketEventHandlers } from '@/services/websocket/socketClient';
import type { SocketMessageEvent } from '@/types';

const DEBUG = false; // Set to true for WebSocket connection debugging

function debugLog(context: string, message: string, data?: unknown): void {
  if (DEBUG) {
    const timestamp = new Date().toISOString().split('T')[1];
    if (data !== undefined) {
      console.log(`[useSocket ${timestamp}] ${context}: ${message}`, data);
    } else {
      console.log(`[useSocket ${timestamp}] ${context}: ${message}`);
    }
  }
}

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
  const isMountedRef = useRef(false);
  const messageHandlersRef = useRef<{
    onMessage?: (data: SocketMessageEvent) => void;
  }>({});

  const wsUrl = (() => {
    if (typeof window !== 'undefined' && window.ELIZA_CONFIG?.apiBase) {
      return window.ELIZA_CONFIG.apiBase;
    }
    return import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';
  })();

  const disconnect = useCallback(() => {
    debugLog('disconnect', 'Disconnecting socket...');
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setStatus('idle');
      setIsTyping(false);
      debugLog('disconnect', 'Socket disconnected');
    }
  }, []);

  const connect = useCallback(() => {
    debugLog('connect', 'Checking connection conditions...', { 
      enabled, 
      wsUrl, 
      hasExistingSocket: !!socketRef.current,
      isMounted: isMountedRef.current 
    });

    if (!enabled || !wsUrl) {
      debugLog('connect', 'Skipping connection', { reason: !enabled ? 'disabled' : 'no URL' });
      return;
    }

    if (socketRef.current) {
      debugLog('connect', 'Socket already exists, skipping');
      return;
    }

    debugLog('connect', 'Creating new ElizaSocketClient...', { wsUrl, agentId, roomId });
    const socket = new ElizaSocketClient(wsUrl);
    socketRef.current = socket;

    const handlers: SocketEventHandlers = {
      onConnected: () => {
        if (!isMountedRef.current) {
          debugLog('handler', 'onConnected ignored - component unmounted');
          return;
        }
        debugLog('handler', '✅ onConnected callback fired');
        setIsConnected(true);
        setStatus('idle');
      },
      onDisconnected: () => {
        if (!isMountedRef.current) {
          debugLog('handler', 'onDisconnected ignored - component unmounted');
          return;
        }
        debugLog('handler', '⚠️ onDisconnected callback fired');
        setIsConnected(false);
        setStatus('idle');
      },
      onMessage: (data) => {
        if (!isMountedRef.current) {
          debugLog('handler', 'onMessage ignored - component unmounted');
          return;
        }
        debugLog('handler', '📨 onMessage callback fired', data);
        messageHandlersRef.current.onMessage?.(data);
        setIsTyping(false);
        setStatus('idle');
      },
      onTyping: (data) => {
        if (!isMountedRef.current) {
          debugLog('handler', 'onTyping ignored - component unmounted');
          return;
        }
        debugLog('handler', '⌨️ onTyping callback fired', data);
        setIsTyping(data.isTyping);
        setStatus(data.isTyping ? 'typing' : 'idle');
      },
      onStatus: (data) => {
        if (!isMountedRef.current) {
          debugLog('handler', 'onStatus ignored - component unmounted');
          return;
        }
        debugLog('handler', '📊 onStatus callback fired', data);
        setStatus(data.status);
        if (data.status === 'error') {
          // Only log if DEBUG is enabled to reduce console noise
          debugLog('handler', 'Socket status error:', data.message);
        }
      },
      onError: (error) => {
        if (!isMountedRef.current) {
          debugLog('handler', 'onError ignored - component unmounted');
          return;
        }
        debugLog('handler', '❌ onError callback fired', { message: error.message });
        // Only log if DEBUG is enabled to reduce console noise
        // Connection errors are expected if server is down
        if (DEBUG) {
          console.error('Socket error:', error);
        }
        setStatus('error');
      },
    };

    debugLog('connect', 'Calling socket.connect()...');
    socket.connect(agentId, roomId, handlers);
    debugLog('connect', 'socket.connect() called - waiting for events...');
  }, [agentId, roomId, enabled, wsUrl]);

  const sendMessage = useCallback((text: string, userId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.sendMessage(agentId, text, userId, roomId);
      setStatus('processing');
    }
  }, [agentId, roomId, isConnected]);

  const onMessage = useCallback((handler: (data: SocketMessageEvent) => void) => {
    messageHandlersRef.current.onMessage = handler;
  }, []);

  // Main effect for connection lifecycle
  useEffect(() => {
    debugLog('effect', 'useEffect running', { enabled, agentId, roomId });
    isMountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      debugLog('effect', 'useEffect cleanup running');
      isMountedRef.current = false;
      disconnect();
    };
  }, [enabled, agentId, roomId, connect, disconnect]);

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
