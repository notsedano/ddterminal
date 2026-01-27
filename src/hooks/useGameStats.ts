/**
 * Hook for fetching and processing game player statistics
 * - Pre-game: Uses team seasonal stats (cached for 10 minutes)
 * - Live/Completed: Uses boxscore data (refreshes every 15 seconds)
 */

import { useQuery, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getNBAGameBoxscore, getNBATeamStats } from '@/services/api/sportradar';
import type { 
  NBAGameSummary, 
  NBAPlayerStatistics,
  NBATeamSeasonalStats,
  NBASeasonPlayerStats,
  MatchPanelGame,
} from '@/types';

export interface PlayerGameStats {
  id: string;
  name: string;
  team: 'home' | 'away';
  teamAlias: string;
  points: number;
  fieldGoalPct: number;
  threePointPct: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personalFouls: number;
  plusMinus: number;
  minutes: string;
  onCourt: boolean;
  bettingImpact: 'high' | 'medium' | 'low';
  // Additional stats for sorting
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointsMade: number;
  threePointsAttempted: number;
  // Season average indicator (for pre-game)
  isSeasonAverage: boolean;
}

export type SortField = 'points' | 'fieldGoalPct' | 'threePointPct' | 'rebounds' | 'assists' | 'plusMinus' | 'minutes';
export type SortDirection = 'asc' | 'desc';

interface UseGameStatsOptions {
  gameId: string | null;
  game: MatchPanelGame | null;
  autoRefresh?: boolean;
}

interface UseGameStatsResult {
  homePlayers: PlayerGameStats[];
  awayPlayers: PlayerGameStats[];
  isLoading: boolean;
  error: Error | null;
  isSeasonStats: boolean;
  sortPlayers: (players: PlayerGameStats[], field: SortField, direction: SortDirection) => PlayerGameStats[];
  getTopScorer: (team: 'home' | 'away') => PlayerGameStats | null;
  getHotHandPlayers: (team: 'home' | 'away') => PlayerGameStats[];
}

/**
 * Calculate betting impact based on player contribution
 */
function calculateBettingImpact(
  player: PlayerGameStats,
  teamTotalPoints: number
): 'high' | 'medium' | 'low' {
  if (teamTotalPoints === 0) return 'low';
  
  // High impact: >25% of team points OR +/- > +10
  if (player.points / teamTotalPoints > 0.25 || player.plusMinus > 10) {
    return 'high';
  }
  
  // Medium impact: 15-25% of team points OR +/- between +3 and +10
  if (player.points / teamTotalPoints > 0.15 || (player.plusMinus > 3 && player.plusMinus <= 10)) {
    return 'medium';
  }
  
  // Low impact: <15% of team points
  return 'low';
}

/**
 * Extract and normalize player stats from boxscore (live/completed games)
 */
function extractPlayerStatsFromBoxscore(
  boxscore: NBAGameSummary,
  team: 'home' | 'away'
): PlayerGameStats[] {
  const teamData = boxscore[team];
  if (!teamData?.players) {
    return [];
  }

  const teamTotalPoints = teamData.points || 0;
  const players: PlayerGameStats[] = [];

  for (const player of teamData.players) {
    // Accept players that have played OR have statistics (handle edge cases)
    if (!player.statistics && !player.played) continue;
    
    const stats = player.statistics;
    if (!stats) continue;
    
    const playerStats: PlayerGameStats = {
      id: player.id,
      name: player.full_name || `${player.first_name} ${player.last_name}`,
      team,
      teamAlias: teamData.alias,
      points: stats.points || 0,
      fieldGoalPct: stats.field_goals_pct || 0,
      threePointPct: stats.three_points_pct || 0,
      rebounds: stats.rebounds || 0,
      assists: stats.assists || 0,
      steals: stats.steals || 0,
      blocks: stats.blocks || 0,
      turnovers: stats.turnovers || 0,
      personalFouls: stats.personal_fouls || 0,
      plusMinus: stats.plus_minus ?? stats.pls_min ?? 0,
      minutes: stats.minutes || '0:00',
      onCourt: player.on_court ?? false,
      bettingImpact: 'low',
      fieldGoalsMade: stats.field_goals_made || 0,
      fieldGoalsAttempted: stats.field_goals_att || 0,
      threePointsMade: stats.three_points_made || 0,
      threePointsAttempted: stats.three_points_att || 0,
      isSeasonAverage: false,
    };

    // Calculate betting impact
    playerStats.bettingImpact = calculateBettingImpact(playerStats, teamTotalPoints);
    players.push(playerStats);
  }

  return players;
}

