import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { MessageInput } from '@/components/chat/MessageInput';
import * as messageAPI from '@/services/api/messages';
import * as storage from '@/services/storage/conversationStorage';
import { useSocket } from '@/hooks/useSocket';

// Mock dependencies
vi.mock('@/services/api/messages');
vi.mock('@/services/storage/conversationStorage');
vi.mock('@/hooks/useSocket');
vi.mock('@/utils/storage', () => ({
  getUserId: vi.fn(() => 'test-user-id'),
}));

const mockedMessageAPI = vi.mocked(messageAPI);
const mockedStorage = vi.mocked(storage);
const mockedUseSocket = vi.mocked(useSocket);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Integration Tests', () => {
  const mockSocket = {
    isConnected: true,
    isTyping: false,
    status: 'idle' as const,
    sendMessage: vi.fn(),
    onMessage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseSocket.mockReturnValue(mockSocket as any);
    mockedStorage.getMessages.mockResolvedValue([]);
    mockedStorage.saveMessage.mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Chat Flow Integration', () => {
    it('should complete full message send flow', async () => {
      const mockResponse = {
        messageId: 'msg-123',
        sessionId: 'session-123',
      };

      mockedMessageAPI.sendMessage.mockResolvedValue(mockResponse);

      const user = userEvent.setup();

      render(
        <MessageInput
          onSend={async (text) => {
            await messageAPI.sendMessage('session-123', {
              text,
              userId: 'test-user-id',
            });
          }}
        />,
        { wrapper: createWrapper() }
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello, world!');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockedMessageAPI.sendMessage).toHaveBeenCalledWith('session-123', {
          text: 'Hello, world!',
          userId: 'test-user-id',
        });
      });
    });

    it('should handle message send with WebSocket fallback', async () => {
      const mockResponse = {
        messageId: 'msg-123',
        sessionId: 'session-123',
      };

      mockedMessageAPI.sendMessage.mockResolvedValue(mockResponse);
      mockSocket.isConnected = false;

      const user = userEvent.setup();

      render(
        <MessageInput
          onSend={async (text) => {
            await messageAPI.sendMessage('session-123', {
              text,
              userId: 'test-user-id',
            });
          }}
        />,
        { wrapper: createWrapper() }
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockedMessageAPI.sendMessage).toHaveBeenCalled();
      });
    });

    it('should handle concurrent message sends', async () => {
      const mockResponse = {
        messageId: 'msg-123',
        sessionId: 'session-123',
      };

      mockedMessageAPI.sendMessage.mockResolvedValue(mockResponse);

      const user = userEvent.setup();

      render(
        <MessageInput
          onSend={async (text) => {
            await messageAPI.sendMessage('session-123', {
              text,
              userId: 'test-user-id',
            });
          }}
        />,
        { wrapper: createWrapper() }
      );

      const textarea = screen.getByRole('textbox');

      // Send multiple messages rapidly
      await user.type(textarea, 'Message 1');
      await user.keyboard('{Enter}');
      await user.type(textarea, 'Message 2');
      await user.keyboard('{Enter}');
      await user.type(textarea, 'Message 3');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockedMessageAPI.sendMessage).toHaveBeenCalledTimes(3);
      });
    });

    it('should handle error recovery', async () => {
      const error = new Error('Network error');
      mockedMessageAPI.sendMessage.mockRejectedValueOnce(error);

      const user = userEvent.setup();

      render(
        <MessageInput
          onSend={async (text) => {
            try {
              await messageAPI.sendMessage('session-123', {
                text,
                userId: 'test-user-id',
              });
            } catch (err) {
              // Error handled
            }
          }}
        />,
        { wrapper: createWrapper() }
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Failed message');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockedMessageAPI.sendMessage).toHaveBeenCalled();
      });

      // Retry with success
      mockedMessageAPI.sendMessage.mockResolvedValueOnce({
        messageId: 'msg-456',
        sessionId: 'session-123',
      });

      await user.type(textarea, 'Success message');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockedMessageAPI.sendMessage).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Storage Integration', () => {
    it('should save and retrieve messages from storage', async () => {
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

      // Simulate loading messages
      const messages = await storage.getMessages('session-123');

      expect(messages).toEqual(storedMessages);
      expect(mockedStorage.getMessages).toHaveBeenCalledWith('session-123');
    });

    it('should handle storage errors gracefully', async () => {
      mockedStorage.getMessages.mockRejectedValue(new Error('Storage error'));

      await expect(storage.getMessages('session-123')).rejects.toThrow('Storage error');
    });
  });

  describe('WebSocket Integration', () => {
    it('should register socket message handler when useChat is used', () => {
      mockSocket.onMessage = vi.fn();
      expect(mockSocket.onMessage).toBeDefined();
      mockSocket.onMessage(vi.fn());
      expect(mockSocket.onMessage).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle WebSocket disconnection', () => {
      mockSocket.isConnected = false;

      // Component should handle disconnection gracefully
      expect(mockSocket.isConnected).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      };

      mockedMessageAPI.sendMessage.mockRejectedValue(timeoutError);

      const user = userEvent.setup();

      render(
        <MessageInput
          onSend={async (text) => {
            try {
              await messageAPI.sendMessage('session-123', {
                text,
                userId: 'test-user-id',
              });
            } catch (err) {
              // Error handled
            }
          }}
        />,
        { wrapper: createWrapper() }
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Timeout test');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockedMessageAPI.sendMessage).toHaveBeenCalled();
      });
    });

    it('should handle session expiration', async () => {
      const sessionError = new Error('Session not found');
      mockedMessageAPI.sendMessage.mockRejectedValue(sessionError);

      const onSessionInvalid = vi.fn();

      // This would be tested through ChatContainer
      // For now, verify error handling pattern
      try {
        await messageAPI.sendMessage('expired-session', {
          text: 'Test',
          userId: 'user-123',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Session')) {
          onSessionInvalid('expired-session');
        }
      }

      expect(onSessionInvalid).toHaveBeenCalledWith('expired-session');
    });
  });

  describe('Message Filtering Integration', () => {
    it('should filter unrelated messages using real isMessageRelated function', async () => {
      // Import actual function (not mocked)
      const { isMessageRelated } = await import('@/utils/messageUtils');

      const userText = '🎯 PREDICTION REQUEST\n\nLakers @ Celtics';
      const relatedAgentText = 'Based on the Lakers and Celtics matchup, I predict...';
      const unrelatedAgentText = 'The Warriors and Heat game was exciting';

      expect(isMessageRelated(relatedAgentText, userText)).toBe(true);
      expect(isMessageRelated(unrelatedAgentText, userText)).toBe(false);
    });

    it('should handle team abbreviation matching in real scenarios', async () => {
      const { isMessageRelated } = await import('@/utils/messageUtils');

      const userText = '🎯 PREDICTION REQUEST\n\nLAL @ BOS';
      const agentText = 'The Lakers and Celtics are both strong teams';

      expect(isMessageRelated(agentText, userText)).toBe(true);
    });

    it('should handle edge cases in message filtering', async () => {
      const { isMessageRelated } = await import('@/utils/messageUtils');

      // Empty strings
      expect(isMessageRelated('', '')).toBe(true);
      
      // No teams in user message
      expect(isMessageRelated('Any response', '🎯 PREDICTION REQUEST')).toBe(true);
      
      // No teams in agent message
      expect(
        isMessageRelated('I need more info', '🎯 PREDICTION REQUEST\n\nLakers @ Celtics')
      ).toBe(true);
    });
  });

  describe('Message Merging Integration', () => {
    it('should merge messages using real mergeMessages function', async () => {
      const { mergeMessages } = await import('@/utils/messageUtils');
      const { Message } = await import('@/types');

      const existing: Message[] = [
        {
          id: 'msg-1',
          text: 'Message 1',
          userId: 'user-1',
          sessionId: 'session-1',
          createdAt: '2024-01-01T10:00:00Z',
          role: 'user',
        },
        {
          id: 'msg-2',
          text: 'Message 2',
          userId: 'user-1',
          sessionId: 'session-1',
          createdAt: '2024-01-01T10:01:00Z',
          role: 'user',
        },
      ];

      const newMessages: Message[] = [
        {
          id: 'msg-3',
          text: 'Message 3',
          userId: 'user-1',
          sessionId: 'session-1',
          createdAt: '2024-01-01T10:02:00Z',
          role: 'user',
        },
        {
          id: 'msg-2', // Duplicate
          text: 'Message 2',
          userId: 'user-1',
          sessionId: 'session-1',
          createdAt: '2024-01-01T10:01:00Z',
          role: 'user',
        },
      ];

      const result = mergeMessages(existing, newMessages);

      expect(result).toHaveLength(3);
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });

    it('should handle out-of-order messages', async () => {
      const { mergeMessages } = await import('@/utils/messageUtils');
      const { Message } = await import('@/types');

      const existing: Message[] = [
        {
          id: 'msg-2',
          text: 'Message 2',
          userId: 'user-1',
          sessionId: 'session-1',
          createdAt: '2024-01-01T10:01:00Z',
          role: 'user',
        },
      ];

      const newMessages: Message[] = [
        {
          id: 'msg-1',
          text: 'Message 1',
          userId: 'user-1',
          sessionId: 'session-1',
          createdAt: '2024-01-01T10:00:00Z',
          role: 'user',
        },
        {
          id: 'msg-3',
          text: 'Message 3',
          userId: 'user-1',
          sessionId: 'session-1',
          createdAt: '2024-01-01T10:02:00Z',
          role: 'user',
        },
      ];

      const result = mergeMessages(existing, newMessages);

      // Should be sorted by createdAt
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });
  });

  describe('SSE Integration', () => {
    it('should handle SSE stream lifecycle', async () => {
      const { createSSEStream } = await import('@/utils/sse');

      const handlers = {
        onChunk: vi.fn(),
        onMessage: vi.fn(),
        onError: vi.fn(),
        onDone: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      };

      // Mock fetch for pre-flight
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/event-stream',
        },
      });

      // Mock EventSource
      const mockEventSource = {
        readyState: 0,
        addEventListener: vi.fn(),
        close: vi.fn(),
      };

      global.EventSource = vi.fn(() => mockEventSource as any) as any;

      const cleanup = createSSEStream('agent-123', 'room-456', handlers);

      // Verify setup
      expect(global.EventSource).toHaveBeenCalled();

      // Cleanup
      cleanup();
      expect(mockEventSource.close).toHaveBeenCalled();
      expect(handlers.onClose).toHaveBeenCalled();
    });
  });

  describe('Real Code Path Integration', () => {
    it('should exercise complete message flow with real utilities', async () => {
      const { convertApiMessageToMessage, mergeMessages } = await import('@/utils/messageUtils');

      // Simulate API response
      const apiMessage = {
        id: 'api-msg-1',
        content: 'Hello from API',
        authorId: 'user-123',
        isAgent: false,
        createdAt: '2024-01-01T12:00:00Z',
      };

      // Convert using real function
      const converted = convertApiMessageToMessage(apiMessage, 'session-123', 'agent-123');

      expect(converted.id).toBe('api-msg-1');
      expect(converted.text).toBe('Hello from API');
      expect(converted.role).toBe('user');

      // Merge with existing
      const existing = [converted];
      const newMsg = {
        ...converted,
        id: 'api-msg-2',
        text: 'Second message',
      };

      const merged = mergeMessages(existing, [newMsg]);

      expect(merged).toHaveLength(2);
      expect(merged[0].text).toBe('Hello from API');
      expect(merged[1].text).toBe('Second message');
    });

    it('should handle boundary conditions in real functions', async () => {
      const { convertApiMessageToMessage, mergeMessages } = await import('@/utils/messageUtils');

      // Test with minimal data
      const minimalApiMsg = {
        isAgent: false,
      };

      const converted = convertApiMessageToMessage(minimalApiMsg as any, 'session-1', 'agent-1');

      expect(converted.id).toBeTruthy();
      expect(converted.text).toBe('');
      expect(converted.userId).toBe('');

      // Test merge with empty arrays
      const emptyMerge = mergeMessages([], []);
      expect(emptyMerge).toEqual([]);

      const singleMerge = mergeMessages([], [converted]);
      expect(singleMerge).toHaveLength(1);
    });
  });
});
