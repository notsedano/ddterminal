/**
 * Live Team Stats Component
 * Displays player statistics for the currently selected game
 * - Pre-game: Shows season averages
 * - Live/Completed: Shows current game stats
 */

import { useState, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { useMatchPanel } from '@/hooks/useMatchPanel';
import { useGameStats, type SortField, type SortDirection } from '@/hooks/useGameStats';
import { PlayerStatsRow } from './PlayerStatsRow';
import { ChevronDown, ChevronUp, TrendingUp, Activity, BarChart3 } from 'lucide-react';

export function LiveTeamStats() {
  const { currentMatch } = useMatchPanel();
  const game = currentMatch?.game ?? null;
  const gameId = game?.id ?? null;
  const isLive = game?.isLive ?? false;

  const {
    homePlayers,
    awayPlayers,
    isLoading,
    error,
    isSeasonStats,
    sortPlayers,
    getTopScorer,
    getHotHandPlayers,
  } = useGameStats({
    gameId,
    game,
    autoRefresh: isLive,
  });

  // Team selection
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Collapsed state
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get current team's players
  const currentPlayers = useMemo(() => {
    const players = selectedTeam === 'home' ? homePlayers : awayPlayers;
    return sortPlayers(players, sortField, sortDirection);
    // sortPlayers is a stable function reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam, homePlayers, awayPlayers, sortField, sortDirection]);

  // Get top scorer comparison
  const topScorerHome = getTopScorer('home');
  const topScorerAway = getTopScorer('away');
  const topScorerDiff = useMemo(() => {
    if (!topScorerHome || !topScorerAway) return null;
    return topScorerHome.points - topScorerAway.points;
  }, [topScorerHome, topScorerAway]);

  // Get hot hand players (only for live games)
  const hotHandHome = getHotHandPlayers('home');
  const hotHandAway = getHotHandPlayers('away');

  // No game selected
  if (!currentMatch) {
    return (
      <div className="p-4 border-t border-border flex flex-col items-center justify-center gap-2 min-h-[120px]">
        <Activity className="h-6 w-6 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground text-center">
          Select a game to view stats
        </span>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 border-t border-border flex flex-col items-center justify-center gap-2 min-h-[120px]">
        <Activity className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading stats...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 border-t border-border flex flex-col items-center justify-center gap-2 min-h-[120px]">
        <span className="text-xs text-destructive text-center">
          Failed to load stats
        </span>
      </div>
    );
  }

  // No stats available
  if (homePlayers.length === 0 && awayPlayers.length === 0) {
    return (
      <div className="p-4 border-t border-border flex flex-col items-center justify-center gap-2 min-h-[120px]">
        <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground text-center">
          No stats available
        </span>
      </div>
    );
  }

  const homeAlias = currentMatch.game.home.team.alias;
  const awayAlias = currentMatch.game.away.team.alias;

  // Collapsed view - show top scorer matchup
  if (isCollapsed) {
    const homeTopName = topScorerHome?.name.split(' ').pop() ?? '-';
    const awayTopName = topScorerAway?.name.split(' ').pop() ?? '-';
    const homeTopPts = topScorerHome?.points ?? 0;
    const awayTopPts = topScorerAway?.points ?? 0;
    const homeLeads = homeTopPts > awayTopPts;
    const awayLeads = awayTopPts > homeTopPts;

    return (
      <div className="p-3 border-t border-border">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {isSeasonStats ? 'Season Stats' : 'Live Stats'}
            </span>
            {isSeasonStats && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                AVG
              </span>
            )}
          </div>
          <ChevronUp className="h-4 w-4" />
        </button>
        
        {/* Top Scorer Matchup */}
        {topScorerHome && topScorerAway && (
          <div className="flex items-center justify-between gap-2 text-[10px]">
            {/* Away Team Top Scorer */}
            <div className={cn(
              'flex flex-col items-start',
              awayLeads && 'text-green-400'
            )}>
              <span className="text-muted-foreground text-[9px]">{awayAlias}</span>
              <div className="flex items-center gap-1">
                <span className="font-medium">{awayTopName}</span>
                <span className={cn(
                  'font-bold tabular-nums',
                  awayLeads ? 'text-green-400' : 'text-muted-foreground'
                )}>
                  {isSeasonStats ? awayTopPts.toFixed(1) : awayTopPts}
                </span>
              </div>
            </div>

            {/* VS */}
            <span className="text-muted-foreground/50 text-[9px]">vs</span>

            {/* Home Team Top Scorer */}
            <div className={cn(
              'flex flex-col items-end',
              homeLeads && 'text-green-400'
            )}>
              <span className="text-muted-foreground text-[9px]">{homeAlias}</span>
              <div className="flex items-center gap-1">
                <span className={cn(
                  'font-bold tabular-nums',
                  homeLeads ? 'text-green-400' : 'text-muted-foreground'
                )}>
                  {isSeasonStats ? homeTopPts.toFixed(1) : homeTopPts}
                </span>
                <span className="font-medium">{homeTopName}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      {/* Header */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium hud-text">
              {isSeasonStats ? 'Season Stats' : 'Live Stats'}
            </span>
            {isSeasonStats && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                AVG
              </span>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Collapse stats"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Team Tabs */}
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => setSelectedTeam('away')}
            className={cn(
              'flex-1 px-2 py-1 text-[10px] rounded transition-colors',
              selectedTeam === 'away'
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            )}
          >
            {awayAlias}
          </button>
          <button
            onClick={() => setSelectedTeam('home')}
            className={cn(
              'flex-1 px-2 py-1 text-[10px] rounded transition-colors',
              selectedTeam === 'home'
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            )}
          >
            {homeAlias}
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="flex-1 px-2 py-1 text-[10px] rounded bg-background text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            <option value="points">{isSeasonStats ? 'PPG' : 'PTS'}</option>
            <option value="fieldGoalPct">FG%</option>
            <option value="threePointPct">3P%</option>
            <option value="rebounds">{isSeasonStats ? 'RPG' : 'REB'}</option>
            <option value="assists">{isSeasonStats ? 'APG' : 'AST'}</option>
            <option value="plusMinus">+/-</option>
            <option value="minutes">{isSeasonStats ? 'MPG' : 'MIN'}</option>
          </select>
          <button
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="px-2 py-1 text-[10px] rounded bg-background border border-border hover:bg-muted/50 transition-colors"
            title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Player List */}
      <div className="max-h-[300px] overflow-y-auto">
        {currentPlayers.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No player stats available
          </div>
        ) : (
          <div className="py-2">
            {/* Header Row */}
            <div className="px-2 pb-1 mb-1 border-b border-border/30 flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="flex-1">Player</div>
              <div className="flex items-center gap-2">
                <span className="w-8 text-right font-medium">
                  {isSeasonStats ? 'PPG' : 'PTS'}
                </span>
                <span className="w-10 text-right">FG%</span>
                <span className="w-10 text-right">3P%</span>
              </div>
            </div>

            {/* Player Rows */}
            {currentPlayers.map((player) => (
              <PlayerStatsRow 
                key={player.id} 
                player={player}
                isSeasonAverage={isSeasonStats}
              />
            ))}
          </div>
        )}
      </div>

      {/* Betting Indicators Footer */}
      <div className="p-3 border-t border-border/50 space-y-2">
        {/* Top Scorer Comparison */}
        {topScorerDiff !== null && topScorerHome && topScorerAway && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">
              {isSeasonStats ? 'PPG Leader:' : 'Top Scorer Lead:'}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{topScorerHome.name.split(' ').pop()}</span>
              <span className={cn(
                'font-bold tabular-nums',
                topScorerDiff > 0 ? 'text-green-400' : topScorerDiff < 0 ? 'text-red-400' : 'text-muted-foreground'
              )}>
                {topScorerDiff > 0 ? '+' : ''}{isSeasonStats ? topScorerDiff.toFixed(1) : topScorerDiff}
              </span>
              <span className="font-medium">{topScorerAway.name.split(' ').pop()}</span>
            </div>
          </div>
        )}

        {/* Hot Hand Indicators (only for live games) */}
        {!isSeasonStats && (hotHandHome.length > 0 || hotHandAway.length > 0) && (
          <div className="flex items-center gap-2 text-[10px]">
            <TrendingUp className="h-3 w-3 text-orange-400" />
            <span className="text-muted-foreground">Hot Hand:</span>
            <div className="flex items-center gap-1.5">
              {hotHandHome.slice(0, 2).map((player) => (
                <span key={player.id} className="text-orange-400 font-medium">
                  {player.name.split(' ').pop()}
                </span>
              ))}
              {hotHandAway.slice(0, 2).map((player) => (
                <span key={player.id} className="text-orange-400 font-medium">
                  {player.name.split(' ').pop()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          {isLive ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>Live updates</span>
            </>
          ) : isSeasonStats ? (
            <>
              <BarChart3 className="h-3 w-3" />
              <span>Season averages • Updates when game starts</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              <span>Final stats</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
