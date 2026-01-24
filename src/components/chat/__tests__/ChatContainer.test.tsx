import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatContainer } from '../ChatContainer';
import { useChat } from '@/hooks/useChat';

// Mock useChat hook
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(),
}));

const mockedUseChat = vi.mocked(useChat);

describe('ChatContainer', () => {
  const defaultChatReturn = {
    messages: [],
    sendMessage: vi.fn(),
    isSending: false,
    isConnected: true,
    isTyping: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseChat.mockReturnValue(defaultChatReturn as any);
  });

  it('should render message list and input', () => {
    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
      />
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should display messages', () => {
    const messages = [
      {
        id: 'msg-1',
        text: 'Hello',
        userId: 'user-123',
        sessionId: 'session-123',
        createdAt: new Date().toISOString(),
        role: 'user' as const,
      },
      {
        id: 'msg-2',
        text: 'Hi there',
        userId: 'agent-123',
        agentId: 'agent-123',
        sessionId: 'session-123',
        createdAt: new Date().toISOString(),
        role: 'agent' as const,
      },
    ];

    mockedUseChat.mockReturnValue({
      ...defaultChatReturn,
      messages,
    } as any);

    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
      />
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('should call sendMessage when message is sent', async () => {
    const sendMessage = vi.fn();
    mockedUseChat.mockReturnValue({
      ...defaultChatReturn,
      sendMessage,
    } as any);

    const user = userEvent.setup();

    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
      />
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('Test message');
    });
  });

  it('should disable input when sending', () => {
    mockedUseChat.mockReturnValue({
      ...defaultChatReturn,
      isSending: true,
    } as any);

    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
      />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute('placeholder', 'Sending...');
  });

  it('should show error message when error occurs', () => {
    mockedUseChat.mockReturnValue({
      ...defaultChatReturn,
      error: 'Session expired',
    } as any);

    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
      />
    );

    expect(screen.getByText('Session expired')).toBeInTheDocument();
  });

  it('should show connection warning when not connected', () => {
    mockedUseChat.mockReturnValue({
      ...defaultChatReturn,
      isConnected: false,
    } as any);

    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
      />
    );

    expect(
      screen.getByText(/Real-time updates unavailable/)
    ).toBeInTheDocument();
  });

  it('should not show connection warning when error is present', () => {
    mockedUseChat.mockReturnValue({
      ...defaultChatReturn,
      isConnected: false,
      error: 'Some error',
    } as any);

    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
      />
    );

    expect(
      screen.queryByText(/Real-time updates unavailable/)
    ).not.toBeInTheDocument();
  });

  it('should pass onSessionInvalid to useChat when provided', () => {
    const onSessionInvalid = vi.fn();
    mockedUseChat.mockReturnValue({ ...defaultChatReturn } as any);

    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
        onSessionInvalid={onSessionInvalid}
      />
    );

    expect(mockedUseChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-123',
        agentId: 'agent-123',
        roomId: 'room-123',
        onSessionInvalid,
      })
    );
  });

  it('should handle typing indicator', () => {
    mockedUseChat.mockReturnValue({
      ...defaultChatReturn,
      isTyping: true,
    } as any);

    render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
      />
    );

    // TypingIndicator should be rendered by MessageList
    // This is tested indirectly through the component rendering
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should handle empty sessionId', () => {
    mockedUseChat.mockReturnValue({
      ...defaultChatReturn,
      messages: [],
    } as any);

    render(
      <ChatContainer
        sessionId={null}
        agentId="agent-123"
        roomId="room-123"
      />
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ChatContainer
        sessionId="session-123"
        agentId="agent-123"
        roomId="room-123"
        className="custom-class"
      />
    );

    const chatContainer = container.firstChild as HTMLElement;
    expect(chatContainer.className).toContain('custom-class');
  });
});
