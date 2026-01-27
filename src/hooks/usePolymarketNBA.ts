/**
 * Hook for fetching and managing Polymarket NBA market data
 * Provides market discovery, price updates, and game matching
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PolymarketSportsMarket, PolymarketGameMarkets, MatchPanelGame } from '@/types';
import { groupMarketsByGame } from '@/types';
import {
  getNBASportsMarkets,
  getAllNBAMarkets,
  findMarketForGame,
  findAllMarketsForGame,
  refreshMarketPrices,
  getNBAChampionshipOdds,
  getGameMarketData,
  invalidateCache as invalidateGammaCache,
  type GameMarketData,
  type ParsedGameMarket,
} from '@/services/api/polymarket';

// Query keys
const QUERY_KEYS = {
  nbaMarkets: ['polymarket', 'nba-markets'] as const,
  allNbaMarkets: ['polymarket', 'all-nba-markets'] as const,
  gameMarket: (gameId: string) => ['polymarket', 'game-market', gameId] as const,
  gameMarkets: (gameId: string) => ['polymarket', 'game-markets', gameId] as const,
  gameMarketData: (gameId: string) => ['polymarket', 'game-market-data', gameId] as const,
};

// Configuration
const MARKETS_STALE_TIME = 2 * 60 * 1000; // 2 minutes
const PRICE_REFRESH_INTERVAL = 30 * 1000; // 30 seconds

interface UsePolymarketNBAOptions {
  autoRefreshPrices?: boolean;
  enabled?: boolean;
}

interface UsePolymarketNBAResult {
  markets: PolymarketSportsMarket[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => void;
  getMarketForGame: (game: MatchPanelGame) => PolymarketSportsMarket | null;
  lastUpdated: Date | null;
}

/**
 * Main hook for NBA markets
 * Fetches primary moneyline markets for all NBA events
 */
export function usePolymarketNBA(options: UsePolymarketNBAOptions = {}): UsePolymarketNBAResult {
  const { autoRefreshPrices = true, enabled = true } = options;
  const queryClient = useQueryClient();
  const pricePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdatedRef = useRef<Date | null>(null);

  // Main markets query
  const {
    data: markets = [],
    isLoading,
    isFetching: isRefreshing,
    error,
    refetch,
  } = useQuery<PolymarketSportsMarket[], Error>({
    queryKey: QUERY_KEYS.nbaMarkets,
    queryFn: getNBASportsMarkets,
    staleTime: MARKETS_STALE_TIME,
    refetchOnWindowFocus: true,
    enabled,
  });

  // Find market for a specific game
  const getMarketForGame = useCallback((game: MatchPanelGame): PolymarketSportsMarket | null => {
    // Safely extract team info with fallbacks
    const homeTeamData = game.home?.team;
    const awayTeamData = game.away?.team;
    
    if (!homeTeamData || !awayTeamData) return null;
    
    const homeTeam = `${homeTeamData.market || ''} ${homeTeamData.name || ''}`.toLowerCase().trim();
    const awayTeam = `${awayTeamData.market || ''} ${awayTeamData.name || ''}`.toLowerCase().trim();
    const homeAlias = (homeTeamData.alias || '').toLowerCase();
    const awayAlias = (awayTeamData.alias || '').toLowerCase();
    const homeName = (homeTeamData.name || '').toLowerCase();
    const awayName = (awayTeamData.name || '').toLowerCase();

    for (const market of markets) {
      // Skip markets without eventTitle
      if (!market?.eventTitle) continue;
      
      const title = market.eventTitle.toLowerCase();
      
      const hasHome = (homeTeam && title.includes(homeTeam)) || 
                      (homeName && title.includes(homeName)) ||
                      (homeAlias && title.includes(homeAlias));
      const hasAway = (awayTeam && title.includes(awayTeam)) || 
                      (awayName && title.includes(awayName)) ||
                      (awayAlias && title.includes(awayAlias));

      if (hasHome && hasAway) {
        return market;
      }
    }

    return null;
  }, [markets]);

  // Price refresh polling
  const refreshPrices = useCallback(async () => {
    if (markets.length === 0) return;

    try {
      const updatedMarkets = await refreshMarketPrices(markets);
      
      // Only update if markets actually changed to prevent unnecessary re-renders
      const hasChanges = updatedMarkets.some((market, index) => {
        const original = markets[index];
        if (!original) return true;
        // Check if any outcome prices changed
        return market.market.outcomes.some((outcome, oIndex) => {
          const originalOutcome = original.market.outcomes[oIndex];
          return originalOutcome && outcome.price !== originalOutcome.price;
        });
      });

      if (hasChanges) {
        queryClient.setQueryData<PolymarketSportsMarket[]>(
          QUERY_KEYS.nbaMarkets,
          updatedMarkets
        );
        lastUpdatedRef.current = new Date();
      }
    } catch {
      // Silently handle errors to prevent jittering - no logging
    }
  }, [markets, queryClient]);

  // Set up price refresh polling
  useEffect(() => {
    if (!autoRefreshPrices || markets.length === 0) {
      if (pricePollingRef.current) {
        clearInterval(pricePollingRef.current);
        pricePollingRef.current = null;
      }
      return;
    }

    pricePollingRef.current = setInterval(refreshPrices, PRICE_REFRESH_INTERVAL);

    return () => {
      if (pricePollingRef.current) {
        clearInterval(pricePollingRef.current);
        pricePollingRef.current = null;
      }
    };
  }, [autoRefreshPrices, markets.length, refreshPrices]);

  // Update lastUpdated when data changes
  useEffect(() => {
    if (markets.length > 0) {
      lastUpdatedRef.current = new Date();
    }
  }, [markets]);

  return {
    markets,
    isLoading,
    isRefreshing,
    error: error ?? null,
    refetch,
    getMarketForGame,
    lastUpdated: lastUpdatedRef.current,
  };
}

