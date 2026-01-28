import { useCallback } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChat } from '@/hooks/useChat';
import { usePrediction } from '@/hooks/usePrediction';
import { usePredictionData, buildComprehensivePredictionMessage } from '@/hooks/usePredictionData';
import { cn } from '@/utils/cn';

export interface ChatContainerProps {
  sessionId: string | null;
  agentId: string;
  roomId: string;
  className?: string;
  onSessionInvalid?: (sessionId: string) => void;
  showMessageInput?: boolean;
}

export function ChatContainer({ 
  sessionId, 
  agentId, 
  roomId, 
  className, 
  onSessionInvalid, 
  showMessageInput = true,
}: ChatContainerProps) {
  const { messages, sendMessage, isSending, isConnected, isTyping, error } = useChat({
    sessionId,
    agentId,
    roomId,
    onSessionInvalid,
  });

  // Get comprehensive prediction data from all sources
  const predictionData = usePredictionData();

  const {
    thoughts: predictionThoughts,
    isStreaming: isPredicting,
    progress: predictionProgress,
    startThoughts,
    reset: resetPrediction,
  } = usePrediction();

  const handlePredictClick = useCallback(() => {
    if (isPredicting || isSending) return;
    
    resetPrediction();
    
    // Build comprehensive prediction message with all available data:
    // - Matchup info (teams, records, scheduled time)
    // - Market data (Polymarket odds, volume, lines)
    // - Live scores (if game is in progress)
    // - Betting indicators (rest days, back-to-back, streaks, last 10, H2H)
    // - Betting signals (sharp action, public money, fatigue)
    // - Injury report (all injured players with status)
    // - Player stats (top scorers, hot hand players)
    // - Match history (recent form, home/away records)
    // - Standings context (conference rank, point differential)
    const predictionMessage = buildComprehensivePredictionMessage(predictionData);
    
    startThoughts();
    sendMessage(predictionMessage);
  }, [isPredicting, isSending, predictionData, resetPrediction, startThoughts, sendMessage]);


  return (
    <div className={cn('flex flex-col h-full relative', className)}>
      <div className="flex-1 overflow-hidden">
        <MessageList 
          messages={messages} 
          isTyping={isTyping}
          onPredictClick={handlePredictClick}
          isPredicting={isPredicting}
          predictionThoughts={predictionThoughts}
          predictionProgress={predictionProgress}
        />
      </div>
      {showMessageInput && (
        <MessageInput
          onSend={sendMessage}
          disabled={isSending}
          placeholder={isSending ? 'Sending...' : 'Type a message...'}
        />
      )}
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