/**
 * Normalize percentage values - API might return as decimal (0.52) or percentage (52)
 */
function normalizePercentage(value: number | undefined): number {
  if (value === undefined || value === null) return 0;
  // If value is less than 1, it's likely a decimal (0.52 = 52%)
  if (value > 0 && value < 1) {
    return value * 100;
  }
  return value;
}

/**
 * Extract player statistics from various possible structures
 * Sportradar API can return stats in different fields depending on the endpoint
 */
function getPlayerStats(player: NBASeasonPlayerStats): NBAPlayerStatistics | null {
  // Try 'average' first (season stats endpoint)
  if (player.average && typeof player.average.points === 'number') {
    return player.average;
  }
  // Try 'total' (some endpoints return totals)
  if (player.total && typeof player.total.points === 'number') {
    return player.total;
  }
  // Try direct 'statistics' field (boxscore-like structure)
  const anyPlayer = player as NBASeasonPlayerStats & { statistics?: NBAPlayerStatistics };
  if (anyPlayer.statistics && typeof anyPlayer.statistics.points === 'number') {
    return anyPlayer.statistics;
  }
  return null;
}

/**
 * Safely extract numeric value from stats object with multiple field name attempts
 */
function extractNumber(stats: Record<string, unknown>, ...fieldNames: string[]): number {
  for (const name of fieldNames) {
    const value = stats[name];
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
  }
  return 0;
}

/**
 * Extract field goal percentage from stats object
 * Falls back to calculating from made/attempted if percentage not available
 */
function extractFgPct(stats: Record<string, unknown>): number {
  // Try various field names for direct percentage
  const pctValue = extractNumber(stats, 
    'field_goals_pct', 'fg_pct', 'fieldGoalsPct', 'fgPct', 
    'field_goal_pct', 'fg_percentage'
  );
  if (pctValue > 0) {
    return normalizePercentage(pctValue);
  }
  
  // Calculate from made/attempted if available
  const made = extractNumber(stats, 'field_goals_made', 'fg_made', 'fgm', 'field_goals');
  const att = extractNumber(stats, 'field_goals_att', 'fg_att', 'fga', 'field_goals_attempted');
  if (att > 0 && made >= 0) {
    return (made / att) * 100;
  }
  return 0;
}

/**
 * Extract three point percentage from stats object
 * Falls back to calculating from made/attempted if percentage not available  
 */
function extractThreePtPct(stats: Record<string, unknown>): number {
  // Try various field names for direct percentage
  const pctValue = extractNumber(stats,
    'three_points_pct', 'fg3_pct', 'threePointsPct', 'three_pt_pct',
    'three_point_pct', 'fg3_percentage', 'three_pct'
  );
  if (pctValue > 0) {
    return normalizePercentage(pctValue);
  }
  
  // Calculate from made/attempted if available
  const made = extractNumber(stats, 'three_points_made', 'fg3_made', 'three_pt_made', 'fg3m', 'threes_made');
  const att = extractNumber(stats, 'three_points_att', 'fg3_att', 'three_pt_att', 'fg3a', 'threes_attempted');
  if (att > 0 && made >= 0) {
    return (made / att) * 100;
  }
  return 0;
}

