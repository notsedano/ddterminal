import { createContext, useContext, ReactNode } from 'react';
import { useMatchPanel, type MatchWithMarket } from '@/hooks/useMatchPanel';

interface MatchContextValue {
  currentMatch: MatchWithMarket | null;
  currentIndex: number;
  totalMatches: number;
  matches: MatchWithMarket[];
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
  isLoading: boolean;
  refresh: () => void;
  hasLiveGames: boolean;
  liveGameCount: number;
}

const MatchContext = createContext<MatchContextValue | null>(null);

interface MatchProviderProps {
  children: ReactNode;
}

export function MatchProvider({ children }: MatchProviderProps) {
  const matchPanel = useMatchPanel({ autoRefresh: true });

  const value: MatchContextValue = {
    currentMatch: matchPanel.currentMatch,
    currentIndex: matchPanel.currentIndex,
    totalMatches: matchPanel.totalMatches,
    matches: matchPanel.matches,
    goToNext: matchPanel.goToNext,
    goToPrevious: matchPanel.goToPrevious,
    goToIndex: matchPanel.goToIndex,
    isLoading: matchPanel.isLoading,
    refresh: matchPanel.refresh,
    hasLiveGames: matchPanel.hasLiveGames,
    liveGameCount: matchPanel.liveGameCount,
  };

  return (
    <MatchContext.Provider value={value}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatchContext() {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatchContext must be used within a MatchProvider');
  }
  return context;
}

export function useCurrentMatchForPrediction() {
  const { currentMatch } = useMatchContext();
  if (!currentMatch) return null;

  const { game, market } = currentMatch;

  let homeOdds: number | undefined;
  let awayOdds: number | undefined;
  let line: number | undefined;
  let volume: number | undefined;

  if (market) {
    const outcomes = market.market.outcomes;
    const homeOutcome = outcomes.find(o => 
      o.name.toLowerCase().includes(game.home.team.name.toLowerCase()) ||
      o.name.toLowerCase().includes(game.home.team.alias.toLowerCase())
    );
    const awayOutcome = outcomes.find(o => 
      o.name.toLowerCase().includes(game.away.team.name.toLowerCase()) ||
      o.name.toLowerCase().includes(game.away.team.alias.toLowerCase())
    );
    
    homeOdds = homeOutcome?.price;
    awayOdds = awayOutcome?.price;
    line = market.market.line;
    volume = market.market.volume;
  }

  return {
    gameId: game.id,
    homeTeam: {
      name: game.home.team.name,
      abbreviation: game.home.team.alias,
      record: game.home.record 
        ? `${game.home.record.wins}-${game.home.record.losses}` 
        : undefined,
    },
    awayTeam: {
      name: game.away.team.name,
      abbreviation: game.away.team.alias,
      record: game.away.record 
        ? `${game.away.record.wins}-${game.away.record.losses}` 
        : undefined,
    },
    scheduledTime: game.scheduledTime.toISOString(),
    sport: 'NBA' as const,
    market: market ? {
      line,
      homeOdds,
      awayOdds,
      volume,
      marketType: market.market.sportsMarketType,
    } : undefined,
    scores: game.isLive ? {
      home: game.home.score,
      away: game.away.score,
      quarter: game.clock?.quarter,
      time: game.clock?.time,
    } : undefined,
  };
}
