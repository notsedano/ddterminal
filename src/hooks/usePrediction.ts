import { useState, useCallback, useRef, useEffect } from 'react';
import { generateUUID } from '@/utils/uuid';
import type {
  PredictionThought,
  PredictionState,
  ThoughtPhase,
} from '@/types/prediction';

export interface UsePredictionReturn {
  thoughts: PredictionThought[];
  isStreaming: boolean;
  progress: number;
  startThoughts: () => void;
  reset: () => void;
  cancel: () => void;
}

const INITIAL_STATE: Omit<PredictionState, 'prediction' | 'error' | 'predictionId'> = {
  thoughts: [],
  isStreaming: false,
  progress: 0,
};

const UI_ANIMATION_THOUGHTS: { type: ThoughtPhase; content: string; delay: number }[] = [
  { type: 'analyzing', content: 'Analyzing matchup data and team statistics...', delay: 300 },
  { type: 'analyzing', content: 'Examining recent performance trends...', delay: 1000 },
  { type: 'reasoning', content: 'Evaluating head-to-head history...', delay: 1800 },
  { type: 'calculating', content: 'Computing probability models...', delay: 2800 },
  { type: 'insight', content: 'Identifying key factors and edge cases...', delay: 3800 },
  { type: 'reasoning', content: 'Weighing market sentiment and lines...', delay: 4800 },
  { type: 'calculating', content: 'Finalizing confidence intervals...', delay: 5800 },
  { type: 'concluding', content: 'Prediction sent! Awaiting response...', delay: 6800 },
];

function createThought(type: ThoughtPhase, content: string, progress: number): PredictionThought {
  return {
    id: generateUUID(),
    type,
    content,
    timestamp: Date.now(),
    progress,
  };
}

export function usePrediction(): UsePredictionReturn {
  const [state, setState] = useState(INITIAL_STATE);
  const thoughtTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      thoughtTimeoutsRef.current.forEach(clearTimeout);
      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    thoughtTimeoutsRef.current.forEach(clearTimeout);
    thoughtTimeoutsRef.current = [];
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  const startThoughts = useCallback(() => {
    thoughtTimeoutsRef.current.forEach(clearTimeout);
    thoughtTimeoutsRef.current = [];
    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    setState({
      thoughts: [createThought('analyzing', 'Starting prediction analysis...', 5)],
      isStreaming: true,
      progress: 5,
    });

    UI_ANIMATION_THOUGHTS.forEach((thoughtData, index) => {
      const timeout = setTimeout(() => {
        const progress = Math.min(100, ((index + 1) / UI_ANIMATION_THOUGHTS.length) * 100);
        const thought = createThought(thoughtData.type, thoughtData.content, progress);
        setState((prev) => ({
          ...prev,
          thoughts: [...prev.thoughts, thought],
          progress,
        }));
      }, thoughtData.delay);
      thoughtTimeoutsRef.current.push(timeout);
    });

    completionTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        progress: 100,
      }));
    }, 7200);

    hideTimeoutRef.current = setTimeout(() => {
      setState(INITIAL_STATE);
    }, 12000);
  }, []);

  return {
    thoughts: state.thoughts,
    isStreaming: state.isStreaming,
    progress: state.progress,
    startThoughts,
    reset,
    cancel,
  };
}
