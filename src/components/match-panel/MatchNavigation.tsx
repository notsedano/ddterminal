/**
 * Match Navigation Component
 * Provides < > buttons and dot indicators for navigating between matches
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface MatchNavigationProps {
  currentIndex: number;
  totalMatches: number;
  onPrevious: () => void;
  onNext: () => void;
  onDotClick?: (index: number) => void;
  liveIndices?: number[];
  upcomingIndices?: number[];
  className?: string;
}

export function MatchNavigation({
  currentIndex,
  totalMatches,
  onPrevious,
  onNext,
  onDotClick,
  liveIndices = [],
  upcomingIndices = [],
  className,
}: MatchNavigationProps) {
  if (totalMatches === 0) {
    return null;
  }

  const liveSet = new Set(liveIndices);
  const upcomingSet = new Set(upcomingIndices);

  // Helper to get dot color based on game state
  const getDotClasses = (index: number, isCurrent: boolean) => {
    const isLive = liveSet.has(index);
    const isUpcoming = upcomingSet.has(index);

    if (isCurrent) {
      if (isLive) return 'w-2.5 h-2.5 bg-red-500';
      if (isUpcoming) return 'w-2.5 h-2.5 bg-blue-500';
      return 'w-2.5 h-2.5 bg-primary';
    }

    if (isLive) return 'w-2 h-2 bg-red-500/50 hover:bg-red-500/70';
    if (isUpcoming) return 'w-2 h-2 bg-blue-500/40 hover:bg-blue-500/60';
    return 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50';
  };

  // Helper for accessibility label
  const getDotLabel = (index: number) => {
    const parts = [`Go to match ${index + 1}`];
    if (liveSet.has(index)) parts.push('(live)');
    else if (upcomingSet.has(index)) parts.push('(upcoming)');
    return parts.join(' ');
  };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {/* Navigation buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={totalMatches <= 1}
          className="h-8 w-8 rounded-full hover:bg-accent"
          aria-label="Previous match"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
          {currentIndex + 1} / {totalMatches}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={totalMatches <= 1}
          className="h-8 w-8 rounded-full hover:bg-accent"
          aria-label="Next match"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Dot indicators */}
      {totalMatches > 1 && totalMatches <= 10 && (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalMatches }, (_, index) => (
            <button
              key={index}
              onClick={() => onDotClick?.(index)}
              className={cn(
                'rounded-full transition-all duration-200',
                getDotClasses(index, index === currentIndex)
              )}
              aria-label={getDotLabel(index)}
            />
          ))}
        </div>
      )}

      {/* For more than 10 matches, show simpler indicator */}
      {totalMatches > 10 && (
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {Array.from({ length: Math.min(3, currentIndex) }, (_, i) => (
              <span key={`before-${i}`} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 mx-0.5" />
            ))}
            {currentIndex > 3 && <span className="text-muted-foreground/50 text-[10px] mx-1">...</span>}
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <div className="flex items-center">
            {currentIndex < totalMatches - 4 && <span className="text-muted-foreground/50 text-[10px] mx-1">...</span>}
            {Array.from({ length: Math.min(3, totalMatches - currentIndex - 1) }, (_, i) => (
              <span key={`after-${i}`} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 mx-0.5" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
