/**
 * Hook for fetching and managing Polymarket orderbook data
 * Provides bid/ask depth, spread metrics, and aggregated levels
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { PolymarketOrderbook, PolymarketSportsMarket } from '@/types';
import {
  getOrderbook,
  getOrderbooks,
  calculateOrderbookMetrics,
  aggregateOrderbook,
} from '@/services/api/polymarket';

// Query keys
const QUERY_KEYS = {
  orderbook: (tokenId: string) => ['polymarket', 'orderbook', tokenId] as const,
  marketOrderbooks: (marketId: string) => ['polymarket', 'market-orderbooks', marketId] as const,
};

// Configuration
const ORDERBOOK_STALE_TIME = 10 * 1000; // 10 seconds - orderbooks change frequently
const ORDERBOOK_REFETCH_INTERVAL = 15 * 1000; // 15 seconds

/**
 * Aggregated orderbook level for display
 */
export interface AggregatedLevel {
  price: number;
  size: number;
  total: number;
  percentage: number; // Percentage of max total for visualization
}

/**
 * Orderbook metrics for display
 */
export interface OrderbookDisplayMetrics {
  bestBid: number | null;
  bestAsk: number | null;
  midpoint: number | null;
  spread: number | null;
  spreadCents: number | null;
  spreadBps: number | null;
  bidDepth: number;
  askDepth: number;
  imbalance: number; // -1 to 1, positive means more bids
  imbalancePercentage: number; // 0-100 for visualization
}

/**
 * Hook for fetching a single orderbook
 */
