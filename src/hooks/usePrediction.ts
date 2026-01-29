import { useState, useCallback, useRef, useEffect } from 'react';
import { generateUUID } from '@/utils/uuid';
import type {
  PredictionThought,
  PredictionState,
  ThoughtPhase,
} from '@/types/prediction';
import type { SSEThoughtEvent } from '@/services/api/messages';

export interface UsePredictionReturn {
  thoughts: PredictionThought[];
  isStreaming: boolean;
  progress: number;
  startThoughts: () => void;
  addRealThought: (thought: SSEThoughtEvent) => void;
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
  const hasRealThoughtsRef = useRef(false);
  const uiAnimationStartedRef = useRef(false);

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
    hasRealThoughtsRef.current = false;
    uiAnimationStartedRef.current = false;
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

    hasRealThoughtsRef.current = false;
    uiAnimationStartedRef.current = true;

    setState({
      thoughts: [createThought('analyzing', 'Starting prediction analysis...', 5)],
      isStreaming: true,
      progress: 5,
    });

    // Start UI animation as initial visual feedback
    UI_ANIMATION_THOUGHTS.forEach((thoughtData, index) => {
      const timeout = setTimeout(() => {
        // Only add UI animation thoughts if we haven't received real thoughts yet
        setState((prev) => {
          if (hasRealThoughtsRef.current) {
            // Real thoughts are coming in, don't add UI animation
            return prev;
          }
          const progress = Math.min(100, ((index + 1) / UI_ANIMATION_THOUGHTS.length) * 100);
          const thought = createThought(thoughtData.type, thoughtData.content, progress);
          return {
            ...prev,
            thoughts: [...prev.thoughts, thought],
            progress,
          };
        });
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

  const addRealThought = useCallback((thoughtEvent: SSEThoughtEvent) => {
    if (!thoughtEvent.thought) return;

    hasRealThoughtsRef.current = true;

    // Map SSE thought to PredictionThought format
    // Try to infer type from thought content or use 'reasoning' as default
    let type: ThoughtPhase = 'reasoning';
    const thoughtLower = thoughtEvent.thought.toLowerCase();
    if (thoughtLower.includes('analyzing') || thoughtLower.includes('examining')) {
      type = 'analyzing';
    } else if (thoughtLower.includes('calculating') || thoughtLower.includes('computing')) {
      type = 'calculating';
    } else if (thoughtLower.includes('insight') || thoughtLower.includes('key factor')) {
      type = 'insight';
    } else if (thoughtLower.includes('conclusion') || thoughtLower.includes('final')) {
      type = 'concluding';
    }

    const predictionThought: PredictionThought = {
      id: generateUUID(),
      type,
      content: thoughtEvent.thought,
      timestamp: Date.now(),
      progress: thoughtEvent.progress,
    };

    setState((prev) => {
      // If this is the first real thought, replace UI animation thoughts
      if (prev.thoughts.length > 0 && !hasRealThoughtsRef.current) {
        return {
          ...prev,
          thoughts: [predictionThought],
          progress: thoughtEvent.progress || prev.progress,
        };
      }
      // Otherwise append to existing thoughts
      return {
        ...prev,
        thoughts: [...prev.thoughts, predictionThought],
        progress: thoughtEvent.progress || prev.progress,
      };
    });
  }, []);

  return {
    thoughts: state.thoughts,
    isStreaming: state.isStreaming,
    progress: state.progress,
    startThoughts,
    addRealThought,
    reset,
    cancel,
  };
}
