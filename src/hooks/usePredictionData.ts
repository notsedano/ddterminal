/**
 * Prediction Data Hook
 * Consolidates all available data for generating intelligent predictions
 * Combines: match info, market data, injuries, betting indicators, player stats, match history
 * Now includes comprehensive betting markets (Moneyline, Spread, O/U, Props) for LLM recommendations
 */

import { useMemo } from 'react';
import { useMatchContext } from '@/contexts/MatchContext';
import { useNBAInjuries } from './useNBAInjuries';
import { useBettingIndicators } from './useBettingIndicators';
import { useGameStats, type PlayerGameStats } from './useGameStats';
import { useMatchHistory } from './useMatchHistory';
import { useGameMarketData } from './usePolymarketNBA';
import type { 
  NBAInjuredPlayer, 
  TeamMatchHistory, 
  NBATeamStanding,
  BettingSignal,
} from '@/types';
import { formatPriceAsPercentage, formatPriceAsAmericanOdds } from '@/types/polymarket';

/**
 * Comprehensive prediction context with all available data
 */
export interface PredictionData {
  // Basic match info
  gameId: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    record?: string;
    teamId: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    record?: string;
    teamId: string;
  };
  scheduledTime: string;
  sport: 'NBA';
  isLive: boolean;

  // Market data from Polymarket
  market?: {
    line?: number;
    homeOdds?: number;
    awayOdds?: number;
    volume?: number;
    marketType?: string;
  };

  // Live game scores (if applicable)
  scores?: {
    home: number;
    away: number;
    quarter?: number;
    time?: string;
  };

  // Injury data
  injuries: {
    home: InjuryInfo[];
    away: InjuryInfo[];
    impactSummary: string;
  };

  // Betting indicators
  bettingIndicators: {
    homeRestDays: number;
    awayRestDays: number;
    homeIsBackToBack: boolean;
    awayIsBackToBack: boolean;
    homeStreak: { type: 'W' | 'L'; count: number };
    awayStreak: { type: 'W' | 'L'; count: number };
    homeLast10: { wins: number; losses: number };
    awayLast10: { wins: number; losses: number };
    h2hRecord: { homeWins: number; awayWins: number; total: number };
    h2hAverageTotal: number;
    signals: BettingSignal[];
    marketEfficiency: 'low' | 'medium' | 'high';
  } | null;

  // Player statistics
  playerStats: {
    homeTopScorer: PlayerStatSummary | null;
    awayTopScorer: PlayerStatSummary | null;
    homeHotHand: PlayerStatSummary[];
    awayHotHand: PlayerStatSummary[];
    isSeasonStats: boolean;
  };

  // Match history
  matchHistory: {
    homeHistory: MatchHistorySummary | null;
    awayHistory: MatchHistorySummary | null;
    homeStanding: StandingSummary | null;
    awayStanding: StandingSummary | null;
  };

  // Comprehensive betting markets from Polymarket
  bettingMarkets: {
    moneyline: BettingMarketOption | null;
    spreads: BettingMarketOption[];
    totals: BettingMarketOption[];
    props: BettingMarketOption[];
    totalVolume: number;
    hasMarkets: boolean;
  } | null;

  // Loading states
  isLoading: boolean;
  hasFullData: boolean;
}

/** Simplified betting market option for LLM consumption */
interface BettingMarketOption {
  type: 'moneyline' | 'spread' | 'total' | 'prop';
  question: string;
  outcomes: Array<{
    name: string;
    probability: string;
    americanOdds: string;
    price: number;
  }>;
  line?: number;
  volume: number;
}

interface InjuryInfo {
  playerName: string;
  status: 'Out' | 'Doubtful' | 'Questionable' | 'Probable' | 'Day-To-Day' | string;
  description?: string;
  comment?: string;
}

interface PlayerStatSummary {
  name: string;
  points: number;
  rebounds: number;
  assists: number;
  fieldGoalPct: number;
  threePointPct: number;
  plusMinus: number;
  isInjured: boolean;
  injuryStatus?: string;
}

interface MatchHistorySummary {
  streakType: 'W' | 'L';
  streakCount: number;
  last10: { wins: number; losses: number };
  homeRecord: { wins: number; losses: number };
  awayRecord: { wins: number; losses: number };
  recentGames: Array<{
    opponent: string;
    result: 'W' | 'L';
    score: string;
    marginOfVictory: number;
  }>;
}

interface StandingSummary {
  wins: number;
  losses: number;
  winPct: number;
  pointDiff: number;
  gamesBack?: number;
  conferenceRank?: number;
}

/**
 * Extract injury info from raw injury data
 */
