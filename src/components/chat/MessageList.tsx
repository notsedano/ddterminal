import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { HackerBackground } from '@/registry/eldoraui/hacker-background';
import { cn } from '@/utils/cn';
import type { Message } from '@/types';

export interface MessageListProps {
  messages: Message[];
  isTyping?: boolean;
}

export function MessageList({ messages, isTyping }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <HackerBackground />
      <ScrollArea className={cn("relative z-10 flex-1 p-4 h-full")}>
        <div className="space-y-2">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
