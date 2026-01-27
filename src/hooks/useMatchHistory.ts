/**
 * Match History Hook
 * Fetches and calculates match history, streaks, and patterns for betting analysis
 */

import { useQuery } from '@tanstack/react-query';
import type { 
  MatchPanelGame, 
  TeamMatchHistory, 
  NBAStandings,
  NBATeamStanding,
} from '@/types';
import { 
  getNBAStandings, 
  getNBASeasonSchedule, 
  getTeamStanding,
  calculateTeamMatchHistory,
} from '@/services/api/sportradar';

interface UseMatchHistoryOptions {
  /** Number of recent games to include */
  limit?: number;
  /** Whether to fetch head-to-head history */
  includeH2H?: boolean;
  /** Enable/disable the hook */
  enabled?: boolean;
}

interface MatchHistoryResult {
  homeHistory: TeamMatchHistory | null;
  awayHistory: TeamMatchHistory | null;
  homeStanding: NBATeamStanding | null;
  awayStanding: NBATeamStanding | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Hook to fetch match history for both teams in a game
 */
export function useMatchHistory(
  game: MatchPanelGame | null,
  options: UseMatchHistoryOptions = {}
): MatchHistoryResult {
  const { limit = 10, includeH2H = true, enabled = true } = options;

  const homeTeamId = game?.home.team.id;
  const awayTeamId = game?.away.team.id;
  const homeAlias = game?.home.team.alias ?? '';
  const awayAlias = game?.away.team.alias ?? '';

  // Fetch standings (contains streak info, records, etc.)
  const standingsQuery = useQuery({
    queryKey: ['nba-standings'],
    queryFn: () => getNBAStandings(),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    enabled: enabled && !!game,
  });

  // Fetch season schedule for match history
  const scheduleQuery = useQuery({
    queryKey: ['nba-season-schedule'],
    queryFn: () => getNBASeasonSchedule(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    enabled: enabled && !!game,
  });

  // Calculate match histories
  const homeHistory = scheduleQuery.data && homeTeamId
    ? calculateTeamMatchHistory(
        homeTeamId, 
        homeAlias,
        scheduleQuery.data.games,
        includeH2H ? awayTeamId : undefined,
        limit
      )
    : null;

  const awayHistory = scheduleQuery.data && awayTeamId
    ? calculateTeamMatchHistory(
        awayTeamId, 
        awayAlias,
        scheduleQuery.data.games,
        includeH2H ? homeTeamId : undefined,
        limit
      )
    : null;

  // Get standings for each team
  const homeStanding = standingsQuery.data && homeTeamId
    ? getTeamStanding(standingsQuery.data, homeTeamId)
    : null;

  const awayStanding = standingsQuery.data && awayTeamId
    ? getTeamStanding(standingsQuery.data, awayTeamId)
    : null;

  const isLoading = standingsQuery.isLoading || scheduleQuery.isLoading;
  const isError = standingsQuery.isError || scheduleQuery.isError;
  const error = standingsQuery.error ?? scheduleQuery.error ?? null;

  return {
    homeHistory,
    awayHistory,
    homeStanding,
    awayStanding,
    isLoading,
    isError,
    error,
  };
}

/**
 * Hook to fetch match history for multiple games at once
 */
export function useMultipleMatchHistories(
  games: MatchPanelGame[],
  options: UseMatchHistoryOptions = {}
): {
  histories: Map<string, { home: TeamMatchHistory; away: TeamMatchHistory }>;
  standings: NBAStandings | null;
  isLoading: boolean;
  isError: boolean;
} {
  const { limit = 10, enabled = true } = options;

  // Fetch standings
  const standingsQuery = useQuery({
    queryKey: ['nba-standings'],
    queryFn: () => getNBAStandings(),
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && games.length > 0,
  });

  // Fetch season schedule
  const scheduleQuery = useQuery({
    queryKey: ['nba-season-schedule'],
    queryFn: () => getNBASeasonSchedule(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && games.length > 0,
  });

  // Calculate histories for all games
  const histories = new Map<string, { home: TeamMatchHistory; away: TeamMatchHistory }>();
  
  if (scheduleQuery.data) {
    for (const game of games) {
      const homeHistory = calculateTeamMatchHistory(
        game.home.team.id,
        game.home.team.alias,
        scheduleQuery.data.games,
        game.away.team.id,
        limit
      );
      const awayHistory = calculateTeamMatchHistory(
        game.away.team.id,
        game.away.team.alias,
        scheduleQuery.data.games,
        game.home.team.id,
        limit
      );
      histories.set(game.id, { home: homeHistory, away: awayHistory });
    }
  }

  return {
    histories,
    standings: standingsQuery.data ?? null,
    isLoading: standingsQuery.isLoading || scheduleQuery.isLoading,
    isError: standingsQuery.isError || scheduleQuery.isError,
  };
}

/**
 * Hook to get standings data only
 */
export function useNBAStandings() {
  return useQuery({
    queryKey: ['nba-standings'],
    queryFn: () => getNBAStandings(),
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Hook to get team standing by ID
 */
export function useTeamStanding(teamId: string | undefined) {
  const standingsQuery = useNBAStandings();
  
  const standing = standingsQuery.data && teamId
    ? getTeamStanding(standingsQuery.data, teamId)
    : null;

  return {
    standing,
    isLoading: standingsQuery.isLoading,
    isError: standingsQuery.isError,
  };
}

/**
 * Calculate rest days between games
 */
export function calculateRestDays(
  teamId: string,
  currentGameDate: Date,
  games: Array<{ scheduled: string; home: { id: string }; away: { id: string } }>
): number {
  // Find the most recent completed game before current game
  const previousGames = games
    .filter(g => 
      (g.home.id === teamId || g.away.id === teamId) &&
      new Date(g.scheduled) < currentGameDate
    )
    .sort((a, b) => new Date(b.scheduled).getTime() - new Date(a.scheduled).getTime());

  if (previousGames.length === 0) {
    return 7; // No previous game found, assume well-rested
  }

  const previousGameDate = new Date(previousGames[0].scheduled);
  const diffMs = currentGameDate.getTime() - previousGameDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Check if team is on a back-to-back
 */
export function isBackToBack(
  teamId: string,
  currentGameDate: Date,
  games: Array<{ scheduled: string; home: { id: string }; away: { id: string } }>
): boolean {
  const restDays = calculateRestDays(teamId, currentGameDate, games);
  return restDays <= 1;
}
