/**
 * Live Stats Component
 * Displays live game clock, quarter, and score
 */

import { cn } from '@/utils/cn';
import type { MatchPanelGame } from '@/types';
import { formatGameClock, isGameLive, isGameComplete, isGameScheduled } from '@/types';
import { formatTimeUntilGame } from '@/services/api/sportradar';
import { format } from 'date-fns';
import { Clock, Calendar } from 'lucide-react';

interface LiveStatsProps {
  game: MatchPanelGame;
  className?: string;
}

export function LiveStats({ game, className }: LiveStatsProps) {
  const isLive = isGameLive(game.status);
  const isScheduled = isGameScheduled(game.status);
  const isComplete = isGameComplete(game.status);
  const hasScore = game.home.score > 0 || game.away.score > 0;
  const now = new Date();
  const isUpcoming = isScheduled && game.scheduledTime > now;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {/* Game Clock (for live games) */}
      {isLive && game.clock && (
        <div className="text-sm font-mono text-muted-foreground">
          {formatGameClock(game.clock.quarter, game.clock.time)}
        </div>
      )}

      {/* Time Until Game (for upcoming games) */}
      {isUpcoming && (
        <div className="flex items-center gap-1.5 text-sm text-blue-400">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">{formatTimeUntilGame(game.scheduledTime)}</span>
        </div>
      )}

      {/* Score Display */}
      <div className="flex items-center justify-center gap-4">
        {/* Away Team Score */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {game.away.team.alias}
          </span>
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            hasScore ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {hasScore ? game.away.score : '-'}
          </span>
          {game.away.record && (
            <span className="text-[10px] text-muted-foreground">
              {game.away.record.wins}-{game.away.record.losses}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="flex flex-col items-center">
          <span className="text-lg text-muted-foreground">-</span>
        </div>

        {/* Home Team Score */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {game.home.team.alias}
          </span>
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            hasScore ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {hasScore ? game.home.score : '-'}
          </span>
          {game.home.record && (
            <span className="text-[10px] text-muted-foreground">
              {game.home.record.wins}-{game.home.record.losses}
            </span>
          )}
        </div>
      </div>

      {/* Scheduled Time (for scheduled games) */}
      {isScheduled && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{format(game.scheduledTime, 'h:mm a')}</span>
        </div>
      )}

      {/* Final indicator for completed games */}
      {isComplete && (
        <div className="text-xs text-muted-foreground font-medium">
          FINAL
        </div>
      )}

      {/* Venue (if available) */}
      {game.venue && (
        <div className="text-[10px] text-muted-foreground/70 text-center max-w-[200px] truncate">
          {game.venue.name}
        </div>
      )}
    </div>
  );
}

/**
 * Compact version of LiveStats for smaller displays
 */
interface CompactLiveStatsProps {
  game: MatchPanelGame;
  className?: string;
}

export function CompactLiveStats({ game, className }: CompactLiveStatsProps) {
  const isLive = isGameLive(game.status);
  const hasScore = game.home.score > 0 || game.away.score > 0;

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      {/* Away */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{game.away.team.alias}</span>
        <span className={cn(
          'text-lg font-bold tabular-nums',
          hasScore ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {hasScore ? game.away.score : '-'}
        </span>
      </div>

      {/* Clock/Status */}
      <div className="flex flex-col items-center">
        {isLive && game.clock ? (
          <span className="text-xs font-mono text-muted-foreground">
            {formatGameClock(game.clock.quarter, game.clock.time)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {game.status === 'scheduled' ? format(game.scheduledTime, 'h:mm a') : game.status}
          </span>
        )}
      </div>

      {/* Home */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'text-lg font-bold tabular-nums',
          hasScore ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {hasScore ? game.home.score : '-'}
        </span>
        <span className="text-sm font-medium">{game.home.team.alias}</span>
      </div>
    </div>
  );
}