/**
 * Hook for all NBA market types (MONEYLINE, SPREAD, TOTAL, PROPS)
 */
export function useAllPolymarketNBAMarkets(options: UsePolymarketNBAOptions = {}) {
  const { autoRefreshPrices = true, enabled = true } = options;
  const queryClient = useQueryClient();
  const pricePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    data: markets = [],
    isLoading,
    isFetching: isRefreshing,
    error,
    refetch,
  } = useQuery<PolymarketSportsMarket[], Error>({
    queryKey: QUERY_KEYS.allNbaMarkets,
    queryFn: getAllNBAMarkets,
    staleTime: MARKETS_STALE_TIME,
    refetchOnWindowFocus: true,
    enabled,
  });

  // Group markets by game
  const groupedMarkets = useCallback((): PolymarketGameMarkets[] => {
    return groupMarketsByGame(markets);
  }, [markets]);

  // Price refresh
  const refreshPrices = useCallback(async () => {
    if (markets.length === 0) return;

    try {
      const updatedMarkets = await refreshMarketPrices(markets);
      
      // Only update if markets actually changed to prevent unnecessary re-renders
      const hasChanges = updatedMarkets.some((market, index) => {
        const original = markets[index];
        if (!original) return true;
        // Check if any outcome prices changed
        return market.market.outcomes.some((outcome, oIndex) => {
          const originalOutcome = original.market.outcomes[oIndex];
          return originalOutcome && outcome.price !== originalOutcome.price;
        });
      });

      if (hasChanges) {
        queryClient.setQueryData<PolymarketSportsMarket[]>(
          QUERY_KEYS.allNbaMarkets,
          updatedMarkets
        );
      }
    } catch {
      // Silently handle errors to prevent jittering - no logging
    }
  }, [markets, queryClient]);

  // Set up price refresh polling
  useEffect(() => {
    if (!autoRefreshPrices || markets.length === 0) {
      if (pricePollingRef.current) {
        clearInterval(pricePollingRef.current);
        pricePollingRef.current = null;
      }
      return;
    }

    pricePollingRef.current = setInterval(refreshPrices, PRICE_REFRESH_INTERVAL);

    return () => {
      if (pricePollingRef.current) {
        clearInterval(pricePollingRef.current);
        pricePollingRef.current = null;
      }
    };
  }, [autoRefreshPrices, markets.length, refreshPrices]);

  return {
    markets,
    groupedMarkets: groupedMarkets(),
    isLoading,
    isRefreshing,
    error: error ?? null,
    refetch,
  };
}