function extractInjuryInfo(players: NBAInjuredPlayer[] | undefined): InjuryInfo[] {
  if (!players || players.length === 0) return [];
  
  return players.map(player => {
    const primaryInjury = player.injuries?.[0];
    return {
      playerName: player.full_name,
      status: primaryInjury?.status ?? 'Unknown',
      description: primaryInjury?.desc,
      comment: primaryInjury?.comment,
    };
  });
}

/**
 * Generate impact summary for injuries
 */
function generateInjuryImpactSummary(
  homeInjuries: InjuryInfo[],
  awayInjuries: InjuryInfo[],
  homeAbbr: string,
  awayAbbr: string
): string {
  const homeOut = homeInjuries.filter(i => i.status === 'Out' || i.status === 'Doubtful');
  const awayOut = awayInjuries.filter(i => i.status === 'Out' || i.status === 'Doubtful');
  
  if (homeOut.length === 0 && awayOut.length === 0) {
    return 'No significant injuries affecting either team';
  }
  
  const parts: string[] = [];
  if (homeOut.length > 0) {
    parts.push(`${homeAbbr} missing ${homeOut.length} player${homeOut.length > 1 ? 's' : ''}`);
  }
  if (awayOut.length > 0) {
    parts.push(`${awayAbbr} missing ${awayOut.length} player${awayOut.length > 1 ? 's' : ''}`);
  }
  
  return parts.join('; ');
}

/**
 * Convert PlayerGameStats to summary
 */
function toPlayerStatSummary(player: PlayerGameStats | null): PlayerStatSummary | null {
  if (!player) return null;
  return {
    name: player.name,
    points: player.points,
    rebounds: player.rebounds,
    assists: player.assists,
    fieldGoalPct: player.fieldGoalPct,
    threePointPct: player.threePointPct,
    plusMinus: player.plusMinus,
    isInjured: player.isInjured ?? false,
    injuryStatus: player.injuryStatus,
  };
}

/**
 * Convert TeamMatchHistory to summary
 */
function toMatchHistorySummary(history: TeamMatchHistory | null): MatchHistorySummary | null {
  if (!history) return null;
  return {
    streakType: history.streakType,
    streakCount: history.streakCount,
    last10: history.last10Record,
    homeRecord: history.homeRecord,
    awayRecord: history.awayRecord,
    recentGames: history.lastNGames.slice(0, 5).map(g => ({
      opponent: g.opponent.alias ?? g.opponent.name,
      result: g.result,
      score: `${g.teamScore}-${g.opponentScore}`,
      marginOfVictory: g.marginOfVictory,
    })),
  };
}

/**
 * Convert NBATeamStanding to summary
 */
function toStandingSummary(standing: NBATeamStanding | null): StandingSummary | null {
  if (!standing) return null;
  return {
    wins: standing.wins,
    losses: standing.losses,
    winPct: standing.win_pct,
    pointDiff: standing.point_diff,
    gamesBack: standing.games_behind,
    conferenceRank: standing.calc_rank?.conf_rank,
  };
}

/**
 * Convert ParsedGameMarket to simplified BettingMarketOption
 */
function toBettingMarketOption(
  market: { type: string; question: string; outcomes: Array<{ name: string; price: number; tokenId?: string }>; volume: number; line?: number } | null,
  type: 'moneyline' | 'spread' | 'total' | 'prop'
): BettingMarketOption | null {
  if (!market) return null;
  return {
    type,
    question: market.question,
    outcomes: market.outcomes.map(o => ({
      name: o.name,
      probability: formatPriceAsPercentage(o.price),
      americanOdds: formatPriceAsAmericanOdds(o.price),
      price: o.price,
    })),
    line: market.line,
    volume: market.volume,
  };
}

/**
 * Main hook to get all prediction data consolidated
 */
