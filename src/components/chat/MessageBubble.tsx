import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/utils/cn';
import type { Message } from '@/types';
import daredevilIcon from '@assets/daredevil png.png';

export interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  // For prediction messages, use displayText from metadata instead of actual text
  // Also detect prediction messages by content pattern (in case metadata is missing)
  const displayText = message.metadata?.displayText as string | undefined;
  const isPredictionMessage = message.metadata?.isPredictionMessage === true;
  
  // Detect prediction messages by content pattern (backend might return without metadata)
  const isPredictionByContent = isUser && (
    message.text.includes('PREDICTION REQUEST - PART 1/3') ||
    message.text.includes('PREDICTION REQUEST - PART 2/3') ||
    message.text.includes('PREDICTION REQUEST - PART 3/3')
  );
  
  // Determine text to display
  let textToDisplay = message.text;
  if (isPredictionMessage && displayText) {
    // Use displayText from metadata
    textToDisplay = displayText;
  } else if (isPredictionByContent) {
    // Detect Part 1 by content and show friendly message
    if (message.text.includes('PART 1/3')) {
      textToDisplay = "Winner winner, chicken dinner!";
    } else {
      // Parts 2 and 3 should not be displayed at all - but if they are, hide them
      // This shouldn't happen, but as a fallback, show nothing
      textToDisplay = "";
    }
  }

  // Don't render Parts 2/3 at all (they should be hidden)
  if (isPredictionByContent && !textToDisplay) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2 border-2',
          isUser
            ? 'bg-blue-500/50 text-white border-white'
            : 'bg-red-500/50 text-white border-pink-500'
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <img 
              src={daredevilIcon} 
              alt="Daredevil" 
              className="w-6 h-6 rounded-full object-cover"
            />
            <span className="text-sm font-semibold text-white">Agent Daredevil:</span>
          </div>
        )}
        {textToDisplay && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {textToDisplay}
            </ReactMarkdown>
          </div>
        )}
        <div
          className={cn(
            'text-xs mt-1 opacity-70 text-white',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {format(new Date(message.createdAt), 'HH:mm')}
        </div>
      </div>
    </div>
  );
}
