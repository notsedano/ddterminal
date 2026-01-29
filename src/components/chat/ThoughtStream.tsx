import { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import type { PredictionThought, ThoughtPhase } from '@/types/prediction';
import { THOUGHT_PHASES } from '@/types/prediction';

export interface ThoughtStreamProps {
  thoughts: PredictionThought[];
  isStreaming: boolean;
  progress?: number;
  currentPhase?: 1 | 2 | 3 | null;
  className?: string;
}

function ThoughtBubble({ thought, index }: { thought: PredictionThought; index: number }) {
  const phase = THOUGHT_PHASES[thought.type as ThoughtPhase] || THOUGHT_PHASES.analyzing;
  
  const phaseLabels = {
    1: 'Phase 1: Sports Data & Market Analysis',
    2: 'Phase 2: Reasoning & Winner Prediction',
    3: 'Phase 3: Bet Recommendation',
  };
  
  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 rounded-lg bg-black/30 backdrop-blur-sm',
        'animate-in fade-in slide-in-from-left-2 duration-300',
        'border-l-2',
        thought.type === 'analyzing' && 'border-l-blue-400',
        thought.type === 'reasoning' && 'border-l-purple-400',
        thought.type === 'calculating' && 'border-l-green-400',
        thought.type === 'insight' && 'border-l-yellow-400',
        thought.type === 'concluding' && 'border-l-amber-400'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <span className="text-sm shrink-0">{phase.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-medium uppercase tracking-wide', phase.color)}>
            {phase.label}
          </span>
          {thought.phase && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
              {phaseLabels[thought.phase]}
            </span>
          )}
        </div>
        <p className="text-sm text-white/90 mt-0.5 leading-relaxed">
          {thought.content}
        </p>
      </div>
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-amber-400 font-medium">Generating prediction...</span>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-1 bg-black/30 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

export function ThoughtStream({ thoughts, isStreaming, progress = 0, currentPhase = null, className }: ThoughtStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  
  useEffect(() => {
    if (containerRef.current && thoughts.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thoughts]);

  if (!isStreaming && thoughts.length === 0) {
    return null;
  }

  const phaseLabels = {
    1: 'Phase 1: Sports Data & Market Analysis',
    2: 'Phase 2: Reasoning & Winner Prediction',
    3: 'Phase 3: Bet Recommendation',
  };

  // Calculate phase-based progress
  let displayProgress = progress;
  if (currentPhase && !progress) {
    // Phase 1: 0-33%, Phase 2: 33-66%, Phase 3: 66-100%
    displayProgress = currentPhase === 1 ? 33 : currentPhase === 2 ? 66 : 100;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-black/40 backdrop-blur-md',
        'shadow-lg shadow-amber-500/10',
        'overflow-hidden transition-all duration-300',
        className
      )}
      >
      <div 
        className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-lg">🧠</span>
          <span className="text-sm font-semibold text-amber-300">Agent Thought Process</span>
          {currentPhase && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500/30 text-amber-200 rounded-full font-medium">
              {phaseLabels[currentPhase]}
            </span>
          )}
          {isStreaming && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full animate-pulse">
              LIVE
            </span>
          )}
        </div>
        <button
          className="text-amber-400/70 hover:text-amber-400 transition-colors"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={cn('w-4 h-4 transition-transform', isExpanded ? 'rotate-180' : '')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isStreaming && displayProgress > 0 && (
        <div className="px-3 py-1">
          <ProgressBar progress={displayProgress} />
          {currentPhase && (
            <div className="flex items-center justify-between mt-1 text-xs text-amber-400/70">
              <span>{phaseLabels[currentPhase]}</span>
              <span>{Math.round(displayProgress)}%</span>
            </div>
          )}
        </div>
      )}

      {isExpanded && (
        <div
          ref={containerRef}
          className="max-h-[300px] overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-track-black/20 scrollbar-thumb-amber-500/30"
        >
          {thoughts.map((thought, index) => (
            <ThoughtBubble key={thought.id} thought={thought} index={index} />
          ))}
          
          {isStreaming && <StreamingIndicator />}
        </div>
      )}

      {!isExpanded && thoughts.length > 0 && (
        <div className="px-3 py-2 text-xs text-amber-400/70">
          {thoughts.length} thought{thoughts.length !== 1 ? 's' : ''} processed
          {isStreaming && ' • Still thinking...'}
        </div>
      )}
    </div>
  );
}