/**
 * Hook for fetching market data for a specific game
 */
export function usePolymarketForGame(game: MatchPanelGame | null) {
  return useQuery<PolymarketSportsMarket | null, Error>({
    queryKey: QUERY_KEYS.gameMarket(game?.id ?? ''),
    queryFn: async () => {
      if (!game) return null;
      return findMarketForGame(game.home.team, game.away.team);
    },
    enabled: !!game,
    staleTime: MARKETS_STALE_TIME,
  });
}

/**
 * Hook for fetching all market types for a specific game
 */
export function useAllPolymarketForGame(game: MatchPanelGame | null) {
  const {
    data: markets = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<PolymarketSportsMarket[], Error>({
    queryKey: QUERY_KEYS.gameMarkets(game?.id ?? ''),
    queryFn: async () => {
      if (!game) return [];
      return findAllMarketsForGame(game.home.team, game.away.team);
    },
    enabled: !!game,
    staleTime: MARKETS_STALE_TIME,
  });

  // Organize by market type
  const marketsByType = useCallback(() => {
    const result: {
      moneyline: PolymarketSportsMarket | null;
      spread: PolymarketSportsMarket | null;
      total: PolymarketSportsMarket | null;
      props: PolymarketSportsMarket[];
    } = {
      moneyline: null,
      spread: null,
      total: null,
      props: [],
    };

    for (const market of markets) {
      switch (market.market.sportsMarketType) {
        case 'MONEYLINE':
          result.moneyline = market;
          break;
        case 'SPREAD':
          result.spread = market;
          break;
        case 'TOTAL':
          result.total = market;
          break;
        case 'PROP':
          result.props.push(market);
          break;
      }
    }

    return result;
  }, [markets]);

  return {
    markets,
    marketsByType: marketsByType(),
    isLoading,
    isRefreshing: isFetching,
    error: error ?? null,
    refetch,
  };
}

/**
 * Invalidate all Polymarket caches
 */
export function useInvalidatePolymarketCache() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    // Invalidate React Query cache
    queryClient.invalidateQueries({ queryKey: ['polymarket'] });
    
    // Invalidate service layer cache
    invalidateGammaCache();
  }, [queryClient]);
}

/**
 * Hook for fetching all NBA Championship odds
 */
