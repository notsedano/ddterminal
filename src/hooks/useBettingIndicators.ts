/**
 * Betting Indicators Hook
 * Combines match history, standings, and market data for betting signals
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { 
  MatchPanelGame, 
  GameBettingIndicators,
  LineMovement,
  BettingSignal,
  PolymarketPriceHistoryPoint,
} from '@/types';
import { useMatchHistory, calculateRestDays, isBackToBack } from './useMatchHistory';
import { getNBASeasonSchedule } from '@/services/api/sportradar';
import { getPriceHistory } from '@/services/api/polymarket';
import { useGameMarketData } from './usePolymarketNBA';

interface BettingIndicatorsResult {
  indicators: GameBettingIndicators | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Main hook for comprehensive betting indicators
 */
export function useBettingIndicators(
  game: MatchPanelGame | null,
  enabled: boolean = true
): BettingIndicatorsResult {
  // Get match history and standings
  const { 
    homeHistory, 
    awayHistory, 
    homeStanding,
    awayStanding,
    isLoading: historyLoading 
  } = useMatchHistory(game, { enabled });

  // Get market data for line movement analysis
  const gameMarkets = useGameMarketData(game);

  // Get season schedule for rest days calculation
  const scheduleQuery = useQuery({
    queryKey: ['nba-season-schedule'],
    queryFn: () => getNBASeasonSchedule(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!game,
  });

  // Calculate indicators
  const indicators = useMemo<GameBettingIndicators | null>(() => {
    if (!game || !homeHistory || !awayHistory) {
      return null;
    }

    const gameDate = game.scheduledTime;
    const games = scheduleQuery.data?.games ?? [];

    // Calculate rest days
    const homeRestDays = calculateRestDays(game.home.team.id, gameDate, games);
    const awayRestDays = calculateRestDays(game.away.team.id, gameDate, games);
    const homeIsBackToBack = isBackToBack(game.home.team.id, gameDate, games);
    const awayIsBackToBack = isBackToBack(game.away.team.id, gameDate, games);

    // Get spreads from market data
    const spreadMarket = gameMarkets.bestSpread;
    const currentSpread = spreadMarket?.line;

    // Calculate market efficiency (overround)
    let overround = 0;
    const moneylineOutcomes = gameMarkets.moneyline?.outcomes;
    if (moneylineOutcomes && moneylineOutcomes.length >= 2) {
      const totalProb = moneylineOutcomes.reduce((sum, o) => sum + o.price, 0);
      overround = (totalProb - 1) * 100;
    }

    // Determine market efficiency level
    let marketEfficiency: 'low' | 'medium' | 'high' = 'medium';
    if (overround < 2) {
      marketEfficiency = 'high';
    } else if (overround > 5) {
      marketEfficiency = 'low';
    }

    // Calculate H2H record from histories
    const homeH2HWins = homeHistory.headToHead.filter(g => g.result === 'W').length;
    const h2hTotal = homeHistory.headToHead.length;
    const h2hAverageTotal = homeHistory.headToHead.length > 0
      ? homeHistory.headToHead.reduce((sum, g) => sum + g.teamScore + g.opponentScore, 0) / homeHistory.headToHead.length
      : 0;

    // Generate betting signals
    const signals = generateBettingSignals({
      homeHistory,
      awayHistory,
      homeStanding,
      awayStanding,
      homeRestDays,
      awayRestDays,
      homeIsBackToBack,
      awayIsBackToBack,
      spreadMarket,
    });

    return {
      gameId: game.id,
      homeTeamId: game.home.team.id,
      awayTeamId: game.away.team.id,
      
      homeRestDays,
      awayRestDays,
      homeIsBackToBack,
      awayIsBackToBack,
      
      homeStreak: { type: homeHistory.streakType, count: homeHistory.streakCount },
      awayStreak: { type: awayHistory.streakType, count: awayHistory.streakCount },
      
      homeLast10: homeHistory.last10Record,
      awayLast10: awayHistory.last10Record,
      
      homeATS: homeHistory.atsRecord,
      awayATS: awayHistory.atsRecord,
      homeOU: homeHistory.ouRecord,
      awayOU: awayHistory.ouRecord,
      
      lineMovements: [], // Would need price history tracking
      currentSpread,
      openingSpread: undefined, // Would need historical line data
      
      overround,
      marketEfficiency,
      
      signals,
      
      h2hRecord: { homeWins: homeH2HWins, awayWins: h2hTotal - homeH2HWins, total: h2hTotal },
      h2hAverageTotal,
    };
  }, [game, homeHistory, awayHistory, homeStanding, awayStanding, gameMarkets, scheduleQuery.data]);

  return {
    indicators,
    isLoading: historyLoading || scheduleQuery.isLoading || gameMarkets.isLoading,
    isError: scheduleQuery.isError,
  };
}

/**
 * Generate betting signals based on available data
 */
function generateBettingSignals(data: {
  homeHistory: any;
  awayHistory: any;
  homeStanding: any;
  awayStanding: any;
  homeRestDays: number;
  awayRestDays: number;
  homeIsBackToBack: boolean;
  awayIsBackToBack: boolean;
  spreadMarket: any;
}): BettingSignal[] {
  const signals: BettingSignal[] = [];
  const now = new Date();

  // Hot streak signal
  if (data.homeHistory.streakCount >= 5 && data.homeHistory.streakType === 'W') {
    signals.push({
      type: 'sharp_action',
      team: data.homeHistory.teamAlias,
      description: `${data.homeHistory.teamAlias} on ${data.homeHistory.streakCount}-game win streak`,
      timestamp: now,
      confidence: 'high',
    });
  }
  if (data.awayHistory.streakCount >= 5 && data.awayHistory.streakType === 'W') {
    signals.push({
      type: 'sharp_action',
      team: data.awayHistory.teamAlias,
      description: `${data.awayHistory.teamAlias} on ${data.awayHistory.streakCount}-game win streak`,
      timestamp: now,
      confidence: 'high',
    });
  }

  // Cold streak signal
  if (data.homeHistory.streakCount >= 4 && data.homeHistory.streakType === 'L') {
    signals.push({
      type: 'public_money',
      team: data.awayHistory.teamAlias,
      description: `${data.homeHistory.teamAlias} on ${data.homeHistory.streakCount}-game losing streak`,
      timestamp: now,
      confidence: 'medium',
    });
  }
  if (data.awayHistory.streakCount >= 4 && data.awayHistory.streakType === 'L') {
    signals.push({
      type: 'public_money',
      team: data.homeHistory.teamAlias,
      description: `${data.awayHistory.teamAlias} on ${data.awayHistory.streakCount}-game losing streak`,
      timestamp: now,
      confidence: 'medium',
    });
  }

  // Back-to-back fatigue signal
  if (data.homeIsBackToBack && !data.awayIsBackToBack) {
    signals.push({
      type: 'sharp_action',
      team: data.awayHistory?.teamAlias ?? 'Away',
      description: `Home team on back-to-back, away well-rested (${data.awayRestDays} days)`,
      timestamp: now,
      confidence: 'medium',
    });
  }
  if (data.awayIsBackToBack && !data.homeIsBackToBack) {
    signals.push({
      type: 'sharp_action',
      team: data.homeHistory?.teamAlias ?? 'Home',
      description: `Away team on back-to-back, home well-rested (${data.homeRestDays} days)`,
      timestamp: now,
      confidence: 'medium',
    });
  }

  // Strong last 10 record
  if (data.homeHistory.last10Record.wins >= 8) {
    signals.push({
      type: 'sharp_action',
      team: data.homeHistory.teamAlias,
      description: `${data.homeHistory.teamAlias} ${data.homeHistory.last10Record.wins}-${data.homeHistory.last10Record.losses} in last 10`,
      timestamp: now,
      confidence: 'high',
    });
  }
  if (data.awayHistory.last10Record.wins >= 8) {
    signals.push({
      type: 'sharp_action',
      team: data.awayHistory.teamAlias,
      description: `${data.awayHistory.teamAlias} ${data.awayHistory.last10Record.wins}-${data.awayHistory.last10Record.losses} in last 10`,
      timestamp: now,
      confidence: 'high',
    });
  }

  // Weak last 10 record
  if (data.homeHistory.last10Record.losses >= 8) {
    signals.push({
      type: 'public_money',
      team: data.awayHistory?.teamAlias ?? 'Away',
      description: `${data.homeHistory.teamAlias} only ${data.homeHistory.last10Record.wins}-${data.homeHistory.last10Record.losses} in last 10`,
      timestamp: now,
      confidence: 'medium',
    });
  }
  if (data.awayHistory.last10Record.losses >= 8) {
    signals.push({
      type: 'public_money',
      team: data.homeHistory?.teamAlias ?? 'Home',
      description: `${data.awayHistory.teamAlias} only ${data.awayHistory.last10Record.wins}-${data.awayHistory.last10Record.losses} in last 10`,
      timestamp: now,
      confidence: 'medium',
    });
  }

  // H2H dominance
  if (data.homeHistory.headToHead.length >= 3) {
    const homeH2HWins = data.homeHistory.headToHead.filter((g: any) => g.result === 'W').length;
    const h2hTotal = data.homeHistory.headToHead.length;
    
    if (homeH2HWins >= 4 && h2hTotal >= 5) {
      signals.push({
        type: 'sharp_action',
        team: data.homeHistory.teamAlias,
        description: `${data.homeHistory.teamAlias} ${homeH2HWins}-${h2hTotal - homeH2HWins} in recent H2H`,
        timestamp: now,
        confidence: 'high',
      });
    } else if (h2hTotal - homeH2HWins >= 4 && h2hTotal >= 5) {
      signals.push({
        type: 'sharp_action',
        team: data.awayHistory?.teamAlias ?? 'Away',
        description: `${data.awayHistory?.teamAlias} ${h2hTotal - homeH2HWins}-${homeH2HWins} in recent H2H`,
        timestamp: now,
        confidence: 'high',
      });
    }
  }

  return signals;
}

/**
 * Hook for line movement tracking (requires price history)
 */
export function useLineMovement(
  tokenId: string | undefined,
  enabled: boolean = true
): { movements: LineMovement[]; isLoading: boolean } {
  const historyQuery = useQuery({
    queryKey: ['price-history', tokenId, '1d'],
    queryFn: () => getPriceHistory(tokenId!, { interval: '1d' }),
    enabled: enabled && !!tokenId,
    staleTime: 60 * 1000, // 1 minute
  });

  const movements = useMemo<LineMovement[]>(() => {
    if (!historyQuery.data || !Array.isArray(historyQuery.data) || historyQuery.data.length === 0) return [];

    const history = historyQuery.data;
    const movements: LineMovement[] = [];
    
    // Sample every hour to detect significant movements
    const hourlyPoints: PolymarketPriceHistoryPoint[] = [];
    let lastHour = -1;
    
    for (const point of history) {
      const hour = new Date(point.t * 1000).getHours();
      if (hour !== lastHour) {
        hourlyPoints.push(point);
        lastHour = hour;
      }
    }

    // Detect movements of 2% or more
    for (let i = 1; i < hourlyPoints.length; i++) {
      const prev = hourlyPoints[i - 1];
      const curr = hourlyPoints[i];
      const change = curr.p - prev.p;
      
      if (Math.abs(change) >= 0.02) {
        movements.push({
          timestamp: new Date(curr.t * 1000),
          oldLine: prev.p * 100,
          newLine: curr.p * 100,
          direction: change > 0 ? 'up' : 'down',
          magnitude: Math.abs(change) * 100,
        });
      }
    }

    return movements;
  }, [historyQuery.data]);

  return {
    movements,
    isLoading: historyQuery.isLoading,
  };
}

/**
 * Format rest days for display
 */
export function formatRestDays(days: number): string {
  if (days === 0) return 'B2B';
  if (days === 1) return '1 day rest';
  return `${days} days rest`;
}

/**
 * Get rest advantage description
 */
export function getRestAdvantage(
  homeRestDays: number, 
  awayRestDays: number
): { team: 'home' | 'away' | 'none'; advantage: number; description: string } {
  const diff = homeRestDays - awayRestDays;
  
  if (Math.abs(diff) < 1) {
    return { team: 'none', advantage: 0, description: 'Even rest' };
  }
  
  if (diff > 0) {
    return { 
      team: 'home', 
      advantage: diff, 
      description: `Home +${diff} day${diff > 1 ? 's' : ''} rest` 
    };
  }
  
  return { 
    team: 'away', 
    advantage: Math.abs(diff), 
    description: `Away +${Math.abs(diff)} day${Math.abs(diff) > 1 ? 's' : ''} rest` 
  };
}
