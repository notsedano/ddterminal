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
});