export function usePredictionData(): PredictionData | null {
  const { currentMatch } = useMatchContext();
  
  const game = currentMatch?.game ?? null;
  const market = currentMatch?.market ?? null;
  
  // Get injury data
  const { getInjuriesForGame } = useNBAInjuries();
  const gameInjuries = game ? getInjuriesForGame(game) : { home: null, away: null };
  
  // Get betting indicators
  const { indicators: bettingIndicators, isLoading: indicatorsLoading } = useBettingIndicators(game);
  
  // Get comprehensive betting markets (Moneyline, Spread, O/U, Props)
  const gameMarkets = useGameMarketData(game);
  
  // Get player stats
  const {
    homePlayers,
    awayPlayers,
    isLoading: statsLoading,
    isSeasonStats,
    getTopScorer,
    getHotHandPlayers,
  } = useGameStats({
    gameId: game?.id ?? null,
    game,
    autoRefresh: game?.isLive ?? false,
    homeInjuries: gameInjuries.home,
    awayInjuries: gameInjuries.away,
  });
  
  // Get match history
  const {
    homeHistory,
    awayHistory,
    homeStanding,
    awayStanding,
    isLoading: historyLoading,
  } = useMatchHistory(game, { limit: 10, includeH2H: true });

  const predictionData = useMemo<PredictionData | null>(() => {
    if (!game) return null;
    
    // Extract market data
    let homeOdds: number | undefined;
    let awayOdds: number | undefined;
    let line: number | undefined;
    let volume: number | undefined;
    let marketType: string | undefined;
    
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
      marketType = market.market.sportsMarketType;
    }
    
    // Extract injuries
    const homeInjuryInfo = extractInjuryInfo(gameInjuries.home?.players);
    const awayInjuryInfo = extractInjuryInfo(gameInjuries.away?.players);
    const impactSummary = generateInjuryImpactSummary(
      homeInjuryInfo, 
      awayInjuryInfo,
      game.home.team.alias,
      game.away.team.alias
    );
    
    // Get top scorers and hot hand players
    const homeTopScorer = getTopScorer('home');
    const awayTopScorer = getTopScorer('away');
    const homeHotHand = getHotHandPlayers('home');
    const awayHotHand = getHotHandPlayers('away');
    
    return {
      gameId: game.id,
      homeTeam: {
        name: game.home.team.name,
        abbreviation: game.home.team.alias,
        record: game.home.record 
          ? `${game.home.record.wins}-${game.home.record.losses}` 
          : undefined,
        teamId: game.home.team.id,
      },
      awayTeam: {
        name: game.away.team.name,
        abbreviation: game.away.team.alias,
        record: game.away.record 
          ? `${game.away.record.wins}-${game.away.record.losses}` 
          : undefined,
        teamId: game.away.team.id,
      },
      scheduledTime: game.scheduledTime.toISOString(),
      sport: 'NBA',
      isLive: game.isLive,
      
      market: market ? {
        line,
        homeOdds,
        awayOdds,
        volume,
        marketType,
      } : undefined,
      
      scores: game.isLive ? {
        home: game.home.score,
        away: game.away.score,
        quarter: game.clock?.quarter,
        time: game.clock?.time,
      } : undefined,
      
      injuries: {
        home: homeInjuryInfo,
        away: awayInjuryInfo,
        impactSummary,
      },
      
      bettingIndicators: bettingIndicators ? {
        homeRestDays: bettingIndicators.homeRestDays,
        awayRestDays: bettingIndicators.awayRestDays,
        homeIsBackToBack: bettingIndicators.homeIsBackToBack,
        awayIsBackToBack: bettingIndicators.awayIsBackToBack,
        homeStreak: bettingIndicators.homeStreak,
        awayStreak: bettingIndicators.awayStreak,
        homeLast10: bettingIndicators.homeLast10,
        awayLast10: bettingIndicators.awayLast10,
        h2hRecord: bettingIndicators.h2hRecord,
        h2hAverageTotal: bettingIndicators.h2hAverageTotal,
        signals: bettingIndicators.signals,
        marketEfficiency: bettingIndicators.marketEfficiency,
      } : null,
      
      playerStats: {
        homeTopScorer: toPlayerStatSummary(homeTopScorer),
        awayTopScorer: toPlayerStatSummary(awayTopScorer),
        homeHotHand: homeHotHand.slice(0, 3).map(p => toPlayerStatSummary(p)!),
        awayHotHand: awayHotHand.slice(0, 3).map(p => toPlayerStatSummary(p)!),
        isSeasonStats,
      },
      
      matchHistory: {
        homeHistory: toMatchHistorySummary(homeHistory),
        awayHistory: toMatchHistorySummary(awayHistory),
        homeStanding: toStandingSummary(homeStanding),
        awayStanding: toStandingSummary(awayStanding),
      },
      
      // Comprehensive betting markets
      bettingMarkets: gameMarkets.hasMarkets ? {
        moneyline: toBettingMarketOption(gameMarkets.moneyline, 'moneyline'),
        spreads: (gameMarkets.data?.spreads ?? []).map(s => toBettingMarketOption(s, 'spread')!).filter(Boolean),
        totals: (gameMarkets.data?.totals ?? []).map(t => toBettingMarketOption(t, 'total')!).filter(Boolean),
        props: (gameMarkets.data?.props ?? []).slice(0, 10).map(p => toBettingMarketOption(p, 'prop')!).filter(Boolean),
        totalVolume: gameMarkets.totalVolume,
        hasMarkets: gameMarkets.hasMarkets,
      } : null,
      
      isLoading: statsLoading || indicatorsLoading || historyLoading || gameMarkets.isLoading,
      hasFullData: !statsLoading && !indicatorsLoading && !historyLoading && !gameMarkets.isLoading &&
                   homePlayers.length > 0 && !!bettingIndicators && !!homeHistory,
    };
  }, [
    game, 
    market, 
    gameInjuries, 
    bettingIndicators, 
    homePlayers, 
    awayPlayers, 
    isSeasonStats,
    getTopScorer, 
    getHotHandPlayers, 
    homeHistory, 
    awayHistory, 
    homeStanding, 
    awayStanding,
    statsLoading,
    indicatorsLoading,
    historyLoading,
    gameMarkets,
  ]);
  
  return predictionData;
}

