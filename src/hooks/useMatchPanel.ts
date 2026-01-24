/**
 * Main hook for the Match Panel component
 * Combines NBA schedule data, Polymarket market data, and navigation state
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { MatchPanelGame, PolymarketSportsMarket } from '@/types';
import { useNBASchedule } from './useNBASchedule';
import { usePolymarketNBA } from './usePolymarketNBA';

export interface MatchWithMarket {
  game: MatchPanelGame;
  market: PolymarketSportsMarket | null;
}

interface UseMatchPanelOptions {
  autoRefresh?: boolean;
  showCompletedGames?: boolean;
}

interface UseMatchPanelResult {
  // Current state
  currentMatch: MatchWithMarket | null;
  currentIndex: number;
  totalMatches: number;
  
  // All matches (sorted by priority: live > upcoming > completed)
  matches: MatchWithMarket[];
  
  // Categorized matches
  liveMatches: MatchWithMarket[];
  upcomingMatches: MatchWithMarket[];
  completedMatches: MatchWithMarket[];
  
  // Next game info
  nextGame: MatchPanelGame | null;
  
  // Navigation
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Errors
  scheduleError: Error | null;
  marketError: Error | null;
  
  // Refresh
  refresh: () => void;
  
  // Timestamps
  lastUpdated: Date | null;
  
  // Status helpers
  hasLiveGames: boolean;
  liveGameCount: number;
  upcomingGameCount: number;
}

export function useMatchPanel(options: UseMatchPanelOptions = {}): UseMatchPanelResult {
  const { autoRefresh = true, showCompletedGames = true } = options;
  
  // State for current match index
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasInitializedRef = useRef(false);

  // Fetch NBA schedule
  const {
    games,
    activeGames,
    liveGames,
    upcomingGames,
    completedGames: _completedGames,
    nextGame,
    isLoading: scheduleLoading,
    isRefreshing: scheduleRefreshing,
    error: scheduleError,
    refetch: refetchSchedule,
    lastUpdated: scheduleLastUpdated,
  } = useNBASchedule({ autoRefreshLive: autoRefresh });

  // Fetch Polymarket markets
  const {
    isLoading: marketLoading,
    isRefreshing: marketRefreshing,
    error: marketError,
    refetch: refetchMarkets,
    getMarketForGame,
    lastUpdated: marketLastUpdated,
  } = usePolymarketNBA({ autoRefreshPrices: autoRefresh });

  // Determine which games to show - always prioritize by: live > upcoming > completed
  const displayGames = useMemo(() => {
    if (showCompletedGames) {
      return games; // Already sorted by priority
    }
    return activeGames;
  }, [games, activeGames, showCompletedGames]);

  // Combine games with their matching markets
  const matches = useMemo<MatchWithMarket[]>(() => {
    return displayGames.map(game => ({
      game,
      market: getMarketForGame(game),
    }));
  }, [displayGames, getMarketForGame]);

  // Categorize matches
  const { liveMatches, upcomingMatches, completedMatches } = useMemo(() => {
    const live: MatchWithMarket[] = [];
    const upcoming: MatchWithMarket[] = [];
    const completed: MatchWithMarket[] = [];

    for (const match of matches) {
      if (match.game.isLive) {
        live.push(match);
      } else if (
        match.game.status === 'scheduled' ||
        match.game.status === 'created' ||
        match.game.status === 'time-tbd'
      ) {
        upcoming.push(match);
      } else if (
        match.game.status === 'complete' ||
        match.game.status === 'closed'
      ) {
        completed.push(match);
      }
    }

    return { liveMatches: live, upcomingMatches: upcoming, completedMatches: completed };
  }, [matches]);

  // Ensure currentIndex is within bounds
  useEffect(() => {
    if (matches.length > 0 && currentIndex >= matches.length) {
      setCurrentIndex(matches.length - 1);
    }
  }, [matches.length, currentIndex]);

  // Auto-select best game on initial load
  // Priority: first live game > first upcoming game > first completed game
  useEffect(() => {
    if (matches.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      
      // Find the best initial index
      let bestIndex = 0;
      
      // If there are live games, select the first one
      const firstLiveIndex = matches.findIndex(m => m.game.isLive);
      if (firstLiveIndex !== -1) {
        bestIndex = firstLiveIndex;
      } else {
        // No live games - select first upcoming game
        const firstUpcomingIndex = matches.findIndex(
          m => m.game.status === 'scheduled' || m.game.status === 'created'
        );
        if (firstUpcomingIndex !== -1) {
          bestIndex = firstUpcomingIndex;
        }
        // Otherwise keep at 0 (which could be completed or whatever comes first)
      }
      
      setCurrentIndex(bestIndex);
    }
  }, [matches]);

  // Current match
  const currentMatch = matches.length > 0 ? matches[currentIndex] ?? null : null;

  // Navigation functions
  const goToNext = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev + 1;
      return next >= matches.length ? 0 : next; // Wrap around
    });
  }, [matches.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev - 1;
      return next < 0 ? matches.length - 1 : next; // Wrap around
    });
  }, [matches.length]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < matches.length) {
      setCurrentIndex(index);
    }
  }, [matches.length]);

  // Combined refresh
  const refresh = useCallback(() => {
    refetchSchedule();
    refetchMarkets();
  }, [refetchSchedule, refetchMarkets]);

  // Determine last updated time (most recent of the two)
  const lastUpdated = useMemo(() => {
    if (!scheduleLastUpdated && !marketLastUpdated) return null;
    if (!scheduleLastUpdated) return marketLastUpdated;
    if (!marketLastUpdated) return scheduleLastUpdated;
    return scheduleLastUpdated > marketLastUpdated ? scheduleLastUpdated : marketLastUpdated;
  }, [scheduleLastUpdated, marketLastUpdated]);

  return {
    currentMatch,
    currentIndex,
    totalMatches: matches.length,
    matches,
    liveMatches,
    upcomingMatches,
    completedMatches,
    nextGame,
    goToNext,
    goToPrevious,
    goToIndex,
    isLoading: scheduleLoading || marketLoading,
    isRefreshing: scheduleRefreshing || marketRefreshing,
    scheduleError,
    marketError,
    refresh,
    lastUpdated,
    hasLiveGames: liveGames.length > 0,
    liveGameCount: liveGames.length,
    upcomingGameCount: upcomingGames.length,
  };
}

/**
 * Keyboard navigation hook for the match panel
 */
export function useMatchPanelKeyboard(
  goToNext: () => void,
  goToPrevious: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, goToNext, goToPrevious]);
}

/**
 * Hook for match panel visibility state
 */
export function useMatchPanelVisibility(defaultExpanded: boolean = true) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const expand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const openMobileOverlay = useCallback(() => {
    setIsMobileOverlayOpen(true);
  }, []);

  const closeMobileOverlay = useCallback(() => {
    setIsMobileOverlayOpen(false);
  }, []);

  return {
    isExpanded,
    isMobileOverlayOpen,
    toggle,
    expand,
    collapse,
    openMobileOverlay,
    closeMobileOverlay,
  };
}
