import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSession, getSession, getMessages, deleteSession } from '../sessions';
import apiClient from '../client';

vi.mock('../client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe('Sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a session with correct data', async () => {
      const sessionData = {
        agentId: 'test-agent',
        userId: 'test-user',
        channelId: 'test-channel',
      };

      const mockResponse = {
        data: {
          sessionId: 'session-123',
          agentId: 'test-agent',
          userId: 'test-user',
          channelId: 'test-channel',
          createdAt: '2024-01-01T12:00:00Z',
        },
      };

      mockedApiClient.post.mockResolvedValue(mockResponse);

      const result = await createSession(sessionData);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/messaging/sessions', sessionData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors', async () => {
      const sessionData = {
        agentId: 'test-agent',
        userId: 'test-user',
        channelId: 'test-channel',
      };

      const error = new Error('Failed to create session');
      mockedApiClient.post.mockRejectedValue(error);

      await expect(createSession(sessionData)).rejects.toThrow('Failed to create session');
    });

    it('should handle network errors', async () => {
      const sessionData = {
        agentId: 'test-agent',
        userId: 'test-user',
        channelId: 'test-channel',
      };

      mockedApiClient.post.mockRejectedValue(new Error('Network error'));

      await expect(createSession(sessionData)).rejects.toThrow('Network error');
    });
  });

  describe('getSession', () => {
    it('should fetch a session by id', async () => {
      const sessionId = 'session-123';
      const mockResponse = {
        data: {
          sessionId,
          agentId: 'test-agent',
          userId: 'test-user',
          channelId: 'test-channel',
          createdAt: '2024-01-01T12:00:00Z',
        },
      };

      mockedApiClient.get.mockResolvedValue(mockResponse);

      const result = await getSession(sessionId);

      expect(mockedApiClient.get).toHaveBeenCalledWith(`/messaging/sessions/${sessionId}`);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle 404 errors for non-existent session', async () => {
      const sessionId = 'non-existent';
      const error = {
        response: {
          status: 404,
          data: { error: { message: 'Session not found' } },
        },
      };

      mockedApiClient.get.mockRejectedValue(error);

      await expect(getSession(sessionId)).rejects.toThrow();
    });

    it('should handle empty session id', async () => {
      const error = new Error('Invalid session ID');
      mockedApiClient.get.mockRejectedValue(error);

      await expect(getSession('')).rejects.toThrow();
    });
  });

  describe('getMessages', () => {
    it('should fetch messages for a session', async () => {
      const sessionId = 'session-123';
      const mockResponse = {
        data: {
          messages: [
            {
              id: 'msg-1',
              content: 'Hello',
              authorId: 'user-1',
              isAgent: false,
              createdAt: '2024-01-01T12:00:00Z',
            },
          ],
          hasMore: false,
        },
      };

      mockedApiClient.get.mockResolvedValue(mockResponse);

      const result = await getMessages(sessionId);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/messaging/sessions/${sessionId}/messages`,
        { params: {} }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should include limit parameter when provided', async () => {
      const sessionId = 'session-123';
      const limit = 50;
      const mockResponse = {
        data: {
          messages: [],
          hasMore: false,
        },
      };

      mockedApiClient.get.mockResolvedValue(mockResponse);

      await getMessages(sessionId, limit);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/messaging/sessions/${sessionId}/messages`,
        { params: { limit: 50 } }
      );
    });

    it('should handle empty messages response', async () => {
      const sessionId = 'session-123';
      const mockResponse = {
        data: {
          messages: [],
          hasMore: false,
        },
      };

      mockedApiClient.get.mockResolvedValue(mockResponse);

      const result = await getMessages(sessionId);
      expect(result.messages).toEqual([]);
    });

    it('should handle API errors', async () => {
      const sessionId = 'session-123';
      const error = new Error('Failed to fetch messages');
      mockedApiClient.get.mockRejectedValue(error);

      await expect(getMessages(sessionId)).rejects.toThrow('Failed to fetch messages');
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const sessionId = 'session-123';
      mockedApiClient.delete.mockResolvedValue({ data: {} });

      await deleteSession(sessionId);

      expect(mockedApiClient.delete).toHaveBeenCalledWith(`/messaging/sessions/${sessionId}`);
    });

    it('should handle 404 errors for non-existent session', async () => {
      const sessionId = 'non-existent';
      const error = {
        response: {
          status: 404,
          data: { error: { message: 'Session not found' } },
        },
      };

      mockedApiClient.delete.mockRejectedValue(error);

      await expect(deleteSession(sessionId)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const sessionId = 'session-123';
      mockedApiClient.delete.mockRejectedValue(new Error('Network error'));

      await expect(deleteSession(sessionId)).rejects.toThrow('Network error');
    });

    it('should handle empty session id', async () => {
      mockedApiClient.delete.mockRejectedValue(new Error('Invalid session ID'));

      await expect(deleteSession('')).rejects.toThrow();
    });
  });
});