/**
 * Build Part 1: Sports Data Info
 * Includes: injuries, stats, history, standings, betting indicators, live scores
 * Max 4000 characters
 */
export function buildSportsDataMessage(data: PredictionData | null): string {
  if (!data) {
    return `🎯 PREDICTION REQUEST - PART 1/3: SPORTS DATA

⚠️ DO NOT RESPOND YET - This is Part 1 of 3.

You will receive Part 2 (Market Data) and Part 3 (Analysis Instructions) next.
Wait for ALL 3 parts before generating any response.`;
  }
  
  const { homeTeam, awayTeam } = data;
  const matchupInfo = `${awayTeam.name} @ ${homeTeam.name}`;
  const scheduled = new Date(data.scheduledTime).toLocaleString();
  
  const parts: string[] = [
    `🎯 PREDICTION REQUEST - PART 1/3: SPORTS DATA`,
    ``,
    `═══════════════════════════════════════`,
    `📊 MATCHUP: ${matchupInfo}`,
    `🏀 Sport: NBA`,
    `📅 Scheduled: ${scheduled}`,
    `═══════════════════════════════════════`,
  ];
  
  // Team Records
  if (awayTeam.record || homeTeam.record) {
    parts.push(``);
    parts.push(`📈 SEASON RECORDS:`);
    if (awayTeam.record) {
      parts.push(`  • ${awayTeam.abbreviation}: ${awayTeam.record}`);
    }
    if (homeTeam.record) {
      parts.push(`  • ${homeTeam.abbreviation}: ${homeTeam.record}`);
    }
  }
  
  // Live Scores (if applicable)
  if (data.scores) {
    parts.push(``);
    parts.push(`⏱️ CURRENT SCORE (Q${data.scores.quarter} ${data.scores.time}):`);
    parts.push(`  • ${awayTeam.abbreviation}: ${data.scores.away}`);
    parts.push(`  • ${homeTeam.abbreviation}: ${data.scores.home}`);
    const scoreDiff = data.scores.home - data.scores.away;
    if (scoreDiff !== 0) {
      const leader = scoreDiff > 0 ? homeTeam.abbreviation : awayTeam.abbreviation;
      parts.push(`  • ${leader} leading by ${Math.abs(scoreDiff)}`);
    }
  }
  
  // Injury Report
  if (data.injuries.home.length > 0 || data.injuries.away.length > 0) {
    parts.push(``);
    parts.push(`🏥 INJURY REPORT:`);
    parts.push(`  IMPACT: ${data.injuries.impactSummary}`);
    
    if (data.injuries.home.length > 0) {
      parts.push(`  ${homeTeam.abbreviation} INJURIES:`);
      for (const injury of data.injuries.home.slice(0, 5)) {
        const statusIcon = injury.status === 'Out' ? '❌' : 
                          injury.status === 'Doubtful' ? '⚠️' : 
                          injury.status === 'Questionable' ? '❓' : '✅';
        parts.push(`    ${statusIcon} ${injury.playerName} - ${injury.status}${injury.description ? ` (${injury.description})` : ''}`);
      }
    }
    
    if (data.injuries.away.length > 0) {
      parts.push(`  ${awayTeam.abbreviation} INJURIES:`);
      for (const injury of data.injuries.away.slice(0, 5)) {
        const statusIcon = injury.status === 'Out' ? '❌' : 
                          injury.status === 'Doubtful' ? '⚠️' : 
                          injury.status === 'Questionable' ? '❓' : '✅';
        parts.push(`    ${statusIcon} ${injury.playerName} - ${injury.status}${injury.description ? ` (${injury.description})` : ''}`);
      }
    }
  }
  
  // Player Stats
  const ps = data.playerStats;
  if (ps.homeTopScorer || ps.awayTopScorer) {
    parts.push(``);
    parts.push(`⭐ KEY PLAYERS (${ps.isSeasonStats ? 'Season Averages' : 'This Game'}):`);
    
    if (ps.homeTopScorer) {
      const p = ps.homeTopScorer;
      const injuryNote = p.isInjured ? ` [${p.injuryStatus}]` : '';
      parts.push(`  ${homeTeam.abbreviation} Leader: ${p.name}${injuryNote}`);
      parts.push(`    • ${ps.isSeasonStats ? 'PPG' : 'PTS'}: ${p.points.toFixed(1)}, REB: ${p.rebounds.toFixed(1)}, AST: ${p.assists.toFixed(1)}`);
      parts.push(`    • FG%: ${p.fieldGoalPct.toFixed(1)}%, 3P%: ${p.threePointPct.toFixed(1)}%`);
    }
    
    if (ps.awayTopScorer) {
      const p = ps.awayTopScorer;
      const injuryNote = p.isInjured ? ` [${p.injuryStatus}]` : '';
      parts.push(`  ${awayTeam.abbreviation} Leader: ${p.name}${injuryNote}`);
      parts.push(`    • ${ps.isSeasonStats ? 'PPG' : 'PTS'}: ${p.points.toFixed(1)}, REB: ${p.rebounds.toFixed(1)}, AST: ${p.assists.toFixed(1)}`);
      parts.push(`    • FG%: ${p.fieldGoalPct.toFixed(1)}%, 3P%: ${p.threePointPct.toFixed(1)}%`);
    }
    
    // Hot hand players (for live games)
    if (!ps.isSeasonStats && (ps.homeHotHand.length > 0 || ps.awayHotHand.length > 0)) {
      parts.push(`  🔥 HOT HAND PLAYERS:`);
      for (const p of ps.homeHotHand) {
        parts.push(`    • ${homeTeam.abbreviation}: ${p.name} - ${p.points} pts, ${p.fieldGoalPct.toFixed(0)}% FG`);
      }
      for (const p of ps.awayHotHand) {
        parts.push(`    • ${awayTeam.abbreviation}: ${p.name} - ${p.points} pts, ${p.fieldGoalPct.toFixed(0)}% FG`);
      }
    }
  }
  
  // Match History
  const mh = data.matchHistory;
  if (mh.homeHistory || mh.awayHistory) {
    parts.push(``);
    parts.push(`📜 RECENT FORM:`);
    
    if (mh.homeHistory) {
      const h = mh.homeHistory;
      parts.push(`  ${homeTeam.abbreviation}:`);
      parts.push(`    • Last 10: ${h.last10.wins}-${h.last10.losses}`);
      parts.push(`    • Home record: ${h.homeRecord.wins}-${h.homeRecord.losses}`);
      if (h.recentGames.length > 0) {
        const recentResults = h.recentGames.slice(0, 5).map(g => 
          `${g.result} vs ${g.opponent} (${g.score})`
        ).join(', ');
        parts.push(`    • Recent: ${recentResults}`);
      }
    }
    
    if (mh.awayHistory) {
      const h = mh.awayHistory;
      parts.push(`  ${awayTeam.abbreviation}:`);
      parts.push(`    • Last 10: ${h.last10.wins}-${h.last10.losses}`);
      parts.push(`    • Away record: ${h.awayRecord.wins}-${h.awayRecord.losses}`);
      if (h.recentGames.length > 0) {
        const recentResults = h.recentGames.slice(0, 5).map(g => 
          `${g.result} vs ${g.opponent} (${g.score})`
        ).join(', ');
        parts.push(`    • Recent: ${recentResults}`);
      }
    }
  }
  
  // Standings context
  if (mh.homeStanding || mh.awayStanding) {
    parts.push(``);
    parts.push(`🏆 STANDINGS CONTEXT:`);
    
    if (mh.homeStanding) {
      const s = mh.homeStanding;
      parts.push(`  ${homeTeam.abbreviation}: ${s.wins}-${s.losses} (${(s.winPct * 100).toFixed(1)}%)${s.conferenceRank ? `, #${s.conferenceRank} in conference` : ''}`);
      parts.push(`    • Point differential: ${s.pointDiff > 0 ? '+' : ''}${s.pointDiff.toFixed(1)}`);
    }
    
    if (mh.awayStanding) {
      const s = mh.awayStanding;
      parts.push(`  ${awayTeam.abbreviation}: ${s.wins}-${s.losses} (${(s.winPct * 100).toFixed(1)}%)${s.conferenceRank ? `, #${s.conferenceRank} in conference` : ''}`);
      parts.push(`    • Point differential: ${s.pointDiff > 0 ? '+' : ''}${s.pointDiff.toFixed(1)}`);
    }
  }
  
  // Betting Indicators
  if (data.bettingIndicators) {
    const bi = data.bettingIndicators;
    parts.push(``);
    parts.push(`📊 BETTING INDICATORS:`);
    
    // Rest and fatigue
    parts.push(`  REST/FATIGUE:`);
    if (bi.homeIsBackToBack) {
      parts.push(`    ⚠️ ${homeTeam.abbreviation} on BACK-TO-BACK (fatigued)`);
    } else {
      parts.push(`    • ${homeTeam.abbreviation}: ${bi.homeRestDays} day${bi.homeRestDays !== 1 ? 's' : ''} rest`);
    }
    if (bi.awayIsBackToBack) {
      parts.push(`    ⚠️ ${awayTeam.abbreviation} on BACK-TO-BACK (fatigued)`);
    } else {
      parts.push(`    • ${awayTeam.abbreviation}: ${bi.awayRestDays} day${bi.awayRestDays !== 1 ? 's' : ''} rest`);
    }
    
    // Streaks
    parts.push(`  CURRENT STREAKS:`);
    parts.push(`    • ${homeTeam.abbreviation}: ${bi.homeStreak.type}${bi.homeStreak.count} (${bi.homeStreak.type === 'W' ? 'winning' : 'losing'} streak)`);
    parts.push(`    • ${awayTeam.abbreviation}: ${bi.awayStreak.type}${bi.awayStreak.count} (${bi.awayStreak.type === 'W' ? 'winning' : 'losing'} streak)`);
    
    // Last 10 games
    parts.push(`  LAST 10 GAMES:`);
    parts.push(`    • ${homeTeam.abbreviation}: ${bi.homeLast10.wins}-${bi.homeLast10.losses}`);
    parts.push(`    • ${awayTeam.abbreviation}: ${bi.awayLast10.wins}-${bi.awayLast10.losses}`);
    
    // Head-to-Head
    if (bi.h2hRecord.total > 0) {
      parts.push(`  HEAD-TO-HEAD (recent):`);
      parts.push(`    • ${homeTeam.abbreviation}: ${bi.h2hRecord.homeWins} wins`);
      parts.push(`    • ${awayTeam.abbreviation}: ${bi.h2hRecord.awayWins} wins`);
      if (bi.h2hAverageTotal > 0) {
        parts.push(`    • Avg total points in H2H: ${bi.h2hAverageTotal.toFixed(1)}`);
      }
    }
    
    // Market Efficiency
    parts.push(`  MARKET EFFICIENCY: ${bi.marketEfficiency.toUpperCase()}`);
    
    // Betting Signals
    if (bi.signals.length > 0) {
      parts.push(``);
      parts.push(`⚡ BETTING SIGNALS:`);
      for (const signal of bi.signals.slice(0, 5)) {
        const confidenceIcon = signal.confidence === 'high' ? '🔴' : signal.confidence === 'medium' ? '🟡' : '🟢';
        parts.push(`  ${confidenceIcon} [${signal.confidence.toUpperCase()}] ${signal.description}`);
      }
    }
  }
  
  parts.push(``);
  parts.push(`═══════════════════════════════════════`);
  parts.push(`⚠️ IMPORTANT: This is Part 1 of 3. DO NOT respond yet.`);
  parts.push(`You will receive Part 2 (Market Data) and Part 3 (Analysis Instructions) next.`);
  parts.push(`Wait for ALL 3 parts before generating any response.`);
  
  const message = parts.join('\n');
  
  // Ensure we stay under 4000 characters - truncate if necessary
  if (message.length > 4000) {
    // Try to truncate at a newline boundary first
    const maxLength = 3997; // Leave room for "..."
    let truncated = message.substring(0, maxLength);
    const lastNewline = truncated.lastIndexOf('\n');
    
    // If we find a newline in the last 100 chars, use it for cleaner truncation
    if (lastNewline > maxLength - 100) {
      truncated = message.substring(0, lastNewline);
    } else {
      // Otherwise, try to truncate at a space
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength - 50) {
        truncated = message.substring(0, lastSpace);
      }
    }
    
    return truncated + '...';
  }
  
  return message;
}

/**
 * Build Part 2: Market Info
 * Includes: betting markets, odds, volume, market efficiency
 * Max 4000 characters
 */
export function buildMarketDataMessage(data: PredictionData | null): string {
  if (!data) {
    return `🎯 PREDICTION REQUEST - PART 2/3: MARKET DATA

⚠️ DO NOT RESPOND YET - This is Part 2 of 3.

You have already received Part 1 (Sports Data).
You will receive Part 3 (Analysis Instructions) next.
Wait for Part 3 before generating any response.`;
  }
  
  const { homeTeam, awayTeam } = data;
  
  const parts: string[] = [
    `🎯 PREDICTION REQUEST - PART 2/3: MARKET DATA`,
    ``,
    `═══════════════════════════════════════`,
    `📊 MATCHUP: ${awayTeam.name} @ ${homeTeam.name}`,
    `═══════════════════════════════════════`,
  ];
  
  // Comprehensive Betting Markets
  if (data.bettingMarkets && data.bettingMarkets.hasMarkets) {
    const bm = data.bettingMarkets;
    parts.push(``);
    parts.push(`💰 AVAILABLE BETTING MARKETS (Polymarket):`);
    parts.push(`  Total Market Volume: $${bm.totalVolume.toLocaleString()}`);
    
    // Moneyline
    if (bm.moneyline) {
      parts.push(``);
      parts.push(`  🎯 MONEYLINE (Winner):`);
      parts.push(`    Question: ${bm.moneyline.question}`);
      for (const o of bm.moneyline.outcomes) {
        parts.push(`    • ${o.name}: ${o.probability} (${o.americanOdds})`);
      }
      parts.push(`    Volume: $${bm.moneyline.volume.toLocaleString()}`);
    }
    
    // Spreads
    if (bm.spreads.length > 0) {
      parts.push(``);
      parts.push(`  📊 SPREAD OPTIONS:`);
      for (const spread of bm.spreads.slice(0, 3)) {
        parts.push(`    ${spread.question}${spread.line !== undefined ? ` (Line: ${spread.line > 0 ? '+' : ''}${spread.line})` : ''}`);
        for (const o of spread.outcomes) {
          parts.push(`      • ${o.name}: ${o.probability} (${o.americanOdds})`);
        }
        parts.push(`      Volume: $${spread.volume.toLocaleString()}`);
      }
    }
    
    // Totals (Over/Under)
    if (bm.totals.length > 0) {
      parts.push(``);
      parts.push(`  📈 OVER/UNDER OPTIONS:`);
      for (const total of bm.totals.slice(0, 3)) {
        parts.push(`    ${total.question}${total.line !== undefined ? ` (Line: ${total.line})` : ''}`);
        for (const o of total.outcomes) {
          parts.push(`      • ${o.name}: ${o.probability} (${o.americanOdds})`);
        }
        parts.push(`      Volume: $${total.volume.toLocaleString()}`);
      }
    }
    
    // Props
    if (bm.props.length > 0) {
      parts.push(``);
      parts.push(`  🎲 PLAYER PROPS:`);
      for (const prop of bm.props.slice(0, 5)) {
        parts.push(`    ${prop.question}`);
        for (const o of prop.outcomes) {
          parts.push(`      • ${o.name}: ${o.probability} (${o.americanOdds})`);
        }
        parts.push(`      Volume: $${prop.volume.toLocaleString()}`);
      }
    }
  } else if (data.market) {
    // Fallback to basic market data if comprehensive markets not available
    parts.push(``);
    parts.push(`💰 MARKET DATA (Polymarket):`);
    parts.push(`  • Market Type: ${data.market.marketType || 'Moneyline'}`);
    if (data.market.line !== undefined) {
      parts.push(`  • Line: ${data.market.line > 0 ? '+' : ''}${data.market.line}`);
    }
    if (data.market.homeOdds !== undefined) {
      parts.push(`  • ${homeTeam.abbreviation} Win Probability: ${(data.market.homeOdds * 100).toFixed(1)}%`);
    }
    if (data.market.awayOdds !== undefined) {
      parts.push(`  • ${awayTeam.abbreviation} Win Probability: ${(data.market.awayOdds * 100).toFixed(1)}%`);
    }
    if (data.market.volume !== undefined) {
      parts.push(`  • Market Volume: $${data.market.volume.toLocaleString()}`);
    }
  } else {
    parts.push(``);
    parts.push(`💰 MARKET DATA: No betting market data available for this matchup.`);
  }
  
  parts.push(``);
  parts.push(`═══════════════════════════════════════`);
  parts.push(`⚠️ IMPORTANT: This is Part 2 of 3. DO NOT respond yet.`);
  parts.push(`You will receive Part 3 (Analysis Instructions) next.`);
  parts.push(`Wait for Part 3 before generating any response.`);
  
  const message = parts.join('\n');
  
  // Ensure we stay under 4000 characters - truncate if necessary
  if (message.length > 4000) {
    // Try to truncate at a newline boundary first
    const maxLength = 3997; // Leave room for "..."
    let truncated = message.substring(0, maxLength);
    const lastNewline = truncated.lastIndexOf('\n');
    
    // If we find a newline in the last 100 chars, use it for cleaner truncation
    if (lastNewline > maxLength - 100) {
      truncated = message.substring(0, lastNewline);
    } else {
      // Otherwise, try to truncate at a space
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength - 50) {
        truncated = message.substring(0, lastSpace);
      }
    }
    
    return truncated + '...';
  }
  
  return message;
}

