/**
 * Match Status Badge Component
 * Displays the current status of a match (LIVE, UPCOMING, FINAL, etc.)
 */

import { cn } from '@/utils/cn';
import type { NBAGameStatus } from '@/types';
import { getGameStatusLabel, isGameLive, isGameComplete, isGameScheduled } from '@/types';

interface MatchStatusBadgeProps {
  status: NBAGameStatus;
  className?: string;
}

export function MatchStatusBadge({ status, className }: MatchStatusBadgeProps) {
  const label = getGameStatusLabel(status);
  const isLive = isGameLive(status);
  const isComplete = isGameComplete(status);
  const isScheduled = isGameScheduled(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide',
        isLive && 'bg-red-500/20 text-red-400 animate-pulse',
        isComplete && 'bg-muted text-muted-foreground',
        isScheduled && 'bg-blue-500/20 text-blue-400',
        !isLive && !isComplete && !isScheduled && 'bg-yellow-500/20 text-yellow-400',
        className
      )}
    >
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}
      {label}
    </span>
  );
}
