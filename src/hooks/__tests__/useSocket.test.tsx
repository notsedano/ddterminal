import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSocket } from '../useSocket';
import ElizaSocketClient from '@/services/websocket/socketClient';

// Mock the socket client
vi.mock('@/services/websocket/socketClient', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
    getConnected: vi.fn(() => false),
  })),
}));

// Mock config
vi.mock('@/utils/config', () => ({
  getApiBase: vi.fn(() => 'https://api.example.com'),
}));

describe('useSocket', () => {
  let mockSocketClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendMessage: vi.fn(),
      getConnected: vi.fn(() => false),
    };
    (ElizaSocketClient as any).mockImplementation(() => mockSocketClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isTyping).toBe(false);
    expect(result.current.status).toBe('idle');
  });

  it('should connect when enabled is true', () => {
    renderHook(() => useSocket({ agentId: 'agent-123', roomId: 'room-456', enabled: true }));

    expect(ElizaSocketClient).toHaveBeenCalled();
    expect(mockSocketClient.connect).toHaveBeenCalled();
  });

  it('should not connect when enabled is false', () => {
    renderHook(() => useSocket({ agentId: 'agent-123', roomId: 'room-456', enabled: false }));

    expect(mockSocketClient.connect).not.toHaveBeenCalled();
  });

  it('should update connection state when connected', async () => {
    let onConnectedCallback: (() => void) | undefined;

    mockSocketClient.connect = vi.fn((_agentId: string, _roomId: string, handlers: any) => {
      onConnectedCallback = handlers.onConnected;
    });

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    await act(async () => {
      onConnectedCallback?.();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should update connection state when disconnected', async () => {
    let onConnected: (() => void) | undefined;
    let onDisconnected: (() => void) | undefined;

    mockSocketClient.connect = vi.fn((_a: string, _r: string, handlers: any) => {
      onConnected = handlers.onConnected;
      onDisconnected = handlers.onDisconnected;
    });

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    await act(async () => { onConnected?.(); });
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    await act(async () => { onDisconnected?.(); });
    await waitFor(() => expect(result.current.isConnected).toBe(false));
  });

  it('should update typing state', async () => {
    let onTypingCallback: ((data: any) => void) | undefined;

    mockSocketClient.connect = vi.fn((_a: string, _r: string, handlers: any) => {
      onTypingCallback = handlers.onTyping;
    });

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    await act(async () => { onTypingCallback?.({ isTyping: true }); });
    await waitFor(() => {
      expect(result.current.isTyping).toBe(true);
      expect(result.current.status).toBe('typing');
    });

    await act(async () => { onTypingCallback?.({ isTyping: false }); });
    await waitFor(() => {
      expect(result.current.isTyping).toBe(false);
      expect(result.current.status).toBe('idle');
    });
  });

  it('should update status on status events', async () => {
    let onStatusCallback: ((data: any) => void) | undefined;

    mockSocketClient.connect = vi.fn((_a: string, _r: string, handlers: any) => {
      onStatusCallback = handlers.onStatus;
    });

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    await act(async () => { onStatusCallback?.({ status: 'processing' }); });
    await waitFor(() => expect(result.current.status).toBe('processing'));
  });

  it('should handle errors', async () => {
    let onErrorCallback: ((error: Error) => void) | undefined;

    mockSocketClient.connect = vi.fn((_a: string, _r: string, handlers: any) => {
      onErrorCallback = handlers.onError;
    });

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    await act(async () => {
      onErrorCallback?.(new Error('Socket error'));
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('should send message when connected', async () => {
    let onConnected: (() => void) | undefined;
    mockSocketClient.connect = vi.fn((_a: string, _r: string, handlers: any) => {
      onConnected = handlers.onConnected;
    });

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    await act(async () => { onConnected?.(); });
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      result.current.sendMessage('Hello', 'user-123');
    });

    expect(mockSocketClient.sendMessage).toHaveBeenCalledWith(
      'agent-123',
      'Hello',
      'user-123',
      'room-456'
    );
  });

  it('should not send message when not connected', () => {
    mockSocketClient.getConnected = vi.fn(() => false);

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    result.current.sendMessage('Hello', 'user-123');

    expect(mockSocketClient.sendMessage).not.toHaveBeenCalled();
  });

  it('should update status to processing when sending message', async () => {
    let onConnected: (() => void) | undefined;
    mockSocketClient.connect = vi.fn((_a: string, _r: string, handlers: any) => {
      onConnected = handlers.onConnected;
    });

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    await act(async () => { onConnected?.(); });
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      result.current.sendMessage('Hello', 'user-123');
    });

    await waitFor(() => expect(result.current.status).toBe('processing'));
  });

  it('should register message handler', async () => {
    let onMsg: ((d: any) => void) | undefined;
    mockSocketClient.connect = vi.fn((_a: string, _r: string, handlers: any) => {
      onMsg = handlers.onMessage;
    });

    const { result } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    const handler = vi.fn();
    result.current.onMessage(handler);

    await act(async () => { onMsg?.({ text: 'Hello' }); });
    expect(handler).toHaveBeenCalledWith({ text: 'Hello' });
  });

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() =>
      useSocket({ agentId: 'agent-123', roomId: 'room-456' })
    );

    unmount();

    expect(mockSocketClient.disconnect).toHaveBeenCalled();
  });

  it('should reconnect when agentId or roomId changes', () => {
    const { rerender } = renderHook(
      ({ agentId, roomId }) => useSocket({ agentId, roomId }),
      {
        initialProps: { agentId: 'agent-123', roomId: 'room-456' },
      }
    );

    expect(mockSocketClient.connect).toHaveBeenCalledTimes(1);

    rerender({ agentId: 'agent-789', roomId: 'room-456' });

    expect(mockSocketClient.disconnect).toHaveBeenCalled();
    expect(mockSocketClient.connect).toHaveBeenCalledTimes(2);
  });

});
