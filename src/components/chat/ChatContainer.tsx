import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChat } from '@/hooks/useChat';
import { cn } from '@/utils/cn';

export interface ChatContainerProps {
  sessionId: string | null;
  agentId: string;
  roomId: string;
  className?: string;
  onSessionInvalid?: (sessionId: string) => void;
}

export function ChatContainer({ sessionId, agentId, roomId, className, onSessionInvalid }: ChatContainerProps) {
  const { messages, sendMessage, isSending, isConnected, isTyping, error } = useChat({
    sessionId,
    agentId,
    roomId,
    onSessionInvalid,
  });

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isTyping={isTyping} />
      </div>
      <MessageInput
        onSend={sendMessage}
        disabled={isSending}
        placeholder={isSending ? 'Sending...' : 'Type a message...'}
      />
      {error && (
        <div className="px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 text-sm text-center">
          {error}
        </div>
      )}
      {!isConnected && !error && (
        <div className="px-4 py-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm text-center">
          Real-time updates unavailable. Messages sent via REST API.
        </div>
      )}
    </div>
  );
}
