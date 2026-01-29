import { useCallback, useState } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChat } from '@/hooks/useChat';
import { usePrediction } from '@/hooks/usePrediction';
import { usePredictionData, buildComprehensivePredictionMessage } from '@/hooks/usePredictionData';
import { sendMessageWithStreaming } from '@/services/api/messages';
import { getUserId } from '@/utils/storage';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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
  const { messages, sendMessage, isSending, error } = useChat({
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
    addRealThought,
    reset: resetPrediction,
  } = usePrediction();

  const userId = getUserId();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handlePredictClick = useCallback(() => {
    if (isPredicting || isSending) return;
    setShowConfirmDialog(true);
  }, [isPredicting, isSending]);

  const handleConfirmPrediction = useCallback(async () => {
    if (isPredicting || isSending || !sessionId) return;
    
    setShowConfirmDialog(false);
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
    
    // Start UI animation immediately for visual feedback
    startThoughts();
    
    // Send prediction message via SSE streaming to get real thought events
    try {
      await sendMessageWithStreaming(
        sessionId,
        { text: predictionMessage, userId },
        {
          onThought: (thoughtEvent) => {
            // Add real thought from backend to prediction display
            addRealThought(thoughtEvent);
          },
          onChunk: (chunkEvent) => {
            // Handle streaming response chunks if needed
            // For now, we'll let the regular message handling take care of this
          },
          onMessage: (messageEvent) => {
            // Final message received - prediction complete
            resetPrediction();
          },
          onError: (error) => {
            console.error('[ChatContainer] Prediction SSE error:', error);
            resetPrediction();
          },
          onDone: () => {
            resetPrediction();
          },
        }
      );
    } catch (error) {
      console.error('[ChatContainer] Failed to send prediction:', error);
      resetPrediction();
    }
  }, [isPredicting, isSending, sessionId, predictionData, resetPrediction, startThoughts, addRealThought, userId]);

  const handleCloseDialog = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);


  return (
    <div className={cn('flex flex-col h-full relative', className)}>
      <div className="flex-1 overflow-hidden">
        <MessageList 
          messages={messages} 
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
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmPrediction}
        title="Disclaimer"
        message="Agent Daredevil's predictions are for educational purposes only. He is not liable for any losses. ever."
        confirmText="I agree"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}
