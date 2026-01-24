/**
 * Hook for fetching and managing NBA schedule data
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useMemo } from 'react';
import type { MatchPanelGame } from '@/types';
import {
  getNBAMatchPanelGames,
  getNBALiveUpdates,
  applyLiveUpdatesToGames,
  getActiveGames,
  getLiveGameIds,
  getGamesByPriority,
  categorizeGames,
  getUpcomingGames,
} from '@/services/api/sportradar';

// Query key for schedule
const SCHEDULE_QUERY_KEY = 'nba-schedule';

// Polling intervals
const SCHEDULE_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const LIVE_POLL_INTERVAL = 15 * 1000; // 15 seconds for live games

interface UseNBAScheduleOptions {
  date?: Date;
  autoRefreshLive?: boolean;
}

interface UseNBAScheduleResult {
  /** All games sorted by priority (live > upcoming > completed) */
  games: MatchPanelGame[];
  /** Active games (live + upcoming + recently completed) */
  activeGames: MatchPanelGame[];
  /** Currently live games */
  liveGames: MatchPanelGame[];
  /** Upcoming scheduled games sorted by start time */
  upcomingGames: MatchPanelGame[];
  /** Completed games */
  completedGames: MatchPanelGame[];
  /** Next game to start */
  nextGame: MatchPanelGame | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => void;
  lastUpdated: Date | null;
}

export function useNBASchedule(options: UseNBAScheduleOptions = {}): UseNBAScheduleResult {
  const { date, autoRefreshLive = true } = options;
  const queryClient = useQueryClient();
  const livePollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdatedRef = useRef<Date | null>(null);

  // Main schedule query
  const {
    data: rawGames,
    isLoading,
    isFetching: isRefreshing,
    error,
    refetch,
  } = useQuery<MatchPanelGame[], Error>({
    queryKey: [SCHEDULE_QUERY_KEY, date?.toISOString() ?? 'today'],
    queryFn: () => getNBAMatchPanelGames(date),
    staleTime: SCHEDULE_STALE_TIME,
    refetchOnWindowFocus: true,
  });

  // Process and categorize games
  const { games, activeGames, liveGames, upcomingGames, completedGames, nextGame, liveGameIds } = useMemo(() => {
    if (!rawGames) {
      return {
        games: [],
        activeGames: [],
        liveGames: [],
        upcomingGames: [],
        completedGames: [],
        nextGame: null,
        liveGameIds: [],
      };
    }

    // Sort games by priority: live first, then upcoming by time, then completed
    const sortedGames = getGamesByPriority(rawGames);
    const active = getActiveGames(sortedGames);
    const categorized = categorizeGames(rawGames);
    const upcoming = getUpcomingGames(rawGames);
    
    // Find next game (first upcoming game)
    const now = new Date();
    const next = upcoming
      .filter(g => g.scheduledTime > now)
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())[0] || null;

    return {
      games: sortedGames,
      activeGames: active,
      liveGames: categorized.live,
      upcomingGames: categorized.upcoming,
      completedGames: categorized.completed,
      nextGame: next,
      liveGameIds: getLiveGameIds(rawGames),
    };
  }, [rawGames]);

  // Live polling for score updates
  const pollLiveGames = useCallback(async () => {
    if (liveGameIds.length === 0) return;

    const { updates } = await getNBALiveUpdates(liveGameIds);
    
    if (updates.length > 0) {
      queryClient.setQueryData<MatchPanelGame[]>(
        [SCHEDULE_QUERY_KEY, date?.toISOString() ?? 'today'],
        (old) => old ? applyLiveUpdatesToGames(old, updates) : old
      );
      lastUpdatedRef.current = new Date();
    }
  }, [liveGameIds, queryClient, date]);

  // Set up live polling
  useEffect(() => {
    if (!autoRefreshLive || liveGameIds.length === 0) {
      if (livePollingRef.current) {
        clearInterval(livePollingRef.current);
        livePollingRef.current = null;
      }
      return;
    }

    // Start polling
    pollLiveGames(); // Initial poll
    livePollingRef.current = setInterval(pollLiveGames, LIVE_POLL_INTERVAL);

    return () => {
      if (livePollingRef.current) {
        clearInterval(livePollingRef.current);
        livePollingRef.current = null;
      }
    };
  }, [autoRefreshLive, liveGameIds.length, pollLiveGames]);

  // Update lastUpdated when data changes
  useEffect(() => {
    if (rawGames) {
      lastUpdatedRef.current = new Date();
    }
  }, [rawGames]);

  return {
    games,
    activeGames,
    liveGames,
    upcomingGames,
    completedGames,
    nextGame,
    isLoading,
    isRefreshing,
    error: error ?? null,
    refetch,
    lastUpdated: lastUpdatedRef.current,
  };
}

/**
 * Hook for fetching a single game's detailed data
 */
export function useNBAGame(gameId: string | null) {
  return useQuery({
    queryKey: ['nba-game', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      const { getNBAGameSummary } = await import('@/services/api/sportradar');
      return getNBAGameSummary(gameId);
    },
    enabled: !!gameId,
    staleTime: 30 * 1000, // 30 seconds for live game data
    refetchInterval: (query) => {
      // Refetch every 30 seconds if game is live
      const data = query.state.data;
      if (data && (data.status === 'inprogress' || data.status === 'halftime')) {
        return 30 * 1000;
      }
      return false;
    },
  });
}