/**
 * Extract field goals made from stats
 */
function extractFgMade(stats: Record<string, unknown>): number {
  return extractNumber(stats, 'field_goals_made', 'fg_made', 'fgm', 'field_goals');
}

/**
 * Extract field goals attempted from stats
 */
function extractFgAtt(stats: Record<string, unknown>): number {
  return extractNumber(stats, 'field_goals_att', 'fg_att', 'fga', 'field_goals_attempted');
}

/**
 * Extract three pointers made from stats
 */
function extractThreeMade(stats: Record<string, unknown>): number {
  return extractNumber(stats, 'three_points_made', 'fg3_made', 'three_pt_made', 'fg3m', 'threes_made');
}

/**
 * Extract three pointers attempted from stats
 */
function extractThreeAtt(stats: Record<string, unknown>): number {
  return extractNumber(stats, 'three_points_att', 'fg3_att', 'three_pt_att', 'fg3a', 'threes_attempted');
}

/**
 * Extract and normalize player stats from team seasonal stats (pre-game)
 * Season stats use 'average' and 'total' fields instead of 'statistics'
 */
function extractPlayerStatsFromSeasonStats(
  teamStats: NBATeamSeasonalStats,
  team: 'home' | 'away'
): PlayerGameStats[] {
  if (!teamStats?.players || teamStats.players.length === 0) {
    return [];
  }

  // Calculate team's average points per game for impact calculation
  const teamAvgPoints = teamStats.statistics?.average?.points || 100;

  const players: PlayerGameStats[] = [];

  for (const player of teamStats.players) {
    const stats = getPlayerStats(player);
    if (!stats) continue;

    // Cast stats to allow flexible field access
    const statsObj = stats as unknown as Record<string, unknown>;

    const playerStats: PlayerGameStats = {
      id: player.id,
      name: player.full_name || `${player.first_name} ${player.last_name}`,
      team,
      teamAlias: teamStats.alias,
      // For season stats, these are averages per game
      points: extractNumber(statsObj, 'points', 'pts', 'ppg') || 0,
      fieldGoalPct: extractFgPct(statsObj),
      threePointPct: extractThreePtPct(statsObj),
      rebounds: extractNumber(statsObj, 'rebounds', 'reb', 'rpg', 'total_rebounds') || 0,
      assists: extractNumber(statsObj, 'assists', 'ast', 'apg') || 0,
      steals: extractNumber(statsObj, 'steals', 'stl', 'spg') || 0,
      blocks: extractNumber(statsObj, 'blocks', 'blk', 'bpg') || 0,
      turnovers: extractNumber(statsObj, 'turnovers', 'tov', 'to') || 0,
      personalFouls: extractNumber(statsObj, 'personal_fouls', 'pf', 'fouls') || 0,
      plusMinus: extractNumber(statsObj, 'plus_minus', 'pls_min', 'pm') || 0,
      minutes: (statsObj.minutes as string) || (statsObj.min as string) || '0:00',
      onCourt: false, // Not applicable for season stats
      bettingImpact: 'low',
      fieldGoalsMade: extractFgMade(statsObj),
      fieldGoalsAttempted: extractFgAtt(statsObj),
      threePointsMade: extractThreeMade(statsObj),
      threePointsAttempted: extractThreeAtt(statsObj),
      isSeasonAverage: true,
    };

    // Calculate betting impact based on season averages
    playerStats.bettingImpact = calculateBettingImpact(playerStats, teamAvgPoints);
    players.push(playerStats);
  }

  // Sort by points by default and take top 15 players
  return players
    .sort((a, b) => b.points - a.points)
    .slice(0, 15);
}

/**
 * Sort players by a given field and direction
 */
