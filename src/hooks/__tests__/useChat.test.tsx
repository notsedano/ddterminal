import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChat } from '../useChat';
import * as messageAPI from '@/services/api/messages';
import * as sessionAPI from '@/services/api/sessions';
import * as storage from '@/services/storage/conversationStorage';
import { useSocket } from '../useSocket';
import * as sseUtils from '@/utils/sse';
import * as supabase from '@/services/supabase';
import { useAuth } from '../useAuth';
import { useMemory, useMemoryExtraction } from '../useMemory';

// Mock dependencies
vi.mock('@/services/api/messages');
vi.mock('@/services/api/sessions');
vi.mock('@/services/storage/conversationStorage');
vi.mock('../useSocket');
vi.mock('@/utils/sse');
vi.mock('@/services/supabase');
vi.mock('../useAuth');
vi.mock('../useMemory');
vi.mock('@/utils/storage', () => ({
  getUserId: vi.fn(() => 'test-user-id'),
}));

const mockedMessageAPI = vi.mocked(messageAPI);
const mockedSessionAPI = vi.mocked(sessionAPI);
const mockedStorage = vi.mocked(storage);
const mockedUseSocket = vi.mocked(useSocket);
const mockedSSE = vi.mocked(sseUtils);
const mockedSupabase = vi.mocked(supabase);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseMemory = vi.mocked(useMemory);
const mockedUseMemoryExtraction = vi.mocked(useMemoryExtraction);

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
    
    // Mock auth
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      supabaseUserId: null,
      isLoading: false,
    } as any);
    
    // Mock memory
    mockedUseMemory.mockReturnValue({
      context: [],
      contextPrompt: '',
      isLoading: false,
      trackInteraction: vi.fn(),
      saveSummary: vi.fn(),
      updateSummary: vi.fn(),
    } as any);
    
    mockedUseMemoryExtraction.mockReturnValue({
      extractEntities: vi.fn(),
      saveFact: vi.fn(),
      saveIntent: vi.fn(),
      summarizeConversation: vi.fn(),
    } as any);
    
    // Mock Supabase
    mockedSupabase.isSupabaseConfigured.mockReturnValue(false);
    mockedSupabase.sessionHasKnowledge.mockResolvedValue(false);
    
    // Mock SSE cleanup function
    mockedSSE.createSSEStream.mockReturnValue(() => {});
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

  describe('SSE integration', () => {
    it('should set up SSE stream on mount', () => {
      renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      expect(mockedSSE.createSSEStream).toHaveBeenCalledWith(
        'agent-123',
        'room-123',
        expect.objectContaining({
          onChunk: expect.any(Function),
          onMessage: expect.any(Function),
          onError: expect.any(Function),
          onDone: expect.any(Function),
          onOpen: expect.any(Function),
          onClose: expect.any(Function),
        })
      );
    });

    it('should not set up SSE when sessionId is null', () => {
      renderHook(
        () => useChat({ sessionId: null, agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      expect(mockedSSE.createSSEStream).not.toHaveBeenCalled();
    });

    it('should handle SSE chunk events', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      handlers.onChunk({ chunk: 'Hello' });
      handlers.onChunk({ chunk: ' ' });
      handlers.onChunk({ chunk: 'World' });

      await waitFor(() => {
        const streamingMessages = result.current.messages.filter(
          m => m.id.startsWith('agent-streaming-')
        );
        expect(streamingMessages.length).toBeGreaterThan(0);
        expect(streamingMessages[0].text).toBe('Hello World');
      });
    });

    it('should handle SSE complete message events', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      handlers.onMessage({
        messageId: 'msg-123',
        text: 'Complete agent response',
        userId: 'agent-123',
        agentId: 'agent-123',
        sessionId: 'session-123',
      });

      await waitFor(() => {
        expect(result.current.messages.some(m => m.id === 'msg-123')).toBe(true);
      });
    });

    it('should update connection status on SSE open', () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      handlers.onOpen();

      expect(result.current.isConnected).toBe(true);
    });

    it('should handle SSE errors gracefully', () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      handlers.onError({ message: 'Connection failed', code: 'ENDPOINT_NOT_FOUND' });

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('message filtering', () => {
    it('should filter unrelated agent messages for prediction requests', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      // Send prediction request
      result.current.sendMessage('🎯 PREDICTION REQUEST\n\nLakers @ Celtics');

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(0);
      });

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      // Send unrelated agent message
      handlers.onMessage({
        messageId: 'msg-unrelated',
        text: 'The Warriors and Heat game was exciting',
        userId: 'agent-123',
        agentId: 'agent-123',
        sessionId: 'session-123',
      });

      await waitFor(() => {
        // Should not have the unrelated message
        expect(result.current.messages.some(m => m.id === 'msg-unrelated')).toBe(false);
      });
    });

    it('should accept related agent messages for prediction requests', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      result.current.sendMessage('🎯 PREDICTION REQUEST\n\nLakers @ Celtics');

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(0);
      });

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      // Send related agent message
      handlers.onMessage({
        messageId: 'msg-related',
        text: 'Based on the Lakers and Celtics matchup, I predict Lakers will win',
        userId: 'agent-123',
        agentId: 'agent-123',
        sessionId: 'session-123',
      });

      await waitFor(() => {
        expect(result.current.messages.some(m => m.id === 'msg-related')).toBe(true);
      });
    });

    it('should filter duplicate messages by ID', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      const message = {
        messageId: 'msg-123',
        text: 'Test message',
        userId: 'agent-123',
        agentId: 'agent-123',
        sessionId: 'session-123',
      };

      handlers.onMessage(message);
      handlers.onMessage(message); // Duplicate

      await waitFor(() => {
        const messagesWithId = result.current.messages.filter(m => m.id === 'msg-123');
        expect(messagesWithId.length).toBe(1);
      });
    });

    it('should filter messages received too quickly after previous response', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      result.current.sendMessage('🎯 PREDICTION REQUEST\n\nLakers @ Celtics');

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(0);
      });

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      // First response
      handlers.onMessage({
        messageId: 'msg-1',
        text: 'Lakers analysis',
        userId: 'agent-123',
        agentId: 'agent-123',
        sessionId: 'session-123',
      });

      await waitFor(() => {
        expect(result.current.messages.some(m => m.id === 'msg-1')).toBe(true);
      });

      // Second unrelated message within 5 seconds (simulated)
      vi.useFakeTimers();
      handlers.onMessage({
        messageId: 'msg-2',
        text: 'Warriors analysis',
        userId: 'agent-123',
        agentId: 'agent-123',
        sessionId: 'session-123',
      });
      vi.advanceTimersByTime(3000); // 3 seconds
      vi.useRealTimers();

      await waitFor(() => {
        // Should be filtered
        expect(result.current.messages.some(m => m.id === 'msg-2')).toBe(false);
      });
    });
  });

  describe('concurrent behavior', () => {
    it('should handle multiple rapid messages correctly', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      // Send multiple messages rapidly
      for (let i = 0; i < 5; i++) {
        handlers.onMessage({
          messageId: `msg-${i}`,
          text: `Message ${i}`,
          userId: 'agent-123',
          agentId: 'agent-123',
          sessionId: 'session-123',
        });
      }

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(5);
      });
    });

    it('should handle streaming and complete messages concurrently', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      // Start streaming
      handlers.onChunk({ chunk: 'Streaming' });
      handlers.onChunk({ chunk: ' message' });

      // Complete message arrives
      handlers.onMessage({
        messageId: 'msg-complete',
        text: 'Complete message',
        userId: 'agent-123',
        agentId: 'agent-123',
        sessionId: 'session-123',
      });

      await waitFor(() => {
        // Should have complete message, not streaming
        const completeMsg = result.current.messages.find(m => m.id === 'msg-complete');
        expect(completeMsg).toBeDefined();
        expect(completeMsg?.text).toBe('Complete message');
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle SSE stream cleanup on unmount', () => {
      const cleanup = vi.fn();
      mockedSSE.createSSEStream.mockReturnValue(cleanup);

      const { unmount } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      unmount();

      expect(cleanup).toHaveBeenCalled();
    });

    it('should handle invalid message data from SSE', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      // Invalid message (missing required fields)
      handlers.onMessage({
        messageId: '',
        text: '',
        userId: '',
        agentId: '',
      } as any);

      // Should not crash
      await waitFor(() => {
        expect(result.current.messages).toBeDefined();
      });
    });

    it('should handle session change during active SSE connection', () => {
      const cleanup = vi.fn();
      mockedSSE.createSSEStream.mockReturnValue(cleanup);

      const { rerender } = renderHook(
        ({ sessionId }) =>
          useChat({ sessionId, agentId: 'agent-123', roomId: 'room-123' }),
        {
          wrapper: createWrapper(),
          initialProps: { sessionId: 'session-1' },
        }
      );

      expect(mockedSSE.createSSEStream).toHaveBeenCalledWith(
        'agent-123',
        'room-123',
        expect.any(Object)
      );

      rerender({ sessionId: 'session-2' });

      // Should cleanup old connection and create new one
      expect(cleanup).toHaveBeenCalled();
      expect(mockedSSE.createSSEStream).toHaveBeenCalledTimes(2);
    });

    it('should handle SSE endpoint not found error', () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'session-123', agentId: 'agent-123', roomId: 'room-123' }),
        { wrapper: createWrapper() }
      );

      const sseCall = mockedSSE.createSSEStream.mock.calls[0];
      const handlers = sseCall[2];

      handlers.onError({ message: 'SSE endpoint not found', code: 'ENDPOINT_NOT_FOUND' });

      // Should not show error to user, just fall back to REST
      expect(result.current.error).toBeNull();
      expect(result.current.isConnected).toBe(false);
    });
  });
});
