/**
 * NBA Live Game WebSocket Service
 * Provides real-time game updates via polling or WebSocket
 * 
 * Note: Sportradar Push Feeds require a persistent server connection.
 * For browser-based apps, we use a polling strategy with configurable intervals.
 * This service abstracts the polling to provide a WebSocket-like API.
 */

import type { MatchPanelGame } from '@/types';
import { getNBALiveUpdates, applyLiveUpdatesToGames, getLiveGameIds } from '@/services/api/sportradar';

export type NBALiveEventType = 'scoreUpdate' | 'statusChange' | 'clockUpdate' | 'connected' | 'disconnected' | 'error';

export interface NBALiveEvent {
  type: NBALiveEventType;
  gameId?: string;
  data?: {
    homeScore?: number;
    awayScore?: number;
    status?: string;
    clock?: string;
    quarter?: number;
  };
  message?: string;
  timestamp: Date;
}

export type NBALiveEventHandler = (event: NBALiveEvent) => void;

interface NBALiveSocketConfig {
  pollIntervalMs?: number;
  onEvent?: NBALiveEventHandler;
}

const DEFAULT_POLL_INTERVAL = 15000; // 15 seconds

class NBALiveSocketService {
  private pollInterval: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private currentGames: MatchPanelGame[] = [];
  private previousScores: Map<string, { home: number; away: number }> = new Map();
  private eventHandlers: Set<NBALiveEventHandler> = new Set();
  private pollIntervalMs: number = DEFAULT_POLL_INTERVAL;

  /**
   * Start listening for live game updates
   */
  connect(games: MatchPanelGame[], config?: NBALiveSocketConfig): void {
    if (this.isConnected) {
      this.disconnect();
    }

    this.currentGames = games;
    this.pollIntervalMs = config?.pollIntervalMs || DEFAULT_POLL_INTERVAL;
    
    if (config?.onEvent) {
      this.eventHandlers.add(config.onEvent);
    }

    // Initialize previous scores
    this.previousScores.clear();
    for (const game of games) {
      this.previousScores.set(game.id, {
        home: game.home.score,
        away: game.away.score,
      });
    }

    this.isConnected = true;
    this.emit({
      type: 'connected',
      message: `Connected to live updates for ${games.length} games`,
      timestamp: new Date(),
    });

    // Start polling
    this.startPolling();
  }

  /**
   * Stop listening for updates
   */
  disconnect(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isConnected = false;
    this.emit({
      type: 'disconnected',
      message: 'Disconnected from live updates',
      timestamp: new Date(),
    });
  }

  /**
   * Update the list of games being monitored
   */
  updateGames(games: MatchPanelGame[]): void {
    this.currentGames = games;
    
    // Update score tracking for new games
    for (const game of games) {
      if (!this.previousScores.has(game.id)) {
        this.previousScores.set(game.id, {
          home: game.home.score,
          away: game.away.score,
        });
      }
    }
  }

  /**
   * Add an event handler
   */
  on(handler: NBALiveEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Remove an event handler
   */
  off(handler: NBALiveEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Get connection status
   */
  getStatus(): { isConnected: boolean; gamesMonitored: number } {
    return {
      isConnected: this.isConnected,
      gamesMonitored: this.currentGames.filter(g => g.isLive).length,
    };
  }

  /**
   * Force a poll now
   */
  async pollNow(): Promise<MatchPanelGame[]> {
    return this.poll();
  }

  private startPolling(): void {
    // Initial poll
    this.poll();

    // Set up interval
    this.pollInterval = setInterval(() => {
      this.poll();
    }, this.pollIntervalMs);
  }

  private async poll(): Promise<MatchPanelGame[]> {
    const liveGameIds = getLiveGameIds(this.currentGames);
    
    if (liveGameIds.length === 0) {
      return this.currentGames;
    }

    const { updates, errors } = await getNBALiveUpdates(liveGameIds);

    if (errors && errors.length > 0) {
      this.emit({
        type: 'error',
        message: `Failed to fetch updates for ${errors.length} games`,
        timestamp: new Date(),
      });
    }

    // Detect changes and emit events
    for (const update of updates) {
      const prev = this.previousScores.get(update.id);
      
      if (prev) {
        // Check for score changes
        if (update.home.points !== prev.home || update.away.points !== prev.away) {
          this.emit({
            type: 'scoreUpdate',
            gameId: update.id,
            data: {
              homeScore: update.home.points,
              awayScore: update.away.points,
            },
            timestamp: new Date(),
          });
        }

        // Check for status changes
        const prevGame = this.currentGames.find(g => g.id === update.id);
        if (prevGame && prevGame.status !== update.status) {
          this.emit({
            type: 'statusChange',
            gameId: update.id,
            data: {
              status: update.status,
            },
            timestamp: new Date(),
          });
        }

        // Check for clock updates
        if (update.clock || update.quarter) {
          this.emit({
            type: 'clockUpdate',
            gameId: update.id,
            data: {
              clock: update.clock,
              quarter: update.quarter,
            },
            timestamp: new Date(),
          });
        }
      }

      // Update stored scores
      this.previousScores.set(update.id, {
        home: update.home.points,
        away: update.away.points,
      });
    }

    // Apply updates to games
    const updatedGames = applyLiveUpdatesToGames(this.currentGames, updates);
    this.currentGames = updatedGames;

    return updatedGames;
  }

  private emit(event: NBALiveEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }
}

// Singleton instance
export const nbaLiveSocket = new NBALiveSocketService();

/**
 * React hook for using the NBA live socket
 */
export function createNBALiveConnection(
  games: MatchPanelGame[],
  onEvent?: NBALiveEventHandler
): {
  connect: () => void;
  disconnect: () => void;
  pollNow: () => Promise<MatchPanelGame[]>;
  updateGames: (games: MatchPanelGame[]) => void;
} {
  return {
    connect: () => nbaLiveSocket.connect(games, { onEvent }),
    disconnect: () => nbaLiveSocket.disconnect(),
    pollNow: () => nbaLiveSocket.pollNow(),
    updateGames: (games) => nbaLiveSocket.updateGames(games),
  };
}