function sortPlayers(
  players: PlayerGameStats[],
  field: SortField,
  direction: SortDirection
): PlayerGameStats[] {
  const sorted = [...players].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (field) {
      case 'points':
        aValue = a.points;
        bValue = b.points;
        break;
      case 'fieldGoalPct':
        // Only consider players with at least 5 attempts (or for season avg, any attempts)
        if (a.fieldGoalsAttempted < (a.isSeasonAverage ? 1 : 5)) aValue = -1;
        else aValue = a.fieldGoalPct;
        if (b.fieldGoalsAttempted < (b.isSeasonAverage ? 1 : 5)) bValue = -1;
        else bValue = b.fieldGoalPct;
        break;
      case 'threePointPct':
        // Only consider players with at least 3 attempts (or for season avg, any attempts)
        if (a.threePointsAttempted < (a.isSeasonAverage ? 1 : 3)) aValue = -1;
        else aValue = a.threePointPct;
        if (b.threePointsAttempted < (b.isSeasonAverage ? 1 : 3)) bValue = -1;
        else bValue = b.threePointPct;
        break;
      case 'rebounds':
        aValue = a.rebounds;
        bValue = b.rebounds;
        break;
      case 'assists':
        aValue = a.assists;
        bValue = b.assists;
        break;
      case 'plusMinus':
        aValue = a.plusMinus;
        bValue = b.plusMinus;
        break;
      case 'minutes':
        // Parse minutes string (e.g., "25:30" -> 25.5)
        const parseMinutes = (minStr: string): number => {
          const parts = minStr.split(':');
          if (parts.length !== 2) return parseFloat(minStr) || 0;
          return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
        };
        aValue = parseMinutes(a.minutes);
        bValue = parseMinutes(b.minutes);
        break;
      default:
        return 0;
    }

    if (direction === 'asc') {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });

  return sorted;
}

/**
 * Get top scorer for a team
 */
function getTopScorer(players: PlayerGameStats[]): PlayerGameStats | null {
  if (players.length === 0) return null;
  return sortPlayers(players, 'points', 'desc')[0];
}

/**
 * Get players with "hot hand" (shooting efficiently) - only for live games
 */
function getHotHandPlayers(players: PlayerGameStats[]): PlayerGameStats[] {
  // Hot hand only applies to live game stats, not season averages
  return players.filter(
    player =>
      !player.isSeasonAverage &&
      ((player.fieldGoalPct > 50 && player.fieldGoalsAttempted >= 5) ||
       (player.threePointPct > 40 && player.threePointsAttempted >= 3))
  );
}

/**
 * Determine if game is live or completed (use boxscore) vs scheduled (use season stats)
 */
function isGameLiveOrCompleted(game: MatchPanelGame | null): boolean {
  if (!game) return false;
  return game.isLive || game.status === 'complete' || game.status === 'closed';
}

