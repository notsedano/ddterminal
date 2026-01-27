/**
 * Streak Indicator Component
 * Baccarat-style road visualization for win/loss patterns
 */

import { memo, useMemo } from 'react';
import { cn } from '@/utils/cn';
import type { MatchResult, TeamMatchHistory } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

interface StreakIndicatorProps {
  history: TeamMatchHistory;
  teamAlias: string;
  isHome?: boolean;
  showLabel?: boolean;
  maxGames?: number;
  className?: string;
}

/**
 * Single game result dot
 */
const ResultDot = memo(function ResultDot({ 
  result, 
  isCurrentStreak,
  game,
}: { 
  result: 'W' | 'L';
  isCurrentStreak: boolean;
  game: MatchResult;
}) {
  const isWin = result === 'W';
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold transition-all cursor-pointer',
              isWin ? 'bg-green-500/80 text-green-100' : 'bg-red-500/80 text-red-100',
              isCurrentStreak && 'ring-2 ring-offset-1 ring-offset-background',
              isCurrentStreak && isWin && 'ring-green-400 shadow-lg shadow-green-500/30',
              isCurrentStreak && !isWin && 'ring-red-400 shadow-lg shadow-red-500/30',
            )}
          >
            {result}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">
              {game.isHome ? 'vs' : '@'} {game.opponent.alias}
            </span>
            <span className={cn(isWin ? 'text-green-400' : 'text-red-400')}>
              {game.teamScore} - {game.opponentScore}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {format(new Date(game.date), 'MMM d')}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

/**
 * Streak Road - Horizontal baccarat-style pattern
 */
export const StreakRoad = memo(function StreakRoad({ 
  history, 
  teamAlias,
  isHome = true,
  showLabel = true,
  maxGames = 10,
  className,
}: StreakIndicatorProps) {
  // Get games in reverse chronological order (most recent first when displayed)
  const displayGames = useMemo(() => {
    return history.lastNGames.slice(0, maxGames).reverse();
  }, [history.lastNGames, maxGames]);

  const streakLabel = `${history.streakType}${history.streakCount}`;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Team Label */}
      {showLabel && (
        <div className="flex items-center gap-1.5 min-w-[60px]">
          <span className={cn(
            'text-xs font-medium',
            isHome ? 'text-green-400' : 'text-red-400'
          )}>
            {teamAlias}
          </span>
        </div>
      )}

      {/* Win/Loss Road */}
      <div className="flex items-center gap-0.5">
        {displayGames.map((game, index) => {
          const isCurrentStreak = index >= displayGames.length - history.streakCount;
          return (
            <ResultDot
              key={game.gameId}
              result={game.result}
              isCurrentStreak={isCurrentStreak}
              game={game}
            />
          );
        })}
      </div>

      {/* Current Streak Badge */}
      <div className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-bold',
        history.streakType === 'W' 
          ? 'bg-green-500/20 text-green-400' 
          : 'bg-red-500/20 text-red-400'
      )}>
        {streakLabel}
      </div>
    </div>
  );
});

/**
 * Compact streak indicator for tight spaces
 */
export const CompactStreak = memo(function CompactStreak({
  history,
  className,
}: {
  history: TeamMatchHistory;
  className?: string;
}) {

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* Mini road (last 5 games) */}
      <div className="flex items-center gap-0.5">
        {history.lastNGames.slice(0, 5).reverse().map((game) => (
          <div
            key={game.gameId}
            className={cn(
              'w-2 h-2 rounded-full',
              game.result === 'W' ? 'bg-green-500' : 'bg-red-500'
            )}
          />
        ))}
      </div>

      {/* Streak badge */}
      <span className={cn(
        'text-[10px] font-bold',
        history.streakType === 'W' ? 'text-green-400' : 'text-red-400'
      )}>
        {history.streakType}{history.streakCount}
      </span>
    </div>
  );
});

/**
 * Dual team streak comparison (both teams side by side)
 */
interface DualStreakProps {
  homeHistory: TeamMatchHistory;
  awayHistory: TeamMatchHistory;
  homeAlias: string;
  awayAlias: string;
  maxGames?: number;
  className?: string;
}

export const DualStreakIndicator = memo(function DualStreakIndicator({
  homeHistory,
  awayHistory,
  homeAlias,
  awayAlias,
  maxGames = 10,
  className,
}: DualStreakProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <StreakRoad
        history={awayHistory}
        teamAlias={awayAlias}
        isHome={false}
        maxGames={maxGames}
      />
      <StreakRoad
        history={homeHistory}
        teamAlias={homeAlias}
        isHome={true}
        maxGames={maxGames}
      />
    </div>
  );
});

/**
 * Baccarat-style column road (vertical stacking for consecutive results)
 */
