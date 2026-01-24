import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendMessage } from '../messages';
import apiClient from '../client';

vi.mock('../client', () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe('Messages API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send a message with correct format', async () => {
      const sessionId = 'session-123';
      const messageData = {
        text: 'Hello, world!',
        userId: 'user-456',
      };

      const mockResponse = {
        data: {
          success: true,
          userMessage: {
            id: 'msg-789',
            channel_id: 'channel-123',
            author_id: 'user-456',
            content: 'Hello, world!',
            created_at: Date.now(),
            source_type: 'user',
            metadata: {},
          },
          sessionStatus: {
            expiresAt: '2024-01-01T13:00:00Z',
            renewalCount: 0,
            wasRenewed: false,
            isNearExpiration: false,
          },
        },
      };

      mockedApiClient.post.mockResolvedValue(mockResponse);

      const result = await sendMessage(sessionId, messageData);

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        `/messaging/sessions/${sessionId}/messages`,
        {
          content: 'Hello, world!',
          userId: 'user-456',
        }
      );

      expect(result).toEqual({
        messageId: 'msg-789',
        sessionId: 'session-123',
      });
    });

    it('should handle empty message text', async () => {
      const sessionId = 'session-123';
      const messageData = {
        text: '',
        userId: 'user-456',
      };

      const mockResponse = {
        data: {
          success: true,
          userMessage: {
            id: 'msg-789',
            channel_id: 'channel-123',
            author_id: 'user-456',
            content: '',
            created_at: Date.now(),
            source_type: 'user',
            metadata: {},
          },
          sessionStatus: {},
        },
      };

      mockedApiClient.post.mockResolvedValue(mockResponse);

      const result = await sendMessage(sessionId, messageData);
      expect(result.messageId).toBe('msg-789');
    });

    it('should handle long messages', async () => {
      const sessionId = 'session-123';
      const longText = 'a'.repeat(10000);
      const messageData = {
        text: longText,
        userId: 'user-456',
      };

      const mockResponse = {
        data: {
          success: true,
          userMessage: {
            id: 'msg-789',
            channel_id: 'channel-123',
            author_id: 'user-456',
            content: longText,
            created_at: Date.now(),
            source_type: 'user',
            metadata: {},
          },
          sessionStatus: {},
        },
      };

      mockedApiClient.post.mockResolvedValue(mockResponse);

      const result = await sendMessage(sessionId, messageData);
      expect(result.messageId).toBe('msg-789');
    });

    it('should handle special characters in message', async () => {
      const sessionId = 'session-123';
      const messageData = {
        text: 'Hello! @user #hashtag $money 💰',
        userId: 'user-456',
      };

      const mockResponse = {
        data: {
          success: true,
          userMessage: {
            id: 'msg-789',
            channel_id: 'channel-123',
            author_id: 'user-456',
            content: 'Hello! @user #hashtag $money 💰',
            created_at: Date.now(),
            source_type: 'user',
            metadata: {},
          },
          sessionStatus: {},
        },
      };

      mockedApiClient.post.mockResolvedValue(mockResponse);

      const result = await sendMessage(sessionId, messageData);
      expect(result.messageId).toBe('msg-789');
    });

    it('should handle API errors', async () => {
      const sessionId = 'session-123';
      const messageData = {
        text: 'Hello',
        userId: 'user-456',
      };

      const error = new Error('Failed to send message');
      mockedApiClient.post.mockRejectedValue(error);

      await expect(sendMessage(sessionId, messageData)).rejects.toThrow('Failed to send message');
    });

    it('should handle 404 errors for non-existent session', async () => {
      const sessionId = 'non-existent';
      const messageData = {
        text: 'Hello',
        userId: 'user-456',
      };

      const error = {
        response: {
          status: 404,
          data: { error: { message: 'Session not found' } },
        },
      };

      mockedApiClient.post.mockRejectedValue(error);

      await expect(sendMessage(sessionId, messageData)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const sessionId = 'session-123';
      const messageData = {
        text: 'Hello',
        userId: 'user-456',
      };

      mockedApiClient.post.mockRejectedValue(new Error('Network error'));

      await expect(sendMessage(sessionId, messageData)).rejects.toThrow('Network error');
    });

    it('should handle empty session id', async () => {
      const messageData = {
        text: 'Hello',
        userId: 'user-456',
      };

      mockedApiClient.post.mockRejectedValue(new Error('Invalid session ID'));

      await expect(sendMessage('', messageData)).rejects.toThrow();
    });

    it('should handle malformed API response', async () => {
      const sessionId = 'session-123';
      const messageData = {
        text: 'Hello',
        userId: 'user-456',
      };

      const mockResponse = {
        data: {
          success: true,
          // Missing userMessage field
          sessionStatus: {},
        },
      };

      mockedApiClient.post.mockResolvedValue(mockResponse);

      await expect(sendMessage(sessionId, messageData)).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const sessionId = 'session-123';
      const messageData = {
        text: 'Hello',
        userId: 'user-456',
      };

      const error = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      };

      mockedApiClient.post.mockRejectedValue(error);

      await expect(sendMessage(sessionId, messageData)).rejects.toThrow();
    });
  });
});
