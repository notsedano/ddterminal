import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import type { Message } from '@/types';

describe('MessageBubble', () => {
  const createUserMessage = (text: string): Message => ({
    id: 'msg-1',
    text,
    userId: 'user-123',
    sessionId: 'session-123',
    createdAt: '2024-01-01T12:00:00Z',
    role: 'user',
  });

  const createAgentMessage = (text: string): Message => ({
    id: 'msg-2',
    text,
    userId: 'agent-123',
    agentId: 'agent-123',
    sessionId: 'session-123',
    createdAt: '2024-01-01T12:00:00Z',
    role: 'agent',
  });

  it('should render user message', () => {
    const message = createUserMessage('Hello, world!');
    render(<MessageBubble message={message} />);

    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('should render agent message', () => {
    const message = createAgentMessage('Hello, how can I help?');
    render(<MessageBubble message={message} />);

    expect(screen.getByText('Hello, how can I help?')).toBeInTheDocument();
  });

  it('should apply correct styling for user messages', () => {
    const message = createUserMessage('User message');
    const { container } = render(<MessageBubble message={message} />);

    const bubble = container.querySelector('.bg-primary');
    expect(bubble).toBeInTheDocument();
  });

  it('should apply correct styling for agent messages', () => {
    const message = createAgentMessage('Agent message');
    const { container } = render(<MessageBubble message={message} />);

    const bubble = container.querySelector('.bg-muted');
    expect(bubble).toBeInTheDocument();
  });

  it('should render markdown content', () => {
    const message = createAgentMessage('**Bold** and *italic* text');
    render(<MessageBubble message={message} />);

    // ReactMarkdown should render the markdown
    expect(screen.getByText('Bold')).toBeInTheDocument();
  });

  it('should render timestamp', () => {
    const message = createUserMessage('Hello');
    render(<MessageBubble message={message} />);

    // Should render time in HH:mm format (format may vary by timezone)
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('should handle empty message text', () => {
    const message = createUserMessage('');
    const { container } = render(<MessageBubble message={message} />);

    // Renders div wrapper; prose block may be empty
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should handle long messages', () => {
    const longText = 'a'.repeat(1000);
    const message = createUserMessage(longText);
    render(<MessageBubble message={message} />);

    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  it('should handle special characters', () => {
    const message = createUserMessage('Hello! @user #hashtag $money 💰');
    render(<MessageBubble message={message} />);

    expect(screen.getByText(/Hello! @user #hashtag \$money 💰/)).toBeInTheDocument();
  });

  it('should handle markdown code blocks', () => {
    const message = createAgentMessage('```\nconst code = "test";\n```');
    render(<MessageBubble message={message} />);

    // ReactMarkdown should render code blocks
    expect(screen.getByText('const code = "test";')).toBeInTheDocument();
  });

  it('should handle markdown links', () => {
    const message = createAgentMessage('[Link](https://example.com)');
    render(<MessageBubble message={message} />);

    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('should handle markdown lists', () => {
    const message = createAgentMessage('- Item 1\n- Item 2\n- Item 3');
    render(<MessageBubble message={message} />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should align user messages to the right', () => {
    const message = createUserMessage('User message');
    const { container } = render(<MessageBubble message={message} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-end');
  });

  it('should align agent messages to the left', () => {
    const message = createAgentMessage('Agent message');
    const { container } = render(<MessageBubble message={message} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-start');
  });

  it('should handle different timestamp formats', () => {
    const message: Message = {
      ...createUserMessage('Test'),
      createdAt: '2024-01-15T14:30:00Z',
    };

    render(<MessageBubble message={message} />);

    // Should format to local time (format may vary by timezone)
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('should handle messages with metadata', () => {
    const message: Message = {
      ...createUserMessage('Message with metadata'),
      metadata: { source: 'web', priority: 'high' },
    };

    render(<MessageBubble message={message} />);

    expect(screen.getByText('Message with metadata')).toBeInTheDocument();
  });

  it('should limit message width to 80%', () => {
    const message = createUserMessage('Test message');
    const { container } = render(<MessageBubble message={message} />);

    const bubble = container.querySelector('.max-w-\\[80\\%\\]');
    expect(bubble).toBeInTheDocument();
  });
});
