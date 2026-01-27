import { useEffect, useRef, useState, useCallback } from 'react';
import ElizaSocketClient, { type SocketEventHandlers } from '@/services/websocket/socketClient';
import type { SocketMessageEvent } from '@/types';

// Set to true for detailed WebSocket connection debugging
const DEBUG = false;

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
  const connectingRef = useRef(false); // Prevent double connections from StrictMode
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
    connectingRef.current = false; // Reset connecting state
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
    // Prevent duplicate connections (React StrictMode causes double renders)
    if (connectingRef.current) {
      debugLog('connect', 'Connection already in progress, skipping');
      return;
    }

    debugLog('connect', 'Checking connection conditions...', { 
      enabled, 
      wsUrl, 
      hasExistingSocket: !!socketRef.current,
      isMounted: isMountedRef.current 
    });

    if (!enabled || !wsUrl) {
      const reason = !enabled ? 'disabled' : 'no URL';
      debugLog('connect', 'Skipping connection', { reason });
      return;
    }

    if (socketRef.current) {
      debugLog('connect', 'Socket already exists, skipping');
      return;
    }

    // Mark as connecting to prevent duplicates
    connectingRef.current = true;

    console.log('[useSocket] Creating new connection:', { wsUrl, agentId, roomId });
    debugLog('connect', 'Creating new ElizaSocketClient...', { wsUrl, agentId, roomId });
    const socket = new ElizaSocketClient(wsUrl);
    socketRef.current = socket;

    const handlers: SocketEventHandlers = {
      onConnected: () => {
        connectingRef.current = false; // Connection complete
        if (!isMountedRef.current) {
          debugLog('handler', 'onConnected ignored - component unmounted');
          return;
        }
        console.log('[useSocket] ✅ Connected successfully!');
        debugLog('handler', '✅ onConnected callback fired');
        setIsConnected(true);
        setStatus('idle');
      },
      onDisconnected: () => {
        connectingRef.current = false; // Allow reconnection
        if (!isMountedRef.current) {
          debugLog('handler', 'onDisconnected ignored - component unmounted');
          return;
        }
        console.log('[useSocket] Disconnected');
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
        connectingRef.current = false; // Allow retry
        if (!isMountedRef.current) {
          debugLog('handler', 'onError ignored - component unmounted');
          return;
        }
        debugLog('handler', '❌ onError callback fired', { message: error.message });
        // Only log connection errors if they're not the expected WebSocket upgrade failures
        if (!error.message?.includes('websocket')) {
          console.warn('[useSocket] Connection error:', error.message);
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