export function useOrderbook(tokenId: string | null, options: {
  enabled?: boolean;
  refetchInterval?: number | false;
} = {}) {
  const { enabled = true, refetchInterval = ORDERBOOK_REFETCH_INTERVAL } = options;

  const {
    data: orderbook,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<PolymarketOrderbook, Error>({
    queryKey: QUERY_KEYS.orderbook(tokenId ?? ''),
    queryFn: () => getOrderbook(tokenId!),
    enabled: !!tokenId && enabled,
    staleTime: ORDERBOOK_STALE_TIME,
    refetchInterval: refetchInterval,
  });

  // Calculate metrics
  const metrics = useMemo((): OrderbookDisplayMetrics | null => {
    if (!orderbook) return null;

    const rawMetrics = calculateOrderbookMetrics(orderbook);
    
    return {
      bestBid: rawMetrics.bestBid,
      bestAsk: rawMetrics.bestAsk,
      midpoint: rawMetrics.midpoint,
      spread: rawMetrics.spread,
      spreadCents: rawMetrics.spread !== null ? Math.round(rawMetrics.spread * 100) : null,
      spreadBps: rawMetrics.spreadBps,
      bidDepth: rawMetrics.bidDepth,
      askDepth: rawMetrics.askDepth,
      imbalance: rawMetrics.imbalance,
      imbalancePercentage: ((rawMetrics.imbalance + 1) / 2) * 100, // Convert -1..1 to 0..100
    };
  }, [orderbook]);

  // Aggregate levels for display
  const aggregatedLevels = useMemo(() => {
    if (!orderbook) return { bids: [], asks: [] };

    const agg = aggregateOrderbook(orderbook, 10, 0.01);
    
    // Calculate max total for percentage calculation
    const maxBidTotal = agg.bids.length > 0 ? agg.bids[agg.bids.length - 1].total : 0;
    const maxAskTotal = agg.asks.length > 0 ? agg.asks[agg.asks.length - 1].total : 0;
    const maxTotal = Math.max(maxBidTotal, maxAskTotal);

    const bids: AggregatedLevel[] = agg.bids.map(level => ({
      ...level,
      percentage: maxTotal > 0 ? (level.total / maxTotal) * 100 : 0,
    }));

    const asks: AggregatedLevel[] = agg.asks.map(level => ({
      ...level,
      percentage: maxTotal > 0 ? (level.total / maxTotal) * 100 : 0,
    }));

    return { bids, asks };
  }, [orderbook]);

  return {
    orderbook,
    metrics,
    aggregatedLevels,
    isLoading,
    isRefreshing: isFetching,
    error: error ?? null,
    refetch,
  };
}

/**
 * Hook for fetching orderbooks for all outcomes in a market
 */
export function useMarketOrderbooks(market: PolymarketSportsMarket | null, options: {
  enabled?: boolean;
  refetchInterval?: number | false;
} = {}) {
  const { enabled = true, refetchInterval = ORDERBOOK_REFETCH_INTERVAL } = options;

  const tokenIds = useMemo(() => {
    if (!market) return [];
    return market.market.outcomes.map(o => o.tokenId).filter(Boolean);
  }, [market]);

  const {
    data: orderbooksMap,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<Map<string, PolymarketOrderbook>, Error>({
    queryKey: QUERY_KEYS.marketOrderbooks(market?.market.id ?? ''),
    queryFn: () => getOrderbooks(tokenIds),
    enabled: !!market && tokenIds.length > 0 && enabled,
    staleTime: ORDERBOOK_STALE_TIME,
    refetchInterval: refetchInterval,
  });

  // Get orderbook for a specific outcome
  const getOrderbookForOutcome = useCallback((tokenId: string): PolymarketOrderbook | null => {
    return orderbooksMap?.get(tokenId) ?? null;
  }, [orderbooksMap]);

  // Get metrics for each outcome
  const outcomeMetrics = useMemo(() => {
    if (!market || !orderbooksMap) return new Map<string, OrderbookDisplayMetrics>();

    const metricsMap = new Map<string, OrderbookDisplayMetrics>();

    for (const outcome of market.market.outcomes) {
      const orderbook = orderbooksMap.get(outcome.tokenId);
      if (!orderbook) continue;

      const rawMetrics = calculateOrderbookMetrics(orderbook);
      
      metricsMap.set(outcome.tokenId, {
        bestBid: rawMetrics.bestBid,
        bestAsk: rawMetrics.bestAsk,
        midpoint: rawMetrics.midpoint,
        spread: rawMetrics.spread,
        spreadCents: rawMetrics.spread !== null ? Math.round(rawMetrics.spread * 100) : null,
        spreadBps: rawMetrics.spreadBps,
        bidDepth: rawMetrics.bidDepth,
        askDepth: rawMetrics.askDepth,
        imbalance: rawMetrics.imbalance,
        imbalancePercentage: ((rawMetrics.imbalance + 1) / 2) * 100,
      });
    }

    return metricsMap;
  }, [market, orderbooksMap]);

  // Calculate aggregate market spread (average of outcome spreads)
  const marketSpread = useMemo(() => {
    if (outcomeMetrics.size === 0) return null;

    let totalSpread = 0;
    let count = 0;

    for (const metrics of outcomeMetrics.values()) {
      if (metrics.spread !== null) {
        totalSpread += metrics.spread;
        count++;
      }
    }

    return count > 0 ? totalSpread / count : null;
  }, [outcomeMetrics]);

  return {
    orderbooks: orderbooksMap ?? new Map(),
    getOrderbookForOutcome,
    outcomeMetrics,
    marketSpread,
    isLoading,
    isRefreshing: isFetching,
    error: error ?? null,
    refetch,
  };
}

/**
 * Hook to prefetch orderbooks for a list of markets
 */
export function usePrefetchOrderbooks() {
  const queryClient = useQueryClient();

  return useCallback(async (markets: PolymarketSportsMarket[]) => {
    for (const market of markets) {
      const tokenIds = market.market.outcomes.map(o => o.tokenId).filter(Boolean);
      
      if (tokenIds.length > 0) {
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.marketOrderbooks(market.market.id),
          queryFn: () => getOrderbooks(tokenIds),
          staleTime: ORDERBOOK_STALE_TIME,
        });
      }
    }
  }, [queryClient]);
}

/**
 * Format spread for display
 */
export function formatSpreadDisplay(spread: number | null): string {
  if (spread === null) return '-';
  const cents = Math.round(spread * 100);
  return `${cents}¢`;
}

/**
 * Format depth for display
 */
export function formatDepthDisplay(depth: number): string {
  if (depth >= 1000000) {
    return `${(depth / 1000000).toFixed(1)}M`;
  }
  if (depth >= 1000) {
    return `${(depth / 1000).toFixed(1)}K`;
  }
  return depth.toFixed(0);
}

/**
 * Get imbalance indicator
 */
export function getImbalanceIndicator(imbalance: number): 'bid' | 'ask' | 'neutral' {
  if (imbalance > 0.1) return 'bid';
  if (imbalance < -0.1) return 'ask';
  return 'neutral';
}
