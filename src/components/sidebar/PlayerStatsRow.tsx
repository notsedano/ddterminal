/**
 * Player Stats Row Component
 * Displays individual player statistics in a compact row format
 * Supports both live game stats and season averages
 */

import { memo } from 'react';
import { cn } from '@/utils/cn';
import type { PlayerGameStats } from '@/hooks/useGameStats';
import { Flame, AlertTriangle } from 'lucide-react';

interface PlayerStatsRowProps {
  player: PlayerGameStats;
  isSeasonAverage?: boolean;
  showFieldGoalPct?: boolean;
  showThreePointPct?: boolean;
  className?: string;
}

/**
 * PlayerStatsRow - memoized to prevent unnecessary re-renders
 */
export const PlayerStatsRow = memo(function PlayerStatsRow({
  player,
  isSeasonAverage = false,
  showFieldGoalPct = true,
  showThreePointPct = true,
  className,
}: PlayerStatsRowProps) {
  // Hot hand only applies to live game stats, not season averages
  const isHotHand = !isSeasonAverage && (
    (player.fieldGoalPct > 50 && player.fieldGoalsAttempted >= 5) ||
    (player.threePointPct > 40 && player.threePointsAttempted >= 3)
  );

  // Injury status styling
  const getInjuryColor = () => {
    if (!player.isInjured || !player.injuryStatus) return '';
    switch (player.injuryStatus) {
      case 'Out':
      case 'Doubtful':
        return 'text-red-400';
      case 'Questionable':
      case 'Day-To-Day':
        return 'text-yellow-400';
      case 'Probable':
        return 'text-green-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getInjuryBg = () => {
    if (!player.isInjured || !player.injuryStatus) return '';
    switch (player.injuryStatus) {
      case 'Out':
      case 'Doubtful':
        return 'bg-red-500/10';
      case 'Questionable':
      case 'Day-To-Day':
        return 'bg-yellow-500/10';
      case 'Probable':
        return 'bg-green-500/10';
      default:
        return '';
    }
  };

  const formatPercentage = (pct: number, attempted: number): string => {
    // Show dash if no attempts
    if (attempted === 0) return '-';
    // Show dash if percentage is 0 but we expect data (likely API didn't provide it)
    if (pct === 0) return '-';
    return `${Math.round(pct)}%`;
  };

  const formatPoints = (pts: number): string => {
    if (isSeasonAverage) {
      // Show decimal for season averages
      return pts.toFixed(1);
    }
    return pts.toString();
  };

  const getBettingImpactColor = () => {
    switch (player.bettingImpact) {
      case 'high':
        return 'text-yellow-400';
      case 'medium':
        return 'text-blue-400';
      default:
        return '';
    }
  };

  // Format player name (first initial + last name)
  const formatPlayerName = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      return `${firstName.charAt(0)}. ${lastName}`;
    }
    return name;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded text-xs',
        'hover:bg-muted/30 transition-colors',
        player.onCourt && !isSeasonAverage && 'bg-primary/10',
        player.isInjured && getInjuryBg(),
        className
      )}
    >
      {/* On Court Indicator (only for live games) */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {!isSeasonAverage && (
          player.onCourt ? (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-transparent flex-shrink-0" />
          )
        )}
        
        {/* Player Name */}
        <span
          className={cn(
            'truncate font-medium',
            getBettingImpactColor(),
            player.onCourt && !isSeasonAverage && 'text-foreground',
            player.isInjured && getInjuryColor()
          )}
          title={player.isInjured && player.injuryStatus 
            ? `${player.name} - ${player.injuryStatus}` 
            : player.name
          }
        >
          {formatPlayerName(player.name)}
        </span>
        {/* Injury Indicator */}
        {player.isInjured && player.injuryStatus && (
          <AlertTriangle 
            className={cn(
              'h-3 w-3 flex-shrink-0',
              getInjuryColor()
            )}
            title={`Injury Status: ${player.injuryStatus}`}
          />
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Points */}
        <span className={cn(
          'font-bold tabular-nums text-right hud-data',
          isSeasonAverage ? 'w-10' : 'w-8'
        )}>
          {formatPoints(player.points)}
        </span>

        {/* Field Goal % */}
        {showFieldGoalPct && (
          <span
            className={cn(
              'tabular-nums w-10 text-right text-[10px]',
              isHotHand && player.fieldGoalPct > 50 && 'text-green-400'
            )}
            title={isSeasonAverage 
              ? `Season FG%` 
              : `${player.fieldGoalsMade}/${player.fieldGoalsAttempted} FG`
            }
          >
            {formatPercentage(player.fieldGoalPct, player.fieldGoalsAttempted)}
          </span>
        )}

        {/* 3PT % */}
        {showThreePointPct && (
          <span
            className={cn(
              'tabular-nums w-10 text-right text-[10px]',
              isHotHand && player.threePointPct > 40 && 'text-green-400'
            )}
            title={isSeasonAverage 
              ? `Season 3P%` 
              : `${player.threePointsMade}/${player.threePointsAttempted} 3PT`
            }
          >
            {formatPercentage(player.threePointPct, player.threePointsAttempted)}
          </span>
        )}

        {/* Hot Hand Indicator (only for live games) */}
        {isHotHand && (
          <Flame className="h-3 w-3 text-orange-400 flex-shrink-0" aria-label="Hot hand" />
        )}
      </div>
    </div>
  );
});
