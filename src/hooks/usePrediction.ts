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
  currentPhase: 1 | 2 | 3 | null;
  startThoughts: () => void;
  addRealThought: (thought: SSEThoughtEvent) => void;
  reset: () => void;
  cancel: () => void;
}

const INITIAL_STATE: Omit<PredictionState, 'prediction' | 'error' | 'predictionId'> & { currentPhase: 1 | 2 | 3 | null } = {
  thoughts: [],
  isStreaming: false,
  progress: 0,
  currentPhase: null,
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


export function usePrediction(): UsePredictionReturn {
  const [state, setState] = useState(INITIAL_STATE);
  const thoughtTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRealThoughtsRef = useRef(false);
  const uiAnimationStartedRef = useRef(false);
  const currentPhaseRef = useRef<1 | 2 | 3 | null>(null);

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
    currentPhaseRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const cancel = reset;

  const startThoughts = useCallback(() => {
    thoughtTimeoutsRef.current.forEach(clearTimeout);
    thoughtTimeoutsRef.current = [];
    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    hasRealThoughtsRef.current = false;
    uiAnimationStartedRef.current = true;

    setState({
      thoughts: [{
        id: generateUUID(),
        type: 'analyzing',
        content: 'Starting prediction analysis...',
        timestamp: Date.now(),
        progress: 5,
      }],
      isStreaming: true,
      progress: 5,
    });

    UI_ANIMATION_THOUGHTS.forEach((thoughtData, index) => {
      const timeout = setTimeout(() => {
        setState((prev) => {
          if (hasRealThoughtsRef.current) return prev;
          const progress = Math.min(100, ((index + 1) / UI_ANIMATION_THOUGHTS.length) * 100);
          return {
            ...prev,
            thoughts: [...prev.thoughts, {
              id: generateUUID(),
              type: thoughtData.type,
              content: thoughtData.content,
              timestamp: Date.now(),
              progress,
            }],
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

    const isFirstRealThought = !hasRealThoughtsRef.current;
    hasRealThoughtsRef.current = true;

    // Update current phase if provided
    if (thoughtEvent.phase) {
      currentPhaseRef.current = thoughtEvent.phase;
    }

    const thoughtLower = thoughtEvent.thought.toLowerCase();
    let type: ThoughtPhase = 'reasoning';
    
    // Infer phase from content if not provided
    let phase: 1 | 2 | 3 | undefined = thoughtEvent.phase;
    if (!phase) {
      if (thoughtLower.includes('phase 1') || thoughtLower.includes('sportdata') || thoughtLower.includes('market analysis') || thoughtLower.includes('analyzing data')) {
        phase = 1;
        currentPhaseRef.current = 1;
      } else if (thoughtLower.includes('phase 2') || thoughtLower.includes('reasoning') || thoughtLower.includes('winner prediction') || thoughtLower.includes('intelligent reasoning')) {
        phase = 2;
        currentPhaseRef.current = 2;
      } else if (thoughtLower.includes('phase 3') || thoughtLower.includes('bet recommendation') || thoughtLower.includes('betting recommendation') || thoughtLower.includes('recommendation')) {
        phase = 3;
        currentPhaseRef.current = 3;
      } else if (currentPhaseRef.current) {
        // Use current phase if we're already in one
        phase = currentPhaseRef.current;
      }
    }
    
    if (thoughtLower.includes('analyzing') || thoughtLower.includes('examining')) {
      type = 'analyzing';
    } else if (thoughtLower.includes('calculating') || thoughtLower.includes('computing')) {
      type = 'calculating';
    } else if (thoughtLower.includes('insight') || thoughtLower.includes('key factor')) {
      type = 'insight';
    } else if (thoughtLower.includes('conclusion') || thoughtLower.includes('final')) {
      type = 'concluding';
    }

    // Calculate progress based on phase
    let progress = thoughtEvent.progress;
    if (!progress && phase) {
      // Phase 1: 0-33%, Phase 2: 33-66%, Phase 3: 66-100%
      const phaseProgress = phase === 1 ? 33 : phase === 2 ? 66 : 100;
      progress = phaseProgress;
    }

    const thought: PredictionThought = {
      id: generateUUID(),
      type,
      content: thoughtEvent.thought,
      timestamp: Date.now(),
      progress,
      phase,
    };

    setState((prev) => ({
      ...prev,
      thoughts: (isFirstRealThought && prev.thoughts.length > 0) ? [thought] : [...prev.thoughts, thought],
      progress: progress || prev.progress,
      currentPhase: phase || currentPhaseRef.current || prev.currentPhase,
    }));
  }, []);

  return {
    thoughts: state.thoughts,
    isStreaming: state.isStreaming,
    progress: state.progress,
    currentPhase: state.currentPhase,
    startThoughts,
    addRealThought,
    reset,
    cancel,
  };
}
