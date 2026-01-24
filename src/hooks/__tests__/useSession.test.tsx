import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateSession,
  useSession,
  useSessions,
  useDeleteSession,
} from '../useSession';
import * as sessionAPI from '@/services/api/sessions';
import * as storage from '@/services/storage/conversationStorage';
import { generateUUID } from '@/utils/uuid';

// Mock dependencies
vi.mock('@/services/api/sessions');
vi.mock('@/services/storage/conversationStorage');
vi.mock('@/utils/uuid');
vi.mock('@/utils/storage', () => ({
  getUserId: vi.fn(() => 'test-user-id'),
}));

const mockedSessionAPI = vi.mocked(sessionAPI);
const mockedStorage = vi.mocked(storage);
const mockedGenerateUUID = vi.mocked(generateUUID);

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

describe('useSession hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGenerateUUID.mockReturnValue('generated-uuid-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useCreateSession', () => {
    it('should create a session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        agentId: 'agent-123',
        userId: 'test-user-id',
        channelId: 'channel-123',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      mockedSessionAPI.createSession.mockResolvedValue(mockSession);

      const { result } = renderHook(() => useCreateSession(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ agentId: 'agent-123' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedSessionAPI.createSession).toHaveBeenCalledWith({
        agentId: 'agent-123',
        userId: 'test-user-id',
        channelId: 'generated-uuid-123',
      });

      expect(mockedStorage.saveSession).toHaveBeenCalledWith(mockSession);
    });

    it('should use provided channelId if given', async () => {
      const mockSession = {
        sessionId: 'session-123',
        agentId: 'agent-123',
        userId: 'test-user-id',
        channelId: 'custom-channel',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      mockedSessionAPI.createSession.mockResolvedValue(mockSession);

      const { result } = renderHook(() => useCreateSession(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ agentId: 'agent-123', channelId: 'custom-channel' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedSessionAPI.createSession).toHaveBeenCalledWith({
        agentId: 'agent-123',
        userId: 'test-user-id',
        channelId: 'custom-channel',
      });
    });

    it('should handle creation errors', async () => {
      const error = new Error('Failed to create session');
      mockedSessionAPI.createSession.mockRejectedValue(error);

      const { result } = renderHook(() => useCreateSession(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ agentId: 'agent-123' });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useSession', () => {
    it('should fetch session from storage first', async () => {
      const storedSession = {
        sessionId: 'session-123',
        agentId: 'agent-123',
        userId: 'test-user-id',
        channelId: 'channel-123',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      mockedStorage.getSession.mockResolvedValue(storedSession);

      const { result } = renderHook(() => useSession('session-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(storedSession);
      });

      expect(mockedStorage.getSession).toHaveBeenCalledWith('session-123');
      expect(mockedSessionAPI.getSession).not.toHaveBeenCalled();
    });

    it('should fetch from API if not in storage', async () => {
      const apiSession = {
        sessionId: 'session-123',
        agentId: 'agent-123',
        userId: 'test-user-id',
        channelId: 'channel-123',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      mockedStorage.getSession.mockResolvedValue(undefined);
      mockedSessionAPI.getSession.mockResolvedValue(apiSession);

      const { result } = renderHook(() => useSession('session-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(apiSession);
      });

      expect(mockedSessionAPI.getSession).toHaveBeenCalledWith('session-123');
      expect(mockedStorage.saveSession).toHaveBeenCalledWith(apiSession);
    });

    it('should not fetch when sessionId is null', () => {
      const { result } = renderHook(() => useSession(null), {
        wrapper: createWrapper(),
      });

      // Query is disabled when sessionId is null; data is undefined initially
      expect(result.current.data === null || result.current.data === undefined).toBe(true);
      expect(mockedStorage.getSession).not.toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Session not found');
      mockedStorage.getSession.mockResolvedValue(undefined);
      mockedSessionAPI.getSession.mockRejectedValue(error);

      const { result } = renderHook(() => useSession('session-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useSessions', () => {
    it('should fetch all sessions for user', async () => {
      const sessions = [
        {
          sessionId: 'session-1',
          agentId: 'agent-123',
          userId: 'test-user-id',
          channelId: 'channel-1',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
        {
          sessionId: 'session-2',
          agentId: 'agent-123',
          userId: 'test-user-id',
          channelId: 'channel-2',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
      ];

      mockedStorage.getAllSessions.mockResolvedValue(sessions);

      const { result } = renderHook(() => useSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(sessions);
      });

      expect(mockedStorage.getAllSessions).toHaveBeenCalledWith('test-user-id');
    });

    it('should return empty array when no sessions exist', async () => {
      mockedStorage.getAllSessions.mockResolvedValue([]);

      const { result } = renderHook(() => useSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Storage error');
      mockedStorage.getAllSessions.mockRejectedValue(error);

      const { result } = renderHook(() => useSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useDeleteSession', () => {
    it('should delete session from API and storage', async () => {
      mockedSessionAPI.deleteSession.mockResolvedValue(undefined);
      mockedStorage.deleteSession.mockResolvedValue();

      const { result } = renderHook(() => useDeleteSession(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('session-123');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedSessionAPI.deleteSession).toHaveBeenCalledWith('session-123');
      expect(mockedStorage.deleteSession).toHaveBeenCalledWith('session-123');
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Failed to delete');
      mockedSessionAPI.deleteSession.mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteSession(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('session-123');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should invalidate queries after deletion', async () => {
      mockedSessionAPI.deleteSession.mockResolvedValue(undefined);
      mockedStorage.deleteSession.mockResolvedValue();

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const { result } = renderHook(() => useDeleteSession(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      });

      // Set up query data
      queryClient.setQueryData(['session', 'session-123'], { sessionId: 'session-123' });
      queryClient.setQueryData(['messages', 'session-123'], { messages: [] });

      result.current.mutate('session-123');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Queries should be removed
      expect(queryClient.getQueryData(['session', 'session-123'])).toBeUndefined();
      expect(queryClient.getQueryData(['messages', 'session-123'])).toBeUndefined();
    });
  });
});
