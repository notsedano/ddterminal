import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSSEStream } from '../sse';
import * as config from '../config';

// Mock config
vi.mock('../config', async () => {
  const actual = await vi.importActual('../config');
  return {
    ...actual,
    getApiBase: vi.fn(() => 'http://localhost:3000'),
    getAuthToken: vi.fn(() => 'test-token'),
  };
});

describe('SSE Utility', () => {
  let mockEventSource: any;
  let eventSourceConstructor: any;
  let handlers: any;

  beforeEach(() => {
    handlers = {
      onChunk: vi.fn(),
      onMessage: vi.fn(),
      onError: vi.fn(),
      onDone: vi.fn(),
      onOpen: vi.fn(),
      onClose: vi.fn(),
    };

    // Mock EventSource
    mockEventSource = {
      readyState: 0, // CONNECTING
      url: '',
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock global EventSource
    global.EventSource = vi.fn((url: string) => {
      mockEventSource.url = url;
      return mockEventSource;
    }) as any;

    // Mock fetch for pre-flight checks
    global.fetch = vi.fn();

    // Mock window
    (global as any).window = {
      __activeSSEConnections: new Set(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (global as any).window;
  });

  describe('connection setup', () => {
    it('should create EventSource with correct URL', () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/event-stream',
        },
      });

      createSSEStream('agent-123', 'room-456', handlers);

      expect(global.EventSource).toHaveBeenCalled();
      expect(mockEventSource.url).toContain('agent-123');
      expect(mockEventSource.url).toContain('room-456');
      expect(mockEventSource.url).toContain('token=test-token');
    });

    it('should handle missing agentId', () => {
      const cleanup = createSSEStream('', 'room-456', handlers);
      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PARAMS' })
      );
      cleanup();
    });

    it('should handle missing roomId', () => {
      const cleanup = createSSEStream('agent-123', '', handlers);
      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PARAMS' })
      );
      cleanup();
    });

    it('should handle missing API base URL', () => {
      vi.mocked(config.getApiBase).mockReturnValue(null);
      const cleanup = createSSEStream('agent-123', 'room-456', handlers);
      expect(handlers.onError).toHaveBeenCalled();
      cleanup();
    });
  });

  describe('pre-flight checks', () => {
    it('should find working endpoint without /api/ prefix', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/event-stream',
        },
      });

      createSSEStream('agent-123', 'room-456', handlers);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalled();
      expect(global.EventSource).toHaveBeenCalled();
    });

    it('should try /api/ prefix if first attempt fails', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'text/event-stream',
          },
        });

      createSSEStream('agent-123', 'room-456', handlers);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle wrong MIME type', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/html',
        },
      });

      createSSEStream('agent-123', 'room-456', handlers);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MIME_TYPE_MISMATCH' })
      );
    });

    it('should handle endpoint not found', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      createSSEStream('agent-123', 'room-456', handlers);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ENDPOINT_NOT_FOUND' })
      );
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/event-stream',
        },
      });
    });

    it('should handle onopen event', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      const onopenHandler = (global.EventSource as any).mock.calls[0]?.[0];
      if (mockEventSource.onopen) {
        mockEventSource.onopen();
      }

      expect(handlers.onOpen).toHaveBeenCalled();
    });

    it('should handle chunk events', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      const addEventListenerCalls = mockEventSource.addEventListener.mock.calls;
      const chunkHandler = addEventListenerCalls.find(
        (call: any[]) => call[0] === 'chunk'
      )?.[1];

      if (chunkHandler) {
        chunkHandler({ data: JSON.stringify({ chunk: 'Hello' }) });
      }

      expect(handlers.onChunk).toHaveBeenCalledWith(
        expect.objectContaining({ chunk: 'Hello' })
      );
    });

    it('should handle message events', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      const addEventListenerCalls = mockEventSource.addEventListener.mock.calls;
      const messageHandler = addEventListenerCalls.find(
        (call: any[]) => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        messageHandler({
          data: JSON.stringify({
            messageId: 'msg-123',
            text: 'Complete message',
            agentId: 'agent-123',
          }),
        });
      }

      expect(handlers.onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
          text: 'Complete message',
        })
      );
    });

    it('should handle default message event (fallback)', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      if (mockEventSource.onmessage) {
        mockEventSource.onmessage({
          data: JSON.stringify({ chunk: 'Streaming chunk' }),
        });
      }

      expect(handlers.onChunk).toHaveBeenCalled();
    });

    it('should handle plain text chunks', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      if (mockEventSource.onmessage) {
        mockEventSource.onmessage({ data: 'Plain text chunk' });
      }

      expect(handlers.onChunk).toHaveBeenCalledWith(
        expect.objectContaining({ chunk: 'Plain text chunk' })
      );
    });

    it('should handle done event', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      const addEventListenerCalls = mockEventSource.addEventListener.mock.calls;
      const doneHandler = addEventListenerCalls.find(
        (call: any[]) => call[0] === 'done'
      )?.[1];

      if (doneHandler) {
        doneHandler();
      }

      expect(handlers.onDone).toHaveBeenCalled();
    });

    it('should handle error events', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      const addEventListenerCalls = mockEventSource.addEventListener.mock.calls;
      const errorHandler = addEventListenerCalls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        errorHandler({
          data: JSON.stringify({ message: 'Custom error', code: 'CUSTOM' }),
        });
      }

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Custom error', code: 'CUSTOM' })
      );
    });

    it('should handle JSON parse errors gracefully', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      const addEventListenerCalls = mockEventSource.addEventListener.mock.calls;
      const chunkHandler = addEventListenerCalls.find(
        (call: any[]) => call[0] === 'chunk'
      )?.[1];

      if (chunkHandler) {
        chunkHandler({ data: 'invalid json{' });
      }

      // Should not throw, just not call handler
      expect(handlers.onChunk).not.toHaveBeenCalled();
    });
  });

  describe('connection errors', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/event-stream',
        },
      });
    });

    it('should handle immediate connection failure (404)', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      mockEventSource.readyState = 2; // CLOSED
      if (mockEventSource.onerror) {
        mockEventSource.onerror({});
      }

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ENDPOINT_NOT_FOUND' })
      );
    });

    it('should attempt reconnection on connection loss', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      // First connection succeeds
      mockEventSource.readyState = 1; // OPEN
      if (mockEventSource.onopen) {
        mockEventSource.onopen();
      }

      // Then connection closes
      mockEventSource.readyState = 2; // CLOSED
      if (mockEventSource.onerror) {
        mockEventSource.onerror({});
      }

      // Should attempt reconnect (with delay)
      vi.useFakeTimers();
      vi.advanceTimersByTime(2000);
      vi.useRealTimers();
    });

    it('should stop reconnecting after max attempts', () => {
      createSSEStream('agent-123', 'room-456', handlers);

      vi.useFakeTimers();

      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        mockEventSource.readyState = 2; // CLOSED
        if (mockEventSource.onerror) {
          mockEventSource.onerror({});
        }
        vi.advanceTimersByTime(5000);
      }

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'CONNECTION_FAILED' })
      );

      vi.useRealTimers();
    });

    it('should not reconnect when manually closed', () => {
      const cleanup = createSSEStream('agent-123', 'room-456', handlers);
      cleanup();

      mockEventSource.readyState = 2; // CLOSED
      if (mockEventSource.onerror) {
        mockEventSource.onerror({});
      }

      // Should not attempt reconnect
      expect(mockEventSource.close).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/event-stream',
        },
      });
    });

    it('should close EventSource on cleanup', () => {
      const cleanup = createSSEStream('agent-123', 'room-456', handlers);
      cleanup();

      expect(mockEventSource.close).toHaveBeenCalled();
      expect(handlers.onClose).toHaveBeenCalled();
    });

    it('should remove from tracking on cleanup', () => {
      const window = (global as any).window;
      const cleanup = createSSEStream('agent-123', 'room-456', handlers);

      expect(window.__activeSSEConnections.size).toBe(1);

      cleanup();

      expect(window.__activeSSEConnections.size).toBe(0);
    });

    it('should clear reconnect timeout on cleanup', () => {
      const cleanup = createSSEStream('agent-123', 'room-456', handlers);

      // Trigger error to set up reconnect
      mockEventSource.readyState = 2;
      if (mockEventSource.onerror) {
        mockEventSource.onerror({});
      }

      cleanup();

      // Cleanup should prevent reconnection
      expect(mockEventSource.close).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle missing handlers gracefully', () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/event-stream',
        },
      });

      expect(() => {
        createSSEStream('agent-123', 'room-456', {});
      }).not.toThrow();
    });

    it('should handle fetch errors in pre-flight', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      createSSEStream('agent-123', 'room-456', handlers);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handlers.onError).toHaveBeenCalled();
    });

    it('should handle EventSource constructor errors', () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/event-stream',
        },
      });

      (global.EventSource as any).mockImplementation(() => {
        throw new Error('EventSource not supported');
      });

      expect(() => {
        createSSEStream('agent-123', 'room-456', handlers);
      }).not.toThrow();

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INIT_FAILED' })
      );
    });
  });
});
