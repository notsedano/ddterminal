/**
 * Hook for real-time Polymarket data via WebSocket
 * Provides live price updates and sports scores
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PolymarketSportsMarket, PolymarketOrderbook } from '@/types';
import {
  getCLOBWebSocket,
  getSportsWebSocket,
  type ConnectionState,
  type MarketDataUpdate,
  type SportsDataUpdate,
} from '@/services/api/polymarket';

/**
 * Hook for CLOB WebSocket connection and price updates
 */
export function usePolymarketPriceSocket(options: {
  tokenIds?: string[];
  onPriceUpdate?: (update: MarketDataUpdate) => void;
  onOrderbookUpdate?: (tokenId: string, orderbook: PolymarketOrderbook) => void;
  autoConnect?: boolean;
  updateQueryCache?: boolean;
} = {}) {
  const {
    tokenIds = [],
    onPriceUpdate,
    onOrderbookUpdate,
    autoConnect = true,
    updateQueryCache = true,
  } = options;

  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<MarketDataUpdate | null>(null);
  const socketRef = useRef(getCLOBWebSocket());

  // Handle connection state changes
  useEffect(() => {
    const unsubscribe = socketRef.current.onConnectionStateChange(setConnectionState);
    return unsubscribe;
  }, []);

  // Handle price updates
  useEffect(() => {
    const unsubscribe = socketRef.current.onMarketDataUpdate((update) => {
      setLastUpdate(update);
      
      // Call user callback
      if (onPriceUpdate) {
        onPriceUpdate(update);
      }

      // Update React Query cache
      if (updateQueryCache && update.type === 'price_update') {
        // Update the specific market in the cache
        queryClient.setQueriesData<PolymarketSportsMarket[]>(
          { queryKey: ['polymarket'] },
          (oldData) => {
            if (!oldData) return oldData;

            return oldData.map((market) => {
              const outcomeIndex = market.market.outcomes.findIndex(
                (o) => o.tokenId === update.tokenId
              );

              if (outcomeIndex === -1) return market;

              const updatedOutcomes = [...market.market.outcomes];
              updatedOutcomes[outcomeIndex] = {
                ...updatedOutcomes[outcomeIndex],
                price: update.price ?? updatedOutcomes[outcomeIndex].price,
                bestBid: update.bestBid ?? updatedOutcomes[outcomeIndex].bestBid,
                bestAsk: update.bestAsk ?? updatedOutcomes[outcomeIndex].bestAsk,
                spread: update.spread ?? updatedOutcomes[outcomeIndex].spread,
              };

              return {
                ...market,
                market: {
                  ...market.market,
                  outcomes: updatedOutcomes,
                  bestBid: outcomeIndex === 0 ? update.bestBid ?? market.market.bestBid : market.market.bestBid,
                  bestAsk: outcomeIndex === 0 ? update.bestAsk ?? market.market.bestAsk : market.market.bestAsk,
                  spread: outcomeIndex === 0 ? update.spread ?? market.market.spread : market.market.spread,
                },
                lastUpdated: new Date(),
              };
            });
          }
        );
      }
    });

    return unsubscribe;
  }, [onPriceUpdate, updateQueryCache, queryClient]);

  // Handle orderbook updates
  useEffect(() => {
    if (!onOrderbookUpdate) return;

    const unsubscribe = socketRef.current.onOrderbookUpdate(onOrderbookUpdate);
    return unsubscribe;
  }, [onOrderbookUpdate]);

  // Subscribe to token IDs
  useEffect(() => {
    if (tokenIds.length === 0) return;

    if (autoConnect && connectionState === 'disconnected') {
      socketRef.current.connect();
    }

    socketRef.current.subscribe(tokenIds);

    return () => {
      // Don't unsubscribe on unmount to avoid unnecessary disconnects
      // The singleton manages subscriptions globally
    };
  }, [tokenIds, autoConnect, connectionState]);

  // Connect/disconnect functions
  const connect = useCallback(() => {
    socketRef.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current.disconnect();
  }, []);

  const subscribe = useCallback((ids: string[]) => {
    socketRef.current.subscribe(ids);
  }, []);

  const unsubscribe = useCallback((ids: string[]) => {
    socketRef.current.unsubscribe(ids);
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    lastUpdate,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}

/**
 * Hook for Sports WebSocket connection and live scores
 */
export function usePolymarketSportsSocket(options: {
  onScoreUpdate?: (update: SportsDataUpdate) => void;
  autoConnect?: boolean;
  filterLeague?: string;
} = {}) {
  const {
    onScoreUpdate,
    autoConnect = true,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [games, setGames] = useState<Map<number, SportsDataUpdate>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<SportsDataUpdate | null>(null);
  const socketRef = useRef(getSportsWebSocket());

  // Handle connection state changes
  useEffect(() => {
    const unsubscribe = socketRef.current.onConnectionStateChange(setConnectionState);
    return unsubscribe;
  }, []);

  // Handle sports data updates
  useEffect(() => {
    const unsubscribe = socketRef.current.onSportsDataUpdate((update) => {
      setLastUpdate(update);
      
      // Update games map
      setGames((prev) => {
        const newMap = new Map(prev);
        newMap.set(update.gameId, update);
        return newMap;
      });

      // Call user callback
      if (onScoreUpdate) {
        onScoreUpdate(update);
      }
    });

    return unsubscribe;
  }, [onScoreUpdate]);

  // Auto-connect
  useEffect(() => {
    if (autoConnect && connectionState === 'disconnected') {
      socketRef.current.connect();
    }
  }, [autoConnect, connectionState]);

  // Connect/disconnect functions
  const connect = useCallback(() => {
    socketRef.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current.disconnect();
  }, []);

  // Get game data by ID
  const getGameData = useCallback((gameId: number): SportsDataUpdate | undefined => {
    return games.get(gameId);
  }, [games]);

  // Get all live games
  const liveGames = Array.from(games.values()).filter(g => g.live && !g.ended);

  // Get all games as array
  const allGames = Array.from(games.values());

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    games,
    liveGames,
    allGames,
    lastUpdate,
    getGameData,
    connect,
    disconnect,
  };
}

/**
 * Combined hook for both price and sports WebSocket data
 */
export function usePolymarketLiveData(options: {
  markets?: PolymarketSportsMarket[];
  onPriceUpdate?: (update: MarketDataUpdate) => void;
  onScoreUpdate?: (update: SportsDataUpdate) => void;
  autoConnect?: boolean;
} = {}) {
  const {
    markets = [],
    onPriceUpdate,
    onScoreUpdate,
    autoConnect = true,
  } = options;

  // Extract token IDs from markets
  const tokenIds = markets.flatMap((m) =>
    m.market.outcomes.map((o) => o.tokenId).filter(Boolean)
  );

  // Price socket
  const priceSocket = usePolymarketPriceSocket({
    tokenIds,
    onPriceUpdate,
    autoConnect,
  });

  // Sports socket
  const sportsSocket = usePolymarketSportsSocket({
    onScoreUpdate,
    autoConnect,
  });

  return {
    price: priceSocket,
    sports: sportsSocket,
    isConnected: priceSocket.isConnected && sportsSocket.isConnected,
  };
}

/**
 * Hook to subscribe a market to price updates
 */
export function useSubscribeMarket(market: PolymarketSportsMarket | null) {
  const socketRef = useRef(getCLOBWebSocket());

  useEffect(() => {
    if (!market) return;

    const tokenIds = market.market.outcomes
      .map((o) => o.tokenId)
      .filter(Boolean);

    if (tokenIds.length === 0) return;

    // Connect if not already connected
    if (socketRef.current.getConnectionState() === 'disconnected') {
      socketRef.current.connect();
    }

    socketRef.current.subscribe(tokenIds);

    return () => {
      socketRef.current.unsubscribe(tokenIds);
    };
  }, [market]);
}