export function useNBAChampionshipOdds(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery<Record<string, { odds: number; volume: string; marketId: string }>, Error>({
    queryKey: ['polymarket', 'championship-odds'] as const,
    queryFn: getNBAChampionshipOdds,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

export interface ChampionshipOddsResult {
  homeOdds: number | null;
  awayOdds: number | null;
  homeVolume: string | null;
  awayVolume: string | null;
  homeMarketId: string | null;
  awayMarketId: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching championship odds for teams in a specific game
 */
export function useChampionshipOddsForGame(game: MatchPanelGame | null): ChampionshipOddsResult {
  // Fetch all championship odds first
  const championshipOddsQuery = useNBAChampionshipOdds({ enabled: !!game });
  
  // Extract team odds from the object
  const result = useMemo((): Omit<ChampionshipOddsResult, 'isLoading' | 'error'> => {
    const defaultResult = {
      homeOdds: null,
      awayOdds: null,
      homeVolume: null,
      awayVolume: null,
      homeMarketId: null,
      awayMarketId: null,
    };

    if (!game || !championshipOddsQuery.data) {
      return defaultResult;
    }

    const homeTeam = game.home?.team;
    const awayTeam = game.away?.team;
    
    // Ensure team data exists (only name is required, market may be missing)
    if (!homeTeam?.name || !awayTeam?.name) {
      return defaultResult;
    }

    const allOdds = championshipOddsQuery.data;
    
    // Check if allOdds is empty
    if (Object.keys(allOdds).length === 0) {
      return defaultResult;
    }
    
    let homeOdds: { odds: number; volume: string; marketId: string } | null = null;
    let awayOdds: { odds: number; volume: string; marketId: string } | null = null;

    // The team name may be the full name like "Charlotte Hornets" or just the mascot
    const homeNameLower = homeTeam.name.toLowerCase();
    const homeMarketLower = homeTeam.market?.toLowerCase() || '';
    const awayNameLower = awayTeam.name.toLowerCase();
    const awayMarketLower = awayTeam.market?.toLowerCase() || '';

    for (const [teamName, odds] of Object.entries(allOdds)) {
      const teamNameLower = teamName.toLowerCase();
      
      // Check home team - match either the full name or the market
      // "charlotte hornets" should match team with name "Charlotte Hornets"
      if (homeNameLower.includes(teamNameLower) ||
          teamNameLower.includes(homeNameLower) ||
          (homeMarketLower && teamNameLower.includes(homeMarketLower))) {
        homeOdds = odds;
      }
      
      // Check away team  
      if (awayNameLower.includes(teamNameLower) ||
          teamNameLower.includes(awayNameLower) ||
          (awayMarketLower && teamNameLower.includes(awayMarketLower))) {
        awayOdds = odds;
      }
    }

    return {
      homeOdds: homeOdds?.odds ?? null,
      awayOdds: awayOdds?.odds ?? null,
      homeVolume: homeOdds?.volume ?? null,
      awayVolume: awayOdds?.volume ?? null,
      homeMarketId: homeOdds?.marketId ?? null,
      awayMarketId: awayOdds?.marketId ?? null,
    };
  }, [game, championshipOddsQuery.data]);

  return {
    ...result,
    isLoading: championshipOddsQuery.isLoading,
    error: championshipOddsQuery.error ?? null,
  };
}

// ============================================================================
// PER-GAME MARKET DATA HOOK
// Fetches actual game betting markets (moneyline, spread, totals)
// ============================================================================

export interface GameMarketResult {
  data: GameMarketData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  // Convenience getters
  moneyline: ParsedGameMarket | null;
  bestSpread: ParsedGameMarket | null;
  bestTotal: ParsedGameMarket | null;
  hasMarkets: boolean;
  totalVolume: number;
}

/**
 * Hook for fetching complete market data for a specific game
 * Returns moneyline, spread, and total markets from Polymarket
 */
export function useGameMarketData(game: MatchPanelGame | null): GameMarketResult {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<GameMarketData | null, Error>({
    queryKey: QUERY_KEYS.gameMarketData(game?.id ?? ''),
    queryFn: async () => {
      if (!game) return null;
      
      const homeTeam = game.home?.team;
      const awayTeam = game.away?.team;
      
      if (!homeTeam || !awayTeam) return null;
      
      // Use the game's scheduled time for the date
      const gameDate = game.scheduledTime ? new Date(game.scheduledTime) : new Date();
      
      try {
        return await getGameMarketData(
          { 
            name: homeTeam.name, 
            market: homeTeam.market, 
            alias: homeTeam.alias 
          },
          { 
            name: awayTeam.name, 
            market: awayTeam.market, 
            alias: awayTeam.alias 
          },
          gameDate
        );
      } catch {
        // Silently handle errors to prevent jittering - no logging
        return null;
      }
    },
    enabled: !!game,
    staleTime: MARKETS_STALE_TIME,
    refetchOnWindowFocus: false, // Disabled to prevent jittering from refetches
    retry: false, // Don't retry on 404s or other errors
  });

  const hasMarkets = Boolean(
    data && (
      data.moneyline !== null || 
      data.spreads.length > 0 || 
      data.totals.length > 0
    )
  );

  return {
    data: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
    // Convenience getters
    moneyline: data?.moneyline ?? null,
    bestSpread: data?.spreads[0] ?? null,
    bestTotal: data?.totals[0] ?? null,
    hasMarkets,
    totalVolume: data?.totalVolume ?? 0,
  };
}
