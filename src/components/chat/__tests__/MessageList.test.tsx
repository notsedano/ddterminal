import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../MessageList';
import type { Message } from '@/types';

describe('MessageList', () => {
  const createMessage = (id: string, text: string, role: 'user' | 'agent' = 'user'): Message => ({
    id,
    text,
    userId: 'user-123',
    sessionId: 'session-123',
    createdAt: new Date().toISOString(),
    role,
  });

  beforeEach(() => {
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('should render empty message list', () => {
    render(<MessageList messages={[]} />);
    expect(screen.queryByText(/Hello/)).not.toBeInTheDocument();
  });

  it('should render messages', () => {
    const messages = [
      createMessage('msg-1', 'Hello'),
      createMessage('msg-2', 'Hi there'),
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('should render typing indicator when isTyping is true', () => {
    const { container } = render(<MessageList messages={[]} isTyping={true} />);
    expect(container.querySelector('.space-y-2')).toBeInTheDocument();
    expect(container.querySelector('.animate-bounce')).toBeInTheDocument();
  });

  it('should not render typing indicator when isTyping is false', () => {
    render(<MessageList messages={[]} isTyping={false} />);

    // Should not crash
    expect(screen.queryByText(/typing/i)).not.toBeInTheDocument();
  });

  it('should scroll to bottom when messages change', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(<MessageList messages={[createMessage('msg-1', 'Hello')]} />);

    rerender(<MessageList messages={[createMessage('msg-1', 'Hello'), createMessage('msg-2', 'Hi')]} />);

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('should scroll to bottom when typing state changes', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(<MessageList messages={[]} isTyping={false} />);

    rerender(<MessageList messages={[]} isTyping={true} />);

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('should handle many messages', () => {
    const messages = Array.from({ length: 100 }, (_, i) =>
      createMessage(`msg-${i}`, `Message ${i}`)
    );

    render(<MessageList messages={messages} />);

    expect(screen.getByText('Message 0')).toBeInTheDocument();
    expect(screen.getByText('Message 99')).toBeInTheDocument();
  });

  it('should render user and agent messages', () => {
    const messages = [
      createMessage('msg-1', 'User message', 'user'),
      createMessage('msg-2', 'Agent message', 'agent'),
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByText('User message')).toBeInTheDocument();
    expect(screen.getByText('Agent message')).toBeInTheDocument();
  });

  it('should handle messages with special characters', () => {
    const messages = [
      createMessage('msg-1', 'Hello! @user #hashtag $money 💰'),
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByText(/Hello! @user #hashtag \$money 💰/)).toBeInTheDocument();
  });

  it('should handle empty message text', () => {
    const messages = [createMessage('msg-1', '')];
    const { container } = render(<MessageList messages={messages} />);
    expect(container.querySelector('.space-y-2')).toBeInTheDocument();
  });
});
