import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChat } from '@/hooks/useChat';
import { usePrediction } from '@/hooks/usePrediction';
import { usePredictionData, buildSportsDataMessage, buildMarketDataMessage, buildOtherInfoMessage } from '@/hooks/usePredictionData';
import { SessionNotFoundError } from '@/services/api/client';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/utils/cn';
import { sanitizeMetadata, extractErrorMessage } from '@/utils/messageUtils';

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
  const predictionData = usePredictionData();

  const {
    thoughts: predictionThoughts,
    isStreaming: isPredicting,
    progress: predictionProgress,
    currentPhase: predictionPhase,
    startThoughts,
    addRealThought,
    reset: resetPrediction,
  } = usePrediction();

  const { messages, sendMessage, sendMessageWithDisplayText, isSending, isWaitingForResponse, error } = useChat({
    sessionId,
    agentId,
    roomId,
    onSessionInvalid,
    onThought: addRealThought,
  });

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [sendingPart, setSendingPart] = useState<number | null>(null);
  const cancelledRef = useRef(false);

  const canPredict = !isPredicting && !isSending && !sendingPart && !!sessionId;

  const predictionMetadata = useMemo(() => {
    if (!predictionData) {
      return { action: 'predict' as const, context: {} };
    }

    // Create a clean metadata object with only primitive values and simple objects
    // This ensures no circular references are included
    const metadata = {
      action: 'predict' as const,
      context: {
        matchup: {
          gameId: String(predictionData.gameId),
          homeTeamId: String(predictionData.homeTeam.teamId),
          awayTeamId: String(predictionData.awayTeam.teamId),
          homeTeamAbbr: String(predictionData.homeTeam.abbreviation),
          awayTeamAbbr: String(predictionData.awayTeam.abbreviation),
          scheduledTime: String(predictionData.scheduledTime),
          sport: String(predictionData.sport),
          isLive: Boolean(predictionData.isLive),
        },
        dataAvailable: {
          hasMarketData: Boolean(predictionData.market),
          hasBettingMarkets: Boolean(predictionData.bettingMarkets?.hasMarkets),
          hasInjuries: Boolean(predictionData.injuries.home.length > 0 || predictionData.injuries.away.length > 0),
          hasBettingIndicators: Boolean(predictionData.bettingIndicators),
          hasPlayerStats: Boolean(predictionData.playerStats.homeTopScorer || predictionData.playerStats.awayTopScorer),
          hasMatchHistory: Boolean(predictionData.matchHistory.homeHistory || predictionData.matchHistory.awayHistory),
          hasScores: Boolean(predictionData.scores),
        },
      },
    };
    
    // Ensure the metadata is fully serializable
    return sanitizeMetadata(metadata) as typeof metadata;
  }, [predictionData]);

  // Calculate metadata size - metadata is already sanitized by sanitizeMetadata
  const metadataSizeBytes = useMemo(() => {
    try {
      const jsonString = JSON.stringify(predictionMetadata);
      return new Blob([jsonString]).size;
    } catch {
      // If serialization fails (shouldn't happen since metadata is sanitized), use conservative estimate
      return 5000;
    }
  }, [predictionMetadata]);

  const isMetadataTooLarge = metadataSizeBytes > 10240;

  const MAX_CONTENT_LENGTH_PER_PART = 4000;
  const part1Length = useMemo(() => 
    predictionData ? buildSportsDataMessage(predictionData).length : 0
  , [predictionData]);
  const part2Length = useMemo(() => 
    predictionData ? buildMarketDataMessage(predictionData).length : 0
  , [predictionData]);
  const part3Length = useMemo(() => 
    predictionData ? buildOtherInfoMessage(predictionData).length : 0
  , [predictionData]);

  const isPart1TooLong = part1Length > MAX_CONTENT_LENGTH_PER_PART;
  const isPart2TooLong = part2Length > MAX_CONTENT_LENGTH_PER_PART;
  const isPart3TooLong = part3Length > MAX_CONTENT_LENGTH_PER_PART;
  const isContentTooLong = isPart1TooLong || isPart2TooLong || isPart3TooLong;

  const handlePredictClick = useCallback(() => {
    if (!canPredict) {
      if (!sessionId) {
        setPredictionError('No active session. Please create a new session first.');
      }
      return;
    }
    setPredictionError(null);
    setShowConfirmDialog(true);
  }, [canPredict, sessionId]);

  const handlePredictionError = useCallback((error: unknown) => {
    const errorMessage = extractErrorMessage(error);
    
    // Handle specific error types
    if (error instanceof SessionNotFoundError || 
        errorMessage.includes('Session') && errorMessage.includes('not found') ||
        errorMessage.includes('SESSION_NOT_FOUND')) {
      onSessionInvalid?.(sessionId!);
      setPredictionError('Session expired. Please create a new session.');
    } else if (errorMessage.includes('Metadata exceeds') || errorMessage.includes('maximum size')) {
      setPredictionError('Prediction metadata is too large. Please try again with a different match.');
    } else if (errorMessage.includes('Content exceeds') || errorMessage.includes('maximum length') || errorMessage.includes('characters')) {
      const partInfo = sendingPart ? ` (Part ${sendingPart})` : '';
      const lengthInfo = sendingPart === 1 ? part1Length : sendingPart === 2 ? part2Length : sendingPart === 3 ? part3Length : 0;
      setPredictionError(`Prediction content is too long${partInfo} (${lengthInfo} characters). Maximum allowed per part: ${MAX_CONTENT_LENGTH_PER_PART}.`);
    } else {
      setPredictionError(`Failed to send prediction${sendingPart ? ` (Part ${sendingPart})` : ''}: ${errorMessage}`);
    }
  }, [sessionId, onSessionInvalid, sendingPart, part1Length, part2Length, part3Length]);

  const handleConfirmPrediction = useCallback(async () => {
    if (!canPredict || !predictionData) return;
    
    setShowConfirmDialog(false);
    resetPrediction();
    setPredictionError(null);
    cancelledRef.current = false;
    
    if (isMetadataTooLarge) {
      setPredictionError(`Prediction metadata is too large (${metadataSizeBytes} bytes). Please try again.`);
      return;
    }

    if (isContentTooLong) {
      const parts = [];
      if (isPart1TooLong) parts.push(`Part 1: ${part1Length} chars`);
      if (isPart2TooLong) parts.push(`Part 2: ${part2Length} chars`);
      if (isPart3TooLong) parts.push(`Part 3: ${part3Length} chars`);
      setPredictionError(`Prediction content is too long. ${parts.join(', ')}. Maximum allowed per part: ${MAX_CONTENT_LENGTH_PER_PART}.`);
      return;
    }
    
    startThoughts();
    
    // Build the 3 message parts
    const part1Message = buildSportsDataMessage(predictionData);
    const part2Message = buildMarketDataMessage(predictionData);
    const part3Message = buildOtherInfoMessage(predictionData);
    
    // Validate messages aren't empty
    if (!part1Message.trim() || !part2Message.trim() || !part3Message.trim()) {
      setPredictionError('Failed to build prediction messages. Please try again.');
      return;
    }
    
    // Send Part 1 with friendly display message
    setSendingPart(1);
    const part1Metadata = sanitizeMetadata({
      ...predictionMetadata,
      partNumber: 1,
      totalParts: 3,
    }) as typeof predictionMetadata & { partNumber: number; totalParts: number };
    
    console.log('[ChatContainer] Sending Part 1/3:', {
      displayText: "Winner winner, chicken dinner!",
      actualLength: part1Message.length,
      // Only log safe properties to avoid circular reference issues
      hasMetadata: !!part1Metadata,
      partNumber: part1Metadata.partNumber,
    });
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    sendMessageWithDisplayText("Winner winner, chicken dinner!", part1Message, part1Metadata)
      .then(async () => {
        if (cancelledRef.current) return;
        
        console.log('[ChatContainer] Part 1/3 sent successfully, waiting before Part 2/3');
        await delay(500);
        
        if (cancelledRef.current) return;
        
        setSendingPart(2);
        const part2Metadata = sanitizeMetadata({
          ...predictionMetadata,
          partNumber: 2,
          totalParts: 3,
        }) as typeof predictionMetadata & { partNumber: number; totalParts: number };
        
        console.log('[ChatContainer] Sending Part 2/3:', {
          actualLength: part2Message.length,
          partNumber: part2Metadata.partNumber,
        });
        
        return sendMessageWithDisplayText("", part2Message, part2Metadata);
      })
      .then(async () => {
        if (cancelledRef.current) return;
        
        console.log('[ChatContainer] Part 2/3 sent successfully, waiting before Part 3/3');
        await delay(500);
        
        if (cancelledRef.current) return;
        
        setSendingPart(3);
        const part3Metadata = sanitizeMetadata({
          ...predictionMetadata,
          partNumber: 3,
          totalParts: 3,
        }) as typeof predictionMetadata & { partNumber: number; totalParts: number };
        
        console.log('[ChatContainer] Sending Part 3/3:', {
          actualLength: part3Message.length,
          partNumber: part3Metadata.partNumber,
        });
        
        return sendMessageWithDisplayText("", part3Message, part3Metadata);
      })
      .then(() => {
        if (cancelledRef.current) return;
        setSendingPart(null);
      })
      .catch((error) => {
        if (cancelledRef.current) return;
        setSendingPart(null);
        resetPrediction();
        handlePredictionError(error);
      });
  }, [canPredict, predictionData, predictionMetadata, metadataSizeBytes, isMetadataTooLarge, isContentTooLong, isPart1TooLong, isPart2TooLong, isPart3TooLong, part1Length, part2Length, part3Length, resetPrediction, startThoughts, sendMessageWithDisplayText, handlePredictionError]);

  const handleCloseDialog = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  useEffect(() => {
    const shouldReset = (!isWaitingForResponse && !isSending && isPredicting && !sendingPart) || (error && isPredicting);
    
    if (shouldReset) {
      const delay = error ? 0 : 2000;
      const timer = setTimeout(() => {
        resetPrediction();
        setSendingPart(null);
        cancelledRef.current = false;
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isWaitingForResponse, isSending, isPredicting, error, sendingPart, resetPrediction]);

  // Cancel multi-part sending if user starts a new prediction
  useEffect(() => {
    if (isPredicting && sendingPart) {
      cancelledRef.current = true;
      setSendingPart(null);
    }
  }, [isPredicting, sendingPart]);

  return (
    <div className={cn('flex flex-col h-full relative', className)}>
      <div className="flex-1 overflow-hidden">
        <MessageList 
          messages={messages} 
          onPredictClick={handlePredictClick}
          isPredicting={isPredicting}
          isSending={isSending}
          isWaitingForResponse={isWaitingForResponse}
          predictionThoughts={predictionThoughts}
          predictionProgress={predictionProgress}
          predictionPhase={predictionPhase}
          sessionId={sessionId}
        />
      </div>
      {showMessageInput && (
        <MessageInput
          onSend={sendMessage}
          disabled={isSending}
          placeholder={isSending ? 'Sending...' : 'Type a message...'}
        />
      )}
      {(error || predictionError) && (
        <div className="px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 text-sm text-center">
          {predictionError || error || ''}
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
