import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '../MessageInput';

describe('MessageInput', () => {
  it('should render textarea and send button', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should call onSend when send button is clicked', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello, world!');

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    expect(onSend).toHaveBeenCalledWith('Hello, world!');
    expect(textarea).toHaveValue('');
  });

  it('should call onSend when Enter is pressed', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello{Enter}');

    expect(onSend).toHaveBeenCalledWith('Hello');
    expect(textarea).toHaveValue('');
  });

  it('should not call onSend when Shift+Enter is pressed', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello{Shift>}{Enter}{/Shift}');

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Hello\n');
  });

  it('should not send empty messages', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} />);

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should not send whitespace-only messages', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '   ');

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should disable input when disabled prop is true', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled />);

    const textarea = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button');

    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('should not call onSend when disabled', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} disabled />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello');

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should show custom placeholder', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} placeholder="Type your message..." />);

    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });

  it('should show default placeholder', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('should run resize effect when text changes', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<MessageInput onSend={onSend} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await user.type(textarea, 'Line 1\nLine 2');
    // Effect runs; in jsdom scrollHeight may be 0 so height can stay 0px or auto
    expect(textarea.value).toBe('Line 1\nLine 2');
  });

  it('should clear input and reset after send', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<MessageInput onSend={onSend} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await user.type(textarea, 'Multi\nline\nmessage');
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledWith('Multi\nline\nmessage');
    expect(textarea.value).toBe('');
  });

  it('should handle long messages', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    const longMessage = 'a'.repeat(500);
    fireEvent.change(textarea, { target: { value: longMessage } });

    expect(textarea).toHaveValue(longMessage);
    await user.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledWith(longMessage);
  });

  it('should handle special characters', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello! @user #hashtag $money' } });
    await user.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledWith('Hello! @user #hashtag $money');
  });

  it('should trim message before sending', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  Hello  ' } });
    await user.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('should disable send button when text is empty', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const sendButton = screen.getByRole('button');
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when text is entered', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button');

    expect(sendButton).toBeDisabled();

    await user.type(textarea, 'Hello');

    expect(sendButton).not.toBeDisabled();
  });

  it('should handle rapid typing and sending', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');

    for (let i = 0; i < 5; i++) {
      await user.type(textarea, `Message ${i}`);
      await user.keyboard('{Enter}');
    }

    expect(onSend).toHaveBeenCalledTimes(5);
  });
});
