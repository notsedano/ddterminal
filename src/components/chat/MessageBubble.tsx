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
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.text}
          </ReactMarkdown>
        </div>
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
