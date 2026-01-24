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

class ElizaSocketClient {
  private socket: Socket | null = null;
  private url: string;
  private isConnected = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(agentId: string, roomId: string, handlers: SocketEventHandlers = {}): void {

    this.socket = io(this.url, {
      path: '/ws',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.socket?.emit('join', {
        agentId,
        roomId,
      });
      handlers.onConnected?.();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      handlers.onDisconnected?.();
    });

    this.socket.on('message', (data: SocketMessageEvent) => {
      handlers.onMessage?.(data);
    });

    this.socket.on('typing', (data: SocketTypingEvent) => {
      handlers.onTyping?.(data);
    });

    this.socket.on('status', (data: SocketStatusEvent) => {
      handlers.onStatus?.(data);
    });

    this.socket.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      handlers.onError?.(err);
    });
  }

  sendMessage(agentId: string, text: string, userId: string, roomId: string): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('message', {
      agentId,
      text,
      userId,
      roomId,
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getConnected(): boolean {
    return this.isConnected;
  }
}

export default ElizaSocketClient;
