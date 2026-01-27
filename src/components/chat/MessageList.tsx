import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { HackerBackground } from '@/registry/eldoraui/hacker-background';
import { cn } from '@/utils/cn';
import type { Message } from '@/types';
import ddThumbnail from '@assets/dd-idl1.gif';

export interface MessageListProps {
  messages: Message[];
  isTyping?: boolean;
}

export function MessageList({ messages, isTyping }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Scroll to bottom where newest messages appear
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <HackerBackground />
      {/* Thumbnail in bottom left - fixed position above message input */}
      <div className="absolute bottom-0 left-0 z-20 pointer-events-none pb-2 pl-2 sm:pb-3 sm:pl-3 md:pb-4 md:pl-4">
        <img 
          src={ddThumbnail} 
          alt="Daredevil" 
          className="w-[120px] h-[120px] sm:w-[160px] sm:h-[160px] md:w-[200px] md:h-[200px] lg:w-[240px] lg:h-[240px] object-contain border-2 border-white"
        />
      </div>
      <ScrollArea className={cn("relative z-10 flex-1 p-4 h-full")}>
        <div className="flex flex-col gap-2 min-h-full justify-end">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          {/* Spacer at bottom to prevent collision with image - accounts for image height + padding */}
          {/* Image is up to 240px tall at lg breakpoint, plus padding */}
          <div className="h-[120px] sm:h-[160px] md:h-[200px] lg:h-[240px] flex-shrink-0" />
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
