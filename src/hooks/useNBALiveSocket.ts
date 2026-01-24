/**
 * React Hook for NBA Live Game WebSocket
 * Provides real-time game updates with automatic connection management
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import type { MatchPanelGame } from '@/types';
import { 
  nbaLiveSocket, 
  type NBALiveEvent, 
  type NBALiveEventHandler 
} from '@/services/websocket/nbaLiveSocket';

interface UseNBALiveSocketOptions {
  /** Games to monitor for live updates */
  games: MatchPanelGame[];
  /** Whether to automatically connect when there are live games */
  autoConnect?: boolean;
  /** Callback for score updates */
  onScoreUpdate?: (gameId: string, homeScore: number, awayScore: number) => void;
  /** Callback for status changes */
  onStatusChange?: (gameId: string, status: string) => void;
  /** Callback for any event */
  onEvent?: NBALiveEventHandler;
  /** Custom poll interval in ms (default: 15000) */
  pollIntervalMs?: number;
}

interface UseNBALiveSocketResult {
  /** Whether currently connected to live updates */
  isConnected: boolean;
  /** Number of live games being monitored */
  liveGameCount: number;
  /** Last event received */
  lastEvent: NBALiveEvent | null;
  /** Manually connect to live updates */
  connect: () => void;
  /** Disconnect from live updates */
  disconnect: () => void;
  /** Force a poll now */
  pollNow: () => Promise<MatchPanelGame[]>;
}

export function useNBALiveSocket(options: UseNBALiveSocketOptions): UseNBALiveSocketResult {
  const {
    games,
    autoConnect = true,
    onScoreUpdate,
    onStatusChange,
    onEvent,
    pollIntervalMs,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<NBALiveEvent | null>(null);
  const callbacksRef = useRef({ onScoreUpdate, onStatusChange, onEvent });

  // Update callbacks ref
  useEffect(() => {
    callbacksRef.current = { onScoreUpdate, onStatusChange, onEvent };
  }, [onScoreUpdate, onStatusChange, onEvent]);

  // Event handler
  const handleEvent = useCallback((event: NBALiveEvent) => {
    setLastEvent(event);

    // Handle specific event types
    switch (event.type) {
      case 'connected':
        setIsConnected(true);
        break;
      case 'disconnected':
        setIsConnected(false);
        break;
      case 'scoreUpdate':
        if (event.gameId && event.data?.homeScore !== undefined && event.data?.awayScore !== undefined) {
          callbacksRef.current.onScoreUpdate?.(
            event.gameId,
            event.data.homeScore,
            event.data.awayScore
          );
        }
        break;
      case 'statusChange':
        if (event.gameId && event.data?.status) {
          callbacksRef.current.onStatusChange?.(event.gameId, event.data.status);
        }
        break;
    }

    // Call general event handler
    callbacksRef.current.onEvent?.(event);
  }, []);

  // Connect function
  const connect = useCallback(() => {
    nbaLiveSocket.connect(games, {
      pollIntervalMs,
      onEvent: handleEvent,
    });
  }, [games, pollIntervalMs, handleEvent]);

  // Disconnect function
  const disconnect = useCallback(() => {
    nbaLiveSocket.disconnect();
  }, []);

  // Poll now function
  const pollNow = useCallback(() => {
    return nbaLiveSocket.pollNow();
  }, []);

  // Auto-connect when there are live games
  useEffect(() => {
    const liveGames = games.filter(g => g.isLive);
    
    if (autoConnect && liveGames.length > 0) {
      connect();
    } else if (liveGames.length === 0 && isConnected) {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, games, connect, disconnect, isConnected]);

  // Update games when they change
  useEffect(() => {
    if (isConnected) {
      nbaLiveSocket.updateGames(games);
    }
  }, [games, isConnected]);

  const liveGameCount = games.filter(g => g.isLive).length;

  return {
    isConnected,
    liveGameCount,
    lastEvent,
    connect,
    disconnect,
    pollNow,
  };
}

/**
 * Simple hook for score flash animation
 * Returns true for a short period after a score update
 */
export function useScoreFlash(_gameId: string, score: number): boolean {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (score !== prevScoreRef.current && prevScoreRef.current > 0) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 1000);
      prevScoreRef.current = score;
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = score;
  }, [score]);

  return isFlashing;
}
