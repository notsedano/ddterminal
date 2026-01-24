import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChat } from '../useChat';
import * as messageAPI from '@/services/api/messages';
import * as sessionAPI from '@/services/api/sessions';
import * as storage from '@/services/storage/conversationStorage';
import { useSocket } from '../useSocket';

// Mock dependencies
vi.mock('@/services/api/messages');
vi.mock('@/services/api/sessions');
vi.mock('@/services/storage/conversationStorage');
vi.mock('../useSocket');
vi.mock('@/utils/storage', () => ({
  getUserId: vi.fn(() => 'test-user-id'),
}));

const mockedMessageAPI = vi.mocked(messageAPI);
const mockedSessionAPI = vi.mocked(sessionAPI);
const mockedStorage = vi.mocked(storage);
const mockedUseSocket = vi.mocked(useSocket);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useChat', () => {
  const mockSocket = {
    isConnected: true,
    isTyping: false,
    status: 'idle' as const,
    sendMessage: vi.fn(),
    onMessage: vi.fn((handler) => {
      // Store handler for later use
      (mockSocket as any).messageHandler = handler;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseSocket.mockReturnValue(mockSocket as any);
    mockedStorage.getMessages.mockResolvedValue([]);
    mockedSessionAPI.getMessages.mockResolvedValue({ messages: [], hasMore: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with empty messages', () => {
    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should load messages from storage on mount', async () => {
    const storedMessages = [
      {
        id: 'msg-1',
        text: 'Stored message',
        userId: 'user-123',
        sessionId: 'session-123',
        createdAt: new Date().toISOString(),
        role: 'user' as const,
      },
    ];

    mockedStorage.getMessages.mockResolvedValue(storedMessages);

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });
  });

  it('should fetch messages from API after loading from storage', async () => {
    const storedMessages = [
      {
        id: 'msg-1',
        text: 'Stored message',
        userId: 'user-123',
        sessionId: 'session-123',
        createdAt: new Date().toISOString(),
        role: 'user' as const,
      },
    ];

    const apiMessages = [
      {
        id: 'msg-2',
        content: 'API message',
        authorId: 'user-123',
        isAgent: false,
        createdAt: new Date().toISOString(),
      },
    ];

    mockedStorage.getMessages.mockResolvedValue(storedMessages);
    mockedSessionAPI.getMessages.mockResolvedValue({ messages: apiMessages, hasMore: false });

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockedSessionAPI.getMessages).toHaveBeenCalledWith('session-123');
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });
  });

  it('should send message via API', async () => {
    const mockResponse = {
      messageId: 'msg-123',
      sessionId: 'session-123',
    };

    mockedMessageAPI.sendMessage.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    result.current.sendMessage('Hello, world!');

    await waitFor(() => {
      expect(mockedMessageAPI.sendMessage).toHaveBeenCalledWith('session-123', {
        text: 'Hello, world!',
        userId: 'test-user-id',
      });
    });
  });

  it('should add user message to state after sending', async () => {
    const mockResponse = {
      messageId: 'msg-123',
      sessionId: 'session-123',
    };

    mockedMessageAPI.sendMessage.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    result.current.sendMessage('Hello!');

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
      const lastMessage = result.current.messages[result.current.messages.length - 1];
      expect(lastMessage.text).toBe('Hello!');
      expect(lastMessage.role).toBe('user');
    });
  });

  it('should save message to storage after sending', async () => {
    const mockResponse = {
      messageId: 'msg-123',
      sessionId: 'session-123',
    };

    mockedMessageAPI.sendMessage.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    result.current.sendMessage('Hello!');

    await waitFor(() => {
      expect(mockedStorage.saveMessage).toHaveBeenCalled();
    });
  });

  it('should handle send message errors', async () => {
    const error = new Error('Failed to send message');
    mockedMessageAPI.sendMessage.mockRejectedValue(error);

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    result.current.sendMessage('Hello!');

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('should handle session not found errors', async () => {
    const error = new Error('Session not found');
    mockedMessageAPI.sendMessage.mockRejectedValue(error);

    const onSessionInvalid = vi.fn();

    const { result } = renderHook(
      () =>
        useChat({
          sessionId: 'session-123',
          agentId: 'agent-123',
          roomId: 'room-123',
          onSessionInvalid,
        }),
      { wrapper: createWrapper() }
    );

    result.current.sendMessage('Hello!');

    await waitFor(() => {
      expect(onSessionInvalid).toHaveBeenCalledWith('session-123');
      expect(result.current.error).toContain('expired or been deleted');
    });
  });

  it('should not send empty messages', () => {
    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    result.current.sendMessage('');
    result.current.sendMessage('   ');

    expect(mockedMessageAPI.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send message when sessionId is null', () => {
    const { result } = renderHook(
      () => useChat({ sessionId: null, agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    result.current.sendMessage('Hello!');

    expect(mockedMessageAPI.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle WebSocket message events', async () => {
    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    // Simulate WebSocket message
    const messageHandler = (mockSocket.onMessage as any).mock.calls[0]?.[0];
    if (messageHandler) {
      messageHandler({ text: 'Hello' });
      messageHandler({ text: ' World' });
    }

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });
  });

  it('should merge streaming messages into single agent message', async () => {
    mockSocket.isTyping = false;

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    // Simulate streaming
    const messageHandler = (mockSocket.onMessage as any).mock.calls[0]?.[0];
    if (messageHandler) {
      messageHandler({ text: 'Hello' });
      messageHandler({ text: ' ' });
      messageHandler({ text: 'World' });
    }

    // Wait for typing to stop
    await waitFor(() => {
      const agentMessages = result.current.messages.filter((m) => m.role === 'agent');
      expect(agentMessages.length).toBeGreaterThan(0);
      const lastMessage = agentMessages[agentMessages.length - 1];
      expect(lastMessage.text).toBe('Hello World');
    });
  });

  it('should update messages when sessionId changes', async () => {
    const { rerender } = renderHook(
      ({ sessionId }) =>
        useChat({ sessionId, agentId: 'agent-123', roomId: 'room-123' }),
      {
        wrapper: createWrapper(),
        initialProps: { sessionId: 'session-1' },
      }
    );

    await waitFor(() => {
      expect(mockedStorage.getMessages).toHaveBeenCalledWith('session-1');
    });

    rerender({ sessionId: 'session-2' });

    await waitFor(() => {
      expect(mockedStorage.getMessages).toHaveBeenCalledWith('session-2');
    });
  });

  it('should clear error when sessionId changes', async () => {
    const error = new Error('Test error');
    mockedMessageAPI.sendMessage.mockRejectedValue(error);

    const { result, rerender } = renderHook(
      ({ sessionId }) =>
        useChat({ sessionId, agentId: 'agent-123', roomId: 'room-123' }),
      {
        wrapper: createWrapper(),
        initialProps: { sessionId: 'session-1' },
      }
    );

    result.current.sendMessage('Hello!');

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    rerender({ sessionId: 'session-2' });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });

  it('should add user message and save to storage after send success', async () => {
    const mockResponse = { messageId: 'msg-123', sessionId: 'session-123' };
    mockedMessageAPI.sendMessage.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    result.current.sendMessage('Hello!');

    await waitFor(() => {
      expect(mockedMessageAPI.sendMessage).toHaveBeenCalledWith('session-123', {
        text: 'Hello!',
        userId: 'test-user-id',
      });
      expect(mockedStorage.saveMessage).toHaveBeenCalled();
    });
  });

  it('should handle API fetch errors gracefully', async () => {
    mockedStorage.getMessages.mockResolvedValue([]);
    mockedSessionAPI.getMessages.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(
      () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      // Should not crash, just log error
      expect(result.current.messages).toEqual([]);
    });
  });
});
