import { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ThoughtStream } from './ThoughtStream';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { HackerBackground } from '@/registry/eldoraui/hacker-background';
import { cn } from '@/utils/cn';
import type { Message, PredictionThought } from '@/types';
import { MarketButton } from '@/components/match-panel/MarketButton';
import ddThumbnail from '@assets/dd-idl1.gif';
import ddThinking from '@assets/dd thinking.gif';

export interface MessageListProps {
  messages: Message[];
  onPredictClick?: () => void;
  isPredicting?: boolean;
  isSending?: boolean;
  isWaitingForResponse?: boolean;
  predictionThoughts?: PredictionThought[];
  predictionProgress?: number;
  predictionPhase?: 1 | 2 | 3 | null;
  sessionId?: string | null;
}

export function MessageList({ 
  messages, 
  onPredictClick,
  isPredicting = false,
  isSending = false,
  isWaitingForResponse = false,
  predictionThoughts = [],
  predictionProgress = 0,
  predictionPhase = null,
  sessionId = null,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isImageVisible, setIsImageVisible] = useState(true);

  const isAtBottom = (element: HTMLElement, threshold = 100): boolean => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    return scrollHeight - scrollTop - clientHeight < threshold;
  };

  useEffect(() => {
    const scrollElement = scrollAreaRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      setIsImageVisible(isAtBottom(scrollElement));
    };

    scrollElement.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const timer = setTimeout(() => {
      const scrollElement = scrollAreaRef.current;
      if (scrollElement && isAtBottom(scrollElement)) {
        setIsImageVisible(true);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isPredicting]);

  return (
    <div className="relative flex-1 h-full overflow-hidden" style={{ backgroundColor: '#1500FF' }}>
      <HackerBackground color="#1500FF" />
      <div className={cn(
        "absolute bottom-0 left-0 z-20 pb-2 pl-2 sm:pb-3 sm:pl-3 md:pb-4 md:pl-4",
        "flex items-end gap-3",
        "transition-opacity duration-300 ease-in-out",
        isImageVisible ? "opacity-100" : "opacity-0"
      )}>
        <div className="pointer-events-none relative w-[120px] h-[120px] sm:w-[160px] sm:h-[160px] md:w-[200px] md:h-[200px] lg:w-[240px] lg:h-[240px]">
          {/* Idle image */}
          <img 
            src={ddThumbnail} 
            alt="Daredevil" 
            className={cn(
              "absolute inset-0 w-full h-full object-contain",
              "transition-opacity duration-300 ease-in-out",
              (isPredicting || isSending || isWaitingForResponse) ? "opacity-0" : "opacity-100"
            )}
          />
          {/* Thinking image */}
          <img 
            src={ddThinking} 
            alt="Daredevil Thinking" 
            className={cn(
              "absolute inset-0 w-full h-full object-contain",
              "transition-opacity duration-300 ease-in-out",
              (isPredicting || isSending || isWaitingForResponse) ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
        
        <div className="pointer-events-auto mb-4 sm:mb-6 md:mb-8">
          <MarketButton
            name={isPredicting ? 'ANALYZING...' : 'PREDICT NOW'}
            percentage={isPredicting && predictionProgress > 0 ? `${Math.round(predictionProgress)}%` : ''}
            odds=""
            isHigher={true}
            onClick={onPredictClick}
            disabled={isPredicting || !onPredictClick || !sessionId}
            variant="gold"
            size="small"
          />
        </div>
      </div>
      <ScrollArea ref={scrollAreaRef} className={cn("relative z-10 flex-1 p-4 h-full")}>
        <div className="flex flex-col gap-2 min-h-full justify-end">
          {messages
            .filter((message) => {
              // Filter out Parts 2/3 of prediction messages (they should be completely hidden)
              if (message.role === 'user' && message.metadata?.isPredictionMessage) {
                const displayText = message.metadata.displayText as string | undefined;
                // If displayText is empty, it's Part 2/3 - hide it
                if (!displayText || displayText.trim() === '') {
                  return false;
                }
              }
              // Also filter by content pattern as fallback
              if (message.role === 'user' && (
                message.text.includes('PREDICTION REQUEST - PART 2/3') ||
                message.text.includes('PREDICTION REQUEST - PART 3/3')
              )) {
                return false;
              }
              return true;
            })
            .map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          
          {predictionThoughts.length > 0 && (
            <div className="my-3">
              <ThoughtStream
                thoughts={predictionThoughts}
                isStreaming={isPredicting}
                progress={predictionProgress}
                currentPhase={predictionPhase}
              />
            </div>
          )}
          
          <div className="h-[120px] sm:h-[160px] md:h-[200px] lg:h-[240px] flex-shrink-0" />
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
