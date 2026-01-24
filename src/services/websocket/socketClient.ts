import { io, Socket } from 'socket.io-client';
import type { SocketMessageEvent, SocketTypingEvent, SocketStatusEvent } from '@/types';

export interface SocketEventHandlers {
  onMessage?: (data: SocketMessageEvent) => void;
  onTyping?: (data: SocketTypingEvent) => void;
  onStatus?: (data: SocketStatusEvent) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

const DEBUG = false; // Set to true for WebSocket connection debugging

function debugLog(context: string, message: string, data?: unknown): void {
  if (DEBUG) {
    const timestamp = new Date().toISOString().split('T')[1];
    if (data !== undefined) {
      console.log(`[Socket.IO ${timestamp}] ${context}: ${message}`, data);
    } else {
      console.log(`[Socket.IO ${timestamp}] ${context}: ${message}`);
    }
  }
}

class ElizaSocketClient {
  private socket: Socket | null = null;
  private url: string;
  private isConnected = false;

  constructor(url: string) {
    this.url = url;
    debugLog('Constructor', 'ElizaSocketClient initialized', { url });
  }

  connect(agentId: string, roomId: string, handlers: SocketEventHandlers = {}): void {
    debugLog('Connect', 'Attempting connection...', { 
      url: this.url, 
      path: '/socket.io',
      entityId: agentId,
      agentId, 
      roomId 
    });

    this.socket = io(this.url, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      query: {
        entityId: agentId,
        roomId: roomId,
      },
      auth: {
        entityId: agentId,
      },
    });

    this.socket.on('connect', () => {
      debugLog('Event', '✅ CONNECTED!', { socketId: this.socket?.id });
      this.isConnected = true;
      debugLog('Event', 'Emitting join event...', { agentId, roomId });
      this.socket?.emit('join', {
        agentId,
        roomId,
      });
      handlers.onConnected?.();
    });

    this.socket.on('connect_error', (error: Error) => {
      debugLog('Event', '❌ CONNECTION ERROR', { 
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      handlers.onError?.(error);
    });

    this.socket.on('disconnect', (reason: string) => {
      debugLog('Event', '⚠️ DISCONNECTED', { reason });
      this.isConnected = false;
      handlers.onDisconnected?.();
    });

    this.socket.on('message', (data: SocketMessageEvent) => {
      debugLog('Event', '📨 MESSAGE received', data);
      handlers.onMessage?.(data);
    });

    this.socket.on('typing', (data: SocketTypingEvent) => {
      debugLog('Event', '⌨️ TYPING', data);
      handlers.onTyping?.(data);
    });

    this.socket.on('status', (data: SocketStatusEvent) => {
      debugLog('Event', '📊 STATUS', data);
      handlers.onStatus?.(data);
    });

    this.socket.on('error', (error: unknown) => {
      debugLog('Event', '❌ SOCKET ERROR', error);
      const err = error instanceof Error ? error : new Error(String(error));
      handlers.onError?.(err);
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      debugLog('Event', '🔄 RECONNECT ATTEMPT', { attemptNumber });
    });

    this.socket.on('reconnect_failed', () => {
      debugLog('Event', '❌ RECONNECT FAILED - giving up');
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      debugLog('Event', '✅ RECONNECTED', { attemptNumber });
    });

    this.socket.io.on('error', (error: Error) => {
      debugLog('Manager', '❌ MANAGER ERROR', { 
        message: error.message,
        name: error.name
      });
    });

    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      debugLog('Manager', '🔄 Manager reconnect attempt', { attempt });
    });
  }

  sendMessage(agentId: string, text: string, userId: string, roomId: string): void {
    if (!this.socket || !this.isConnected) {
      debugLog('SendMessage', '❌ Cannot send - not connected');
      throw new Error('Socket not connected');
    }

    debugLog('SendMessage', '📤 Sending message...', { agentId, text: text.substring(0, 50), userId, roomId });
    this.socket.emit('message', {
      agentId,
      text,
      userId,
      roomId,
    });
  }

  disconnect(): void {
    debugLog('Disconnect', 'Disconnecting...');
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      debugLog('Disconnect', 'Disconnected successfully');
    }
  }

  getConnected(): boolean {
    return this.isConnected;
  }
}

export default ElizaSocketClient;
