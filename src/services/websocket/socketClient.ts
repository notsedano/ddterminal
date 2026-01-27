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

// Set to true for detailed Socket.IO debugging (very verbose)
const DEBUG = false;

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
  private hasLoggedUpgradeError = false; // Only log WebSocket upgrade error once

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

    // Use polling first, then upgrade to websocket if available
    // This works around reverse proxy issues where WebSocket upgrade fails
    // but polling works fine (common with elizaCloud/similar platforms)
    const socketOptions = {
      path: '/socket.io',
      // Start with polling, then try to upgrade to websocket
      // This is more reliable than websocket-first when proxies are involved
      transports: ['polling', 'websocket'],
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
      // Try to upgrade from polling to websocket (may fail, that's OK)
      upgrade: true,
      rememberUpgrade: false,
      forceNew: false,
      autoConnect: true,
    };

    debugLog('Connect', 'Socket.IO options:', socketOptions);

    this.socket = io(this.url, socketOptions);

    // Track transport for logging
    this.socket.io.on('open', () => {
      debugLog('Manager', 'Socket.IO manager opened');
      
      const engine = this.socket?.io?.engine;
      if (engine) {
        // Listen for successful upgrade to websocket
        engine.on('upgrade', () => {
          console.log('[Socket.IO] ✅ Upgraded to WebSocket transport');
        });

        // Listen for upgrade errors (expected when proxy doesn't support WebSocket)
        engine.on('upgradeError', () => {
          // Only log once to reduce noise
          if (!this.hasLoggedUpgradeError) {
            this.hasLoggedUpgradeError = true;
            console.log('[Socket.IO] ℹ️ WebSocket upgrade unavailable, using polling (this is normal for some hosting providers)');
          }
        });
      }
    });

    this.socket.on('connect', () => {
      const transport = this.socket?.io?.engine?.transport?.name || 'unknown';
      console.log(`[Socket.IO] ✅ Connected via ${transport}`, {
        socketId: this.socket?.id,
        transport
      });
      debugLog('Event', '✅ CONNECTED!', { socketId: this.socket?.id });
      this.isConnected = true;
      
      // Emit join event
      debugLog('Event', 'Emitting join event...', { agentId, roomId });
      this.socket?.emit('join', {
        agentId,
        roomId,
      });
      handlers.onConnected?.();
    });

    this.socket.on('connect_error', (error: Error) => {
      // Don't spam console with expected errors
      debugLog('Event', '❌ CONNECTION ERROR', { 
        message: error.message,
        name: error.name,
      });
      handlers.onError?.(error);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[Socket.IO] Disconnected:', reason);
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
      console.warn('[Socket.IO] Reconnection failed after all attempts');
      debugLog('Event', '❌ RECONNECT FAILED - giving up');
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('[Socket.IO] ✅ Reconnected after', attemptNumber, 'attempts');
      debugLog('Event', '✅ RECONNECTED', { attemptNumber });
    });

    // Listen for manager-level errors (usually network issues)
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
      this.hasLoggedUpgradeError = false; // Reset for next connection
      debugLog('Disconnect', 'Disconnected successfully');
    }
  }

  getConnected(): boolean {
    return this.isConnected;
  }
}

export default ElizaSocketClient;
