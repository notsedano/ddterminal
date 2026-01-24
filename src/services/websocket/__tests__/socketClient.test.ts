import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import ElizaSocketClient from '../socketClient';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

const mockedIo = vi.mocked(io);

describe('ElizaSocketClient', () => {
  let mockSocket: Partial<Socket>;
  let socketClient: ElizaSocketClient;

  beforeEach(() => {
    mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };

    mockedIo.mockReturnValue(mockSocket as Socket);
    socketClient = new ElizaSocketClient('https://test-api.example.com');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with URL', () => {
      const client = new ElizaSocketClient('https://api.example.com');
      expect(client).toBeInstanceOf(ElizaSocketClient);
    });
  });

  describe('connect', () => {
    it('should connect to socket with correct configuration', () => {
      const handlers = {
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onMessage: vi.fn(),
        onTyping: vi.fn(),
        onStatus: vi.fn(),
        onError: vi.fn(),
      };

      socketClient.connect('agent-123', 'room-456', handlers);

      expect(mockedIo).toHaveBeenCalledWith('https://test-api.example.com', {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
    });

    it('should register event handlers', () => {
      const handlers = {
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onMessage: vi.fn(),
        onTyping: vi.fn(),
        onStatus: vi.fn(),
        onError: vi.fn(),
      };

      socketClient.connect('agent-123', 'room-456', handlers);

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('typing', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should emit join event on connect', () => {
      const handlers = {
        onConnected: vi.fn(),
      };

      socketClient.connect('agent-123', 'room-456', handlers);

      // Simulate connect event
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      expect(mockSocket.emit).toHaveBeenCalledWith('join', {
        agentId: 'agent-123',
        roomId: 'room-456',
      });
    });

    it('should call onConnected handler when connected', () => {
      const handlers = {
        onConnected: vi.fn(),
      };

      socketClient.connect('agent-123', 'room-456', handlers);

      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      expect(handlers.onConnected).toHaveBeenCalled();
    });

    it('should call onDisconnected handler when disconnected', () => {
      const handlers = {
        onDisconnected: vi.fn(),
      };

      socketClient.connect('agent-123', 'room-456', handlers);

      const disconnectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];

      if (disconnectHandler) {
        disconnectHandler();
      }

      expect(handlers.onDisconnected).toHaveBeenCalled();
    });

    it('should call onMessage handler when message received', () => {
      const handlers = {
        onMessage: vi.fn(),
      };

      const messageData = {
        text: 'Hello',
        userId: 'user-123',
        agentId: 'agent-123',
      };

      socketClient.connect('agent-123', 'room-456', handlers);

      const messageHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        messageHandler(messageData);
      }

      expect(handlers.onMessage).toHaveBeenCalledWith(messageData);
    });

    it('should call onTyping handler when typing event received', () => {
      const handlers = {
        onTyping: vi.fn(),
      };

      const typingData = {
        isTyping: true,
        agentId: 'agent-123',
      };

      socketClient.connect('agent-123', 'room-456', handlers);

      const typingHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'typing'
      )?.[1];

      if (typingHandler) {
        typingHandler(typingData);
      }

      expect(handlers.onTyping).toHaveBeenCalledWith(typingData);
    });

    it('should call onStatus handler when status event received', () => {
      const handlers = {
        onStatus: vi.fn(),
      };

      const statusData = {
        status: 'processing',
        message: 'Processing request',
      };

      socketClient.connect('agent-123', 'room-456', handlers);

      const statusHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'status'
      )?.[1];

      if (statusHandler) {
        statusHandler(statusData);
      }

      expect(handlers.onStatus).toHaveBeenCalledWith(statusData);
    });

    it('should call onError handler when error occurs', () => {
      const handlers = {
        onError: vi.fn(),
      };

      const error = new Error('Socket error');

      socketClient.connect('agent-123', 'room-456', handlers);

      const errorHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        errorHandler(error);
      }

      expect(handlers.onError).toHaveBeenCalledWith(error);
    });

    it('should convert non-Error objects to Error in error handler', () => {
      const handlers = {
        onError: vi.fn(),
      };

      const errorData = 'String error';

      socketClient.connect('agent-123', 'room-456', handlers);

      const errorHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        errorHandler(errorData);
      }

      expect(handlers.onError).toHaveBeenCalled();
      const callArg = handlers.onError.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Error);
      expect(callArg.message).toBe('String error');
    });

    it('should handle missing handlers gracefully', () => {
      socketClient.connect('agent-123', 'room-456', {});

      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      // Should not throw when handlers are missing
      expect(() => {
        if (connectHandler) {
          connectHandler();
        }
      }).not.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('should send message when connected', () => {
      const handlers = {};
      socketClient.connect('agent-123', 'room-456', handlers);

      // Simulate connection
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      socketClient.sendMessage('agent-123', 'Hello', 'user-456', 'room-456');

      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        agentId: 'agent-123',
        text: 'Hello',
        userId: 'user-456',
        roomId: 'room-456',
      });
    });

    it('should throw error when not connected', () => {
      socketClient.connect('agent-123', 'room-456', {});
      mockSocket.connected = false;

      expect(() => {
        socketClient.sendMessage('agent-123', 'Hello', 'user-456', 'room-456');
      }).toThrow('Socket not connected');
    });

    it('should throw error when socket is null', () => {
      expect(() => {
        socketClient.sendMessage('agent-123', 'Hello', 'user-456', 'room-456');
      }).toThrow('Socket not connected');
    });

    it('should handle special characters in message', () => {
      const handlers = {};
      socketClient.connect('agent-123', 'room-456', handlers);

      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      socketClient.sendMessage('agent-123', 'Hello! @user 💰', 'user-456', 'room-456');

      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        agentId: 'agent-123',
        text: 'Hello! @user 💰',
        userId: 'user-456',
        roomId: 'room-456',
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket', () => {
      socketClient.connect('agent-123', 'room-456', {});
      socketClient.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect when socket is null', () => {
      expect(() => {
        socketClient.disconnect();
      }).not.toThrow();
    });

    it('should reset connection state', () => {
      socketClient.connect('agent-123', 'room-456', {});
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      expect(socketClient.getConnected()).toBe(true);

      socketClient.disconnect();

      expect(socketClient.getConnected()).toBe(false);
    });
  });

  describe('getConnected', () => {
    it('should return false initially', () => {
      expect(socketClient.getConnected()).toBe(false);
    });

    it('should return true after connection', () => {
      socketClient.connect('agent-123', 'room-456', {});
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      expect(socketClient.getConnected()).toBe(true);
    });

    it('should return false after disconnection', () => {
      socketClient.connect('agent-123', 'room-456', {});
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      const disconnectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];

      if (disconnectHandler) {
        disconnectHandler();
      }

      expect(socketClient.getConnected()).toBe(false);
    });
  });
});