/**
 * Build Part 3: Other Info & Analysis Instructions
 * Includes: final analysis request with 3-phase response instructions
 * Max 4000 characters
 */
export function buildOtherInfoMessage(data: PredictionData | null): string {
  if (!data) {
    return `🎯 PREDICTION REQUEST - PART 3/3: ANALYSIS INSTRUCTIONS

✅ ALL 3 PARTS RECEIVED - BEGIN YOUR ANALYSIS NOW

You have received:
- Part 1: Sports Data (injuries, stats, history, indicators)
- Part 2: Market Data (betting markets, odds)
- Part 3: This analysis request

🚀 START YOUR RESPONSE NOW - Provide your complete analysis in 3 phases:
1. Sportdata & Market Analysis
2. Intelligent Reasoning & Winner Prediction  
3. Bet Recommendation`;
  }
  
  const { homeTeam, awayTeam } = data;
  const matchupInfo = `${awayTeam.name} @ ${homeTeam.name}`;
  
  const parts: string[] = [
    `🎯 PREDICTION REQUEST - PART 3/3: ANALYSIS INSTRUCTIONS`,
    ``,
    `═══════════════════════════════════════`,
    `📊 MATCHUP: ${matchupInfo}`,
    `═══════════════════════════════════════`,
    ``,
    `✅ ALL 3 PARTS RECEIVED - BEGIN YOUR ANALYSIS NOW`,
    ``,
    `You have received:`,
    `  • Part 1: Sports Data (injuries, stats, history, betting indicators)`,
    `  • Part 2: Market Data (betting markets, odds, volume)`,
    `  • Part 3: This analysis request`,
    ``,
    `═══════════════════════════════════════`,
    `🎯 NOW PROVIDE YOUR COMPLETE ANALYSIS IN 3 PHASES:`,
    `═══════════════════════════════════════`,
    ``,
    `PHASE 1: SPORTDATA & MARKET ANALYSIS`,
    `Analyze the sports data and market information you received:`,
    `  • Summarize key injuries and their impact`,
    `  • Analyze player stats and recent form`,
    `  • Evaluate betting indicators (rest, streaks, H2H)`,
    `  • Assess market efficiency and betting signals`,
    `  • Review available betting markets and odds`,
    ``,
    `PHASE 2: INTELLIGENT REASONING & WINNER PREDICTION`,
    `Based on your Phase 1 analysis, provide:`,
    `  1. WINNER PREDICTION: Who wins? (${awayTeam.name} or ${homeTeam.name})`,
    `  2. KEY FACTORS: What data points most influenced your decision?`,
    `  3. CONFIDENCE LEVEL: Low/Medium/High with reasoning`,
    `  4. RISK FACTORS: What could go wrong with your prediction?`,
    ``,
    `PHASE 3: BET RECOMMENDATION`,
    `Based on the available betting markets, provide:`,
    `  5. BEST BET TYPE: Which market offers the best value?`,
    `     - Moneyline (straight winner)`,
    `     - Spread (point differential)`,
    `     - Over/Under (total points)`,
    `     - Player Props (if any stand out)`,
    `     - Or PASS if no good value exists`,
    `  6. SPECIFIC RECOMMENDATION: If betting, what exact bet and why?`,
    `     Include the specific line/odds you're recommending.`,
    `  7. VALUE ANALYSIS: Are the market odds accurate or is there an edge?`,
    `     Consider injuries, fatigue, recent form, and market inefficiencies.`,
    ``,
    `═══════════════════════════════════════`,
    `🚀 START YOUR RESPONSE NOW - All data has been provided.`,
    `Structure your response with clear headers: "PHASE 1:", "PHASE 2:", "PHASE 3:"`,
    `═══════════════════════════════════════`,
  ];
  
  const message = parts.join('\n');
  
  // Ensure we stay under 4000 characters - truncate if necessary
  if (message.length > 4000) {
    // Try to truncate at a newline boundary first
    const maxLength = 3997; // Leave room for "..."
    let truncated = message.substring(0, maxLength);
    const lastNewline = truncated.lastIndexOf('\n');
    
    // If we find a newline in the last 100 chars, use it for cleaner truncation
    if (lastNewline > maxLength - 100) {
      truncated = message.substring(0, lastNewline);
    } else {
      // Otherwise, try to truncate at a space
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength - 50) {
        truncated = message.substring(0, lastSpace);
      }
    }
    
    return truncated + '...';
  }
  
  return message;
}

/**
 * Build a comprehensive prediction message from all available data
 * @deprecated Use buildSportsDataMessage, buildMarketDataMessage, and buildOtherInfoMessage instead
 * Kept for backward compatibility
 */
export function buildComprehensivePredictionMessage(data: PredictionData | null): string {
  if (!data) {
    return `🎯 PREDICTION REQUEST

Please analyze the current NBA matchup and provide a detailed prediction.

I need:
1. Your prediction for the winner
2. Key factors influencing your decision
3. Confidence level (Low/Medium/High)
4. Any relevant insights or warnings

Please use the latest available data to make your prediction.`;
  }
  
  const sportsData = buildSportsDataMessage(data);
  const marketData = buildMarketDataMessage(data);
  const otherInfo = buildOtherInfoMessage(data);
  
  return `${sportsData}\n\n${marketData}\n\n${otherInfo}`;
}