export function useGameStats(options: UseGameStatsOptions): UseGameStatsResult {
  const { gameId, game, autoRefresh = true } = options;
  
  const shouldUseBoxscore = isGameLiveOrCompleted(game);
  const homeTeamId = game?.home.team.id;
  const awayTeamId = game?.away.team.id;

  // Fetch boxscore data for live/completed games
  const {
    data: boxscore,
    isLoading: boxscoreLoading,
    error: boxscoreError,
  } = useQuery<NBAGameSummary, Error>({
    queryKey: ['nba-game-boxscore', gameId],
    queryFn: () => {
      if (!gameId) throw new Error('No game ID provided');
      return getNBAGameBoxscore(gameId);
    },
    enabled: !!gameId && shouldUseBoxscore,
    staleTime: 15 * 1000, // 15 seconds for live game data
    refetchInterval: (query) => {
      if (!autoRefresh || !gameId || !game?.isLive) return false;
      // Refetch every 15 seconds if game is live
      const data = query.state.data;
      if (data && (data.status === 'inprogress' || data.status === 'halftime')) {
        return 15 * 1000;
      }
      return false;
    },
  });

  // Fetch season stats for both teams (always fetch for fallback support)
  const seasonStatsQueries = useQueries({
    queries: [
      {
        queryKey: ['nba-team-season-stats', homeTeamId],
        queryFn: () => {
          if (!homeTeamId) throw new Error('No home team ID');
          return getNBATeamStats(homeTeamId);
        },
        enabled: !!homeTeamId,
        staleTime: 10 * 60 * 1000, // 10 minutes - season stats don't change often
        gcTime: 30 * 60 * 1000, // 30 minutes cache
      },
      {
        queryKey: ['nba-team-season-stats', awayTeamId],
        queryFn: () => {
          if (!awayTeamId) throw new Error('No away team ID');
          return getNBATeamStats(awayTeamId);
        },
        enabled: !!awayTeamId,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      },
    ],
  });

  const homeSeasonStats = seasonStatsQueries[0].data;
  const awaySeasonStats = seasonStatsQueries[1].data;
  const seasonStatsLoading = seasonStatsQueries.some(q => q.isLoading);
  const seasonStatsError = seasonStatsQueries.find(q => q.error)?.error as Error | undefined;

  // Extract and process player stats based on game status
  const { homePlayers, awayPlayers, isSeasonStats } = useMemo(() => {
    // Live or completed game: use boxscore
    if (shouldUseBoxscore && boxscore) {
      const home = extractPlayerStatsFromBoxscore(boxscore, 'home');
      const away = extractPlayerStatsFromBoxscore(boxscore, 'away');
      
      // If boxscore has players, use them
      if (home.length > 0 || away.length > 0) {
        return { homePlayers: home, awayPlayers: away, isSeasonStats: false };
      }
      
      // Fallback: if boxscore has no player data, try season stats
      if (homeSeasonStats || awaySeasonStats) {
        const homeFallback = homeSeasonStats 
          ? extractPlayerStatsFromSeasonStats(homeSeasonStats, 'home')
          : [];
        const awayFallback = awaySeasonStats
          ? extractPlayerStatsFromSeasonStats(awaySeasonStats, 'away')
          : [];
        if (homeFallback.length > 0 || awayFallback.length > 0) {
          return { homePlayers: homeFallback, awayPlayers: awayFallback, isSeasonStats: true };
        }
      }
      
      return { homePlayers: home, awayPlayers: away, isSeasonStats: false };
    }
    
    // Pre-game: use season stats
    if (homeSeasonStats || awaySeasonStats) {
      const home = homeSeasonStats 
        ? extractPlayerStatsFromSeasonStats(homeSeasonStats, 'home')
        : [];
      const away = awaySeasonStats
        ? extractPlayerStatsFromSeasonStats(awaySeasonStats, 'away')
        : [];
      return { homePlayers: home, awayPlayers: away, isSeasonStats: true };
    }

    return { homePlayers: [], awayPlayers: [], isSeasonStats: false };
  }, [shouldUseBoxscore, boxscore, homeSeasonStats, awaySeasonStats]);

  // Determine loading and error states
  // For live/completed games: loading if boxscore is loading OR (no boxscore players AND season stats loading)
  // For pre-game: loading if season stats are loading
  const isLoading = shouldUseBoxscore 
    ? boxscoreLoading || ((!boxscore?.home?.players?.length && !boxscore?.away?.players?.length) && seasonStatsLoading)
    : seasonStatsLoading;
  
  // Only show error if primary data source fails
  const error = shouldUseBoxscore ? boxscoreError : seasonStatsError;

  return {
    homePlayers,
    awayPlayers,
    isLoading,
    error: error ?? null,
    isSeasonStats,
    sortPlayers,
    getTopScorer: (team: 'home' | 'away') => {
      const players = team === 'home' ? homePlayers : awayPlayers;
      return getTopScorer(players);
    },
    getHotHandPlayers: (team: 'home' | 'away') => {
      const players = team === 'home' ? homePlayers : awayPlayers;
      return getHotHandPlayers(players);
    },
  };
}
