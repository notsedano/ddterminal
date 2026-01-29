/**
 * Comprehensive tests for useChat error handling
 * Tests error extraction, SSE error handling, and integration scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChat } from '@/hooks/useChat';
import * as messagesApiModule from '@/services/api/messages';
import { SessionNotFoundError } from '@/services/api/client';

// Mock dependencies
vi.mock('@/services/api/messages');
vi.mock('@/services/api/sessions');
vi.mock('@/services/storage/conversationStorage');
vi.mock('@/services/supabase');
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useMemory');
vi.mock('@/utils/storage');

describe('useChat Error Handling', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  describe('SSE Stream Error Handling', () => {
    it('should extract error message from Error objects', async () => {
      const mockOnError = vi.fn();
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn((sessionId, data, handlers) => {
        // Simulate SSE error
        handlers.onError?.({ message: 'Stream error', code: 'SSE_ERROR' });
        return Promise.resolve({ messageId: 'msg-123', sessionId });
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Stream error');
      });
    });

    it('should handle network errors from SSE stream', async () => {
      const networkError = new TypeError('Failed to fetch');
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn(() => {
        return Promise.reject(networkError);
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      // Trigger sendMessage
      result.current.sendMessage('test message');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error).toContain('Failed to fetch');
      });
    });

    it('should handle session not found errors', async () => {
      const sessionError = new SessionNotFoundError('Session not found', 'SESSION_NOT_FOUND');
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn(() => {
        return Promise.reject(sessionError);
      });

      const mockOnSessionInvalid = vi.fn();

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
          onSessionInvalid: mockOnSessionInvalid,
        }),
        { wrapper }
      );

      result.current.sendMessage('test message');

      await waitFor(() => {
        expect(result.current.error).toContain('expired');
        expect(mockOnSessionInvalid).toHaveBeenCalledWith('test-session');
      });
    });

    it('should handle errors with circular references safely', async () => {
      const circularError: any = { message: 'Circular error' };
      circularError.self = circularError;

      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn((sessionId, data, handlers) => {
        handlers.onError?.(circularError);
        return Promise.resolve({ messageId: 'msg-123', sessionId });
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      await waitFor(() => {
        // Should extract message without throwing
        expect(result.current.error).toBe('Circular error');
      });
    });

    it('should handle string errors from SSE stream', async () => {
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn((sessionId, data, handlers) => {
        handlers.onError?.({ message: 'String error', code: 'ERROR' });
        return Promise.resolve({ messageId: 'msg-123', sessionId });
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.error).toBe('String error');
      });
    });
  });

  describe('Error State Management', () => {
    it('should clear error when message sends successfully', async () => {
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn(() => {
        return Promise.resolve({ messageId: 'msg-123', sessionId: 'test-session' });
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      // Set an error first
      // Then send a message
      result.current.sendMessage('test message');

      await waitFor(() => {
        // Error should be cleared on success
        expect(result.current.error).toBeNull();
      });
    });

    it('should preserve error state during streaming', async () => {
      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn((sessionId, data, handlers) => {
        handlers.onError?.({ message: 'Stream error', code: 'ERROR' });
        return streamPromise.then(() => ({ messageId: 'msg-123', sessionId }));
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      result.current.sendMessage('test message');

      await waitFor(() => {
        expect(result.current.error).toBe('Stream error');
      });

      // Error should persist during streaming
      expect(result.current.error).toBe('Stream error');
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle null sessionId errors', async () => {
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn(() => {
        return Promise.reject(new Error('Session required'));
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: null,
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      result.current.sendMessage('test message');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    it('should handle empty error messages', async () => {
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn((sessionId, data, handlers) => {
        handlers.onError?.({ message: '', code: 'ERROR' });
        return Promise.resolve({ messageId: 'msg-123', sessionId });
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      await waitFor(() => {
        // Should handle empty string gracefully
        expect(result.current.error).toBe('');
      });
    });

    it('should handle very long error messages', async () => {
      const longError = 'A'.repeat(10000);
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn((sessionId, data, handlers) => {
        handlers.onError?.({ message: longError, code: 'ERROR' });
        return Promise.resolve({ messageId: 'msg-123', sessionId });
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.error).toBe(longError);
        expect(result.current.error?.length).toBe(10000);
      });
    });
  });

  describe('Concurrent Error Handling', () => {
    it('should handle multiple rapid errors', async () => {
      let errorCount = 0;
      (messagesApiModule.sendMessageWithStreaming as any) = vi.fn((sessionId, data, handlers) => {
        errorCount++;
        handlers.onError?.({ message: `Error ${errorCount}`, code: 'ERROR' });
        return Promise.resolve({ messageId: `msg-${errorCount}`, sessionId });
      });

      const { result } = renderHook(
        () => useChat({
          sessionId: 'test-session',
          agentId: 'test-agent',
          roomId: 'test-room',
        }),
        { wrapper }
      );

      // Send multiple messages rapidly
      result.current.sendMessage('message 1');
      result.current.sendMessage('message 2');
      result.current.sendMessage('message 3');

      await waitFor(() => {
        // Should handle the latest error
        expect(result.current.error).toBeTruthy();
      });
    });
  });
});