interface BaccaratRoadProps {
  history: TeamMatchHistory;
  maxColumns?: number;
  maxRows?: number;
  className?: string;
}

export const BaccaratRoad = memo(function BaccaratRoad({
  history,
  maxColumns = 10,
  maxRows = 6,
  className,
}: BaccaratRoadProps) {
  // Build column structure from games
  const columns = useMemo(() => {
    const games = [...history.lastNGames].reverse();
    const cols: MatchResult[][] = [];
    let currentCol: MatchResult[] = [];
    let lastResult: 'W' | 'L' | null = null;

    for (const game of games) {
      if (lastResult !== null && game.result !== lastResult) {
        // Result changed, start new column
        if (currentCol.length > 0) {
          cols.push(currentCol);
        }
        currentCol = [game];
      } else {
        // Same result, add to current column
        currentCol.push(game);
      }
      lastResult = game.result;
    }

    if (currentCol.length > 0) {
      cols.push(currentCol);
    }

    return cols.slice(-maxColumns);
  }, [history.lastNGames, maxColumns]);

  return (
    <div className={cn('flex gap-0.5', className)}>
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-0.5">
          {col.slice(0, maxRows).map((game) => (
            <TooltipProvider key={game.gameId}>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold cursor-pointer',
                      game.result === 'W' 
                        ? 'bg-green-500/80 text-green-100' 
                        : 'bg-red-500/80 text-red-100',
                      // Highlight current streak column
                      colIdx === columns.length - 1 && 'ring-1 ring-white/30'
                    )}
                  >
                    {game.result}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {game.isHome ? 'vs' : '@'} {game.opponent.alias}
                    </span>
                    <span className={cn(game.result === 'W' ? 'text-green-400' : 'text-red-400')}>
                      {game.teamScore} - {game.opponentScore}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {format(new Date(game.date), 'MMM d')}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      ))}
    </div>
  );
});

/**
 * Head-to-head streak indicator
 */
interface H2HStreakProps {
  homeHistory: TeamMatchHistory;
  homeAlias: string;
  awayAlias: string;
  className?: string;
}

export const HeadToHeadStreak = memo(function HeadToHeadStreak({
  homeHistory,
  homeAlias,
  awayAlias,
  className,
}: H2HStreakProps) {
  const h2hGames = homeHistory.headToHead;
  
  if (h2hGames.length === 0) {
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        No recent H2H games
      </div>
    );
  }

  const homeWins = h2hGames.filter(g => g.result === 'W').length;
  const awayWins = h2hGames.length - homeWins;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* H2H Record Summary */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Head-to-Head (Last {h2hGames.length})</span>
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-medium">{homeAlias} {homeWins}</span>
          <span className="text-muted-foreground">-</span>
          <span className="text-red-400 font-medium">{awayWins} {awayAlias}</span>
        </div>
      </div>

      {/* H2H Road */}
      <div className="flex items-center gap-0.5">
        {h2hGames.slice(0, 10).reverse().map((game) => (
          <TooltipProvider key={game.gameId}>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold cursor-pointer',
                    game.result === 'W' 
                      ? 'bg-green-500/80 text-green-100' 
                      : 'bg-red-500/80 text-red-100'
                  )}
                >
                  {game.result === 'W' ? homeAlias.slice(0, 2) : awayAlias.slice(0, 2)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {game.isHome ? homeAlias : awayAlias} {game.result === 'W' ? 'won' : 'lost'}
                  </span>
                  <span>
                    {game.teamScore} - {game.opponentScore}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {format(new Date(game.date), 'MMM d, yyyy')}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
});

/**
 * Full streak panel with all indicators
 */
interface StreakPanelProps {
  homeHistory: TeamMatchHistory;
  awayHistory: TeamMatchHistory;
  homeAlias: string;
  awayAlias: string;
  className?: string;
}

export const StreakPanel = memo(function StreakPanel({
  homeHistory,
  awayHistory,
  homeAlias,
  awayAlias,
  className,
}: StreakPanelProps) {
  return (
    <div className={cn('flex flex-col gap-3 p-3 rounded-lg bg-muted/30', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">STREAK ROAD</span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Win</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Loss</span>
          </div>
        </div>
      </div>

      {/* Dual Streak Roads */}
      <DualStreakIndicator
        homeHistory={homeHistory}
        awayHistory={awayHistory}
        homeAlias={homeAlias}
        awayAlias={awayAlias}
      />

      {/* Head to Head */}
      {homeHistory.headToHead.length > 0 && (
        <div className="border-t border-border pt-3">
          <HeadToHeadStreak
            homeHistory={homeHistory}
            homeAlias={homeAlias}
            awayAlias={awayAlias}
          />
        </div>
      )}
    </div>
  );
});

export default StreakPanel;
