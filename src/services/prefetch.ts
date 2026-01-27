/**
 * Prefetch Service
 * Pre-populates React Query cache with critical data on app load
 * This reduces perceived latency by fetching common data before user interaction
 */

import type { QueryClient } from '@tanstack/react-query';
import { getTags, getSportsMetadata, getNBAEvents, getNBAChampionshipOdds } from '@/services/api/polymarket';
import { getNBAMatchPanelGames } from '@/services/api/sportradar';

/**
 * Query keys matching the hooks for cache sharing
 */
const QUERY_KEYS = {
  tags: ['polymarket', 'tags'] as const,
  sportsMetadata: ['polymarket', 'sports-metadata'] as const,
  nbaMarkets: ['polymarket', 'nba-markets'] as const,
  championshipOdds: ['polymarket', 'championship-odds'] as const,
  schedule: (date: string) => ['nba-schedule', date] as const,
};

/**
 * Prefetch critical data that's commonly needed
 * Called once on app initialization
 */
export async function prefetchCriticalData(queryClient: QueryClient): Promise<void> {
  // Get today's date string for schedule key
  const today = new Date().toISOString();

  // Prefetch in parallel - these are independent queries
  const prefetchPromises = [
    // Tags - used for market discovery, very stable data (24h cache)
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.tags,
      queryFn: getTags,
      staleTime: 24 * 60 * 60 * 1000, // 24 hours
    }),

    // Sports metadata - league info, rarely changes
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.sportsMetadata,
      queryFn: getSportsMetadata,
      staleTime: 24 * 60 * 60 * 1000, // 24 hours
    }),

    // Today's NBA schedule - most commonly needed
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.schedule(today),
      queryFn: () => getNBAMatchPanelGames(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

    // Championship odds - shown on match cards
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.championshipOdds,
      queryFn: getNBAChampionshipOdds,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  ];

  // Execute all prefetches in parallel
  // Use Promise.allSettled to not fail if one prefetch fails
  await Promise.allSettled(prefetchPromises);

  // Prefetch NBA events after initial data (depends on tags)
  // This is deferred slightly to prioritize schedule/championship data
  queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.nbaMarkets,
    queryFn: () => getNBAEvents(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Prefetch tomorrow's schedule (called after initial load)
 * Useful for users viewing end-of-day games
 */
export async function prefetchTomorrowSchedule(queryClient: QueryClient): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString();

  await queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.schedule(tomorrowStr),
    queryFn: () => getNBAMatchPanelGames(tomorrow),
    staleTime: 10 * 60 * 1000, // 10 minutes for future schedule
  });
}

/**
 * Prefetch data for a specific game
 * Called when user hovers over or is about to view a game
 */
export async function prefetchGameData(
  queryClient: QueryClient,
  gameId: string,
  homeTeam: { name: string; market?: string; alias: string },
  awayTeam: { name: string; market?: string; alias: string }
): Promise<void> {
  const { getGameMarketData } = await import('@/services/api/polymarket');
  
  await queryClient.prefetchQuery({
    queryKey: ['polymarket', 'game-market-data', gameId],
    queryFn: () => getGameMarketData(homeTeam, awayTeam),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
