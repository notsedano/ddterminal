import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useMemo, useEffect, useState } from 'react';
import { getNBAGameBoxscore, getNBATeamStats } from '@/services/api/sportradar';
import type { 
  NBAGameSummary, 
  NBAPlayerStatistics,
  NBATeamSeasonalStats,
  NBASeasonPlayerStats,
  MatchPanelGame,
  NBATeamInjuries,
  NBAInjuredPlayer,
} from '@/types';

export interface PlayerGameStats {
  id: string;
  name: string;
  team: 'home' | 'away';
  teamAlias: string;
  points: number;
  fieldGoalPct: number;
  threePointPct: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personalFouls: number;
  plusMinus: number;
  minutes: string;
  onCourt: boolean;
  bettingImpact: 'high' | 'medium' | 'low';
  // Additional stats for sorting
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointsMade: number;
  threePointsAttempted: number;
  // Season average indicator (for pre-game)
  isSeasonAverage: boolean;
  // Injury status
  injuryStatus?: 'Out' | 'Doubtful' | 'Questionable' | 'Probable' | 'Day-To-Day';
  isInjured?: boolean;
}

export type SortField = 'points' | 'fieldGoalPct' | 'threePointPct' | 'rebounds' | 'assists' | 'plusMinus' | 'minutes';
export type SortDirection = 'asc' | 'desc';

interface UseGameStatsOptions {
  gameId: string | null;
  game: MatchPanelGame | null;
  autoRefresh?: boolean;
  homeInjuries?: NBATeamInjuries | null;
  awayInjuries?: NBATeamInjuries | null;
  preferSeasonStats?: boolean; // User preference to show season stats even for live games
}

interface UseGameStatsResult {
  homePlayers: PlayerGameStats[];
  awayPlayers: PlayerGameStats[];
  isLoading: boolean;
  error: Error | null;
  isSeasonStats: boolean;
  sortPlayers: (players: PlayerGameStats[], field: SortField, direction: SortDirection) => PlayerGameStats[];
  getTopScorer: (team: 'home' | 'away') => PlayerGameStats | null;
  getHotHandPlayers: (team: 'home' | 'away') => PlayerGameStats[];
}

function calculateBettingImpact(
  player: PlayerGameStats,
  teamTotalPoints: number
): 'high' | 'medium' | 'low' {
  if (teamTotalPoints === 0) return 'low';
  
  if (player.points / teamTotalPoints > 0.25 || player.plusMinus > 10) {
    return 'high';
  }
  
  if (player.points / teamTotalPoints > 0.15 || (player.plusMinus > 3 && player.plusMinus <= 10)) {
    return 'medium';
  }
  
  return 'low';
}

function findPlayerInjury(
  playerId: string,
  playerName: string,
  injuries: NBATeamInjuries | null
): NBAInjuredPlayer | null {
  if (!injuries?.players) return null;
  
  const normalizedName = playerName.toLowerCase().trim();
  
  return injuries.players.find(injuredPlayer => {
    if (injuredPlayer.id === playerId || injuredPlayer.sr_id === playerId || injuredPlayer.reference === playerId) {
      return true;
    }
    
    const injuredName = injuredPlayer.full_name.toLowerCase().trim();
    if (injuredName === normalizedName || 
        injuredName.includes(normalizedName) || 
        normalizedName.includes(injuredName)) {
      return true;
    }
    
    const injuredParts = injuredName.split(' ');
    const playerParts = normalizedName.split(' ');
    if (injuredParts.length >= 2 && playerParts.length >= 2) {
      if (injuredParts[0] === playerParts[0] && 
          injuredParts[injuredParts.length - 1] === playerParts[playerParts.length - 1]) {
        return true;
      }
    }
    
    return false;
  }) || null;
}

function extractPlayerStatsFromBoxscore(
  boxscore: NBAGameSummary,
  team: 'home' | 'away',
  injuries?: NBATeamInjuries | null
): PlayerGameStats[] {
  const teamData = boxscore[team];
  if (!teamData?.players) return [];

  const teamTotalPoints = teamData.points || 0;
  const players: PlayerGameStats[] = [];

  for (const player of teamData.players) {
    if (!player.statistics && !player.played) continue;
    
    const stats = player.statistics;
    if (!stats) continue;
    
    const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
    const injuredPlayer = findPlayerInjury(player.id, playerName, injuries ?? null);
    const primaryInjury = injuredPlayer?.injuries?.[0];
    
    const playerStats: PlayerGameStats = {
      id: player.id,
      name: playerName,
      team,
      teamAlias: teamData.alias,
      points: stats.points || 0,
      fieldGoalPct: stats.field_goals_pct || 0,
      threePointPct: stats.three_points_pct || 0,
      rebounds: stats.rebounds || 0,
      assists: stats.assists || 0,
      steals: stats.steals || 0,
      blocks: stats.blocks || 0,
      turnovers: stats.turnovers || 0,
      personalFouls: stats.personal_fouls || 0,
      plusMinus: stats.plus_minus ?? stats.pls_min ?? 0,
      minutes: stats.minutes || '0:00',
      onCourt: player.on_court ?? false,
      bettingImpact: 'low',
      fieldGoalsMade: stats.field_goals_made || 0,
      fieldGoalsAttempted: stats.field_goals_att || 0,
      threePointsMade: stats.three_points_made || 0,
      threePointsAttempted: stats.three_points_att || 0,
      isSeasonAverage: false,
      injuryStatus: primaryInjury?.status as PlayerGameStats['injuryStatus'],
      isInjured: !!injuredPlayer,
    };

    playerStats.bettingImpact = calculateBettingImpact(playerStats, teamTotalPoints);
    players.push(playerStats);
  }

  return players;
}

function normalizePercentage(value: number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (value > 0 && value < 1) {
    return value * 100;
  }
  return value;
}

function getPlayerStats(player: NBASeasonPlayerStats): NBAPlayerStatistics | null {
  if (player.average && typeof player.average.points === 'number') {
    return player.average;
  }
  if (player.total && typeof player.total.points === 'number') {
    return player.total;
  }
  const anyPlayer = player as NBASeasonPlayerStats & { statistics?: NBAPlayerStatistics };
  if (anyPlayer.statistics && typeof anyPlayer.statistics.points === 'number') {
    return anyPlayer.statistics;
  }
  return null;
}

function extractNumber(stats: Record<string, unknown>, ...fieldNames: string[]): number {
  for (const name of fieldNames) {
    const value = stats[name];
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
  }
  return 0;
}

function extractPercentage(
  stats: Record<string, unknown>,
  pctFields: string[],
  madeFields: string[],
  attFields: string[]
): number {
  const pctValue = extractNumber(stats, ...pctFields);
  if (pctValue > 0) {
    return normalizePercentage(pctValue);
  }
  
  const made = extractNumber(stats, ...madeFields);
  const att = extractNumber(stats, ...attFields);
  return att > 0 && made >= 0 ? (made / att) * 100 : 0;
}

const extractFgPct = (stats: Record<string, unknown>) =>
  extractPercentage(
    stats,
    ['field_goals_pct', 'fg_pct', 'fieldGoalsPct', 'fgPct', 'field_goal_pct', 'fg_percentage'],
    ['field_goals_made', 'fg_made', 'fgm', 'field_goals'],
    ['field_goals_att', 'fg_att', 'fga', 'field_goals_attempted']
  );

const extractThreePtPct = (stats: Record<string, unknown>) =>
  extractPercentage(
    stats,
    ['three_points_pct', 'fg3_pct', 'threePointsPct', 'three_pt_pct', 'three_point_pct', 'fg3_percentage', 'three_pct'],
    ['three_points_made', 'fg3_made', 'three_pt_made', 'fg3m', 'threes_made'],
    ['three_points_att', 'fg3_att', 'three_pt_att', 'fg3a', 'threes_attempted']
  );

const extractFgMade = (stats: Record<string, unknown>) =>
  extractNumber(stats, 'field_goals_made', 'fg_made', 'fgm', 'field_goals');

const extractFgAtt = (stats: Record<string, unknown>) =>
  extractNumber(stats, 'field_goals_att', 'fg_att', 'fga', 'field_goals_attempted');

const extractThreeMade = (stats: Record<string, unknown>) =>
  extractNumber(stats, 'three_points_made', 'fg3_made', 'three_pt_made', 'fg3m', 'threes_made');

const extractThreeAtt = (stats: Record<string, unknown>) =>
  extractNumber(stats, 'three_points_att', 'fg3_att', 'three_pt_att', 'fg3a', 'threes_attempted');

function extractPlayerStatsFromSeasonStats(
  teamStats: NBATeamSeasonalStats,
  team: 'home' | 'away',
  injuries?: NBATeamInjuries | null
): PlayerGameStats[] {
  if (!teamStats?.players || teamStats.players.length === 0) {
    return [];
  }

  const teamAvgPoints = teamStats.statistics?.average?.points || 100;
  const players: PlayerGameStats[] = [];

  for (const player of teamStats.players) {
    const stats = getPlayerStats(player);
    if (!stats) continue;

    const statsObj = stats as unknown as Record<string, unknown>;
    const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
    const injuredPlayer = findPlayerInjury(player.id, playerName, injuries ?? null);
    const primaryInjury = injuredPlayer?.injuries?.[0];

    const playerStats: PlayerGameStats = {
      id: player.id,
      name: playerName,
      team,
      teamAlias: teamStats.alias,
      points: extractNumber(statsObj, 'points', 'pts', 'ppg') || 0,
      fieldGoalPct: extractFgPct(statsObj),
      threePointPct: extractThreePtPct(statsObj),
      rebounds: extractNumber(statsObj, 'rebounds', 'reb', 'rpg', 'total_rebounds') || 0,
      assists: extractNumber(statsObj, 'assists', 'ast', 'apg') || 0,
      steals: extractNumber(statsObj, 'steals', 'stl', 'spg') || 0,
      blocks: extractNumber(statsObj, 'blocks', 'blk', 'bpg') || 0,
      turnovers: extractNumber(statsObj, 'turnovers', 'tov', 'to') || 0,
      personalFouls: extractNumber(statsObj, 'personal_fouls', 'pf', 'fouls') || 0,
      plusMinus: extractNumber(statsObj, 'plus_minus', 'pls_min', 'pm') || 0,
      minutes: (statsObj.minutes as string) || (statsObj.min as string) || '0:00',
      onCourt: false,
      bettingImpact: 'low',
      fieldGoalsMade: extractFgMade(statsObj),
      fieldGoalsAttempted: extractFgAtt(statsObj),
      threePointsMade: extractThreeMade(statsObj),
      threePointsAttempted: extractThreeAtt(statsObj),
      isSeasonAverage: true,
      injuryStatus: primaryInjury?.status as PlayerGameStats['injuryStatus'],
      isInjured: !!injuredPlayer,
    };

    playerStats.bettingImpact = calculateBettingImpact(playerStats, teamAvgPoints);
    players.push(playerStats);
  }

  return players
    .sort((a, b) => b.points - a.points)
    .slice(0, 15);
}

function sortPlayers(
  players: PlayerGameStats[],
  field: SortField,
  direction: SortDirection
): PlayerGameStats[] {
  const sorted = [...players].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (field) {
      case 'points':
        aValue = a.points;
        bValue = b.points;
        break;
      case 'fieldGoalPct':
        if (a.fieldGoalsAttempted < (a.isSeasonAverage ? 1 : 5)) aValue = -1;
        else aValue = a.fieldGoalPct;
        if (b.fieldGoalsAttempted < (b.isSeasonAverage ? 1 : 5)) bValue = -1;
        else bValue = b.fieldGoalPct;
        break;
      case 'threePointPct':
        if (a.threePointsAttempted < (a.isSeasonAverage ? 1 : 3)) aValue = -1;
        else aValue = a.threePointPct;
        if (b.threePointsAttempted < (b.isSeasonAverage ? 1 : 3)) bValue = -1;
        else bValue = b.threePointPct;
        break;
      case 'rebounds':
        aValue = a.rebounds;
        bValue = b.rebounds;
        break;
      case 'assists':
        aValue = a.assists;
        bValue = b.assists;
        break;
      case 'plusMinus':
        aValue = a.plusMinus;
        bValue = b.plusMinus;
        break;
      case 'minutes':
        const parseMinutes = (minStr: string): number => {
          const parts = minStr.split(':');
          if (parts.length !== 2) return parseFloat(minStr) || 0;
          return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
        };
        aValue = parseMinutes(a.minutes);
        bValue = parseMinutes(b.minutes);
        break;
      default:
        return 0;
    }

    return direction === 'asc' ? aValue - bValue : bValue - aValue;
  });

  return sorted;
}

function getTopScorer(players: PlayerGameStats[]): PlayerGameStats | null {
  if (players.length === 0) return null;
  return sortPlayers(players, 'points', 'desc')[0];
}

function getHotHandPlayers(players: PlayerGameStats[]): PlayerGameStats[] {
  return players.filter(
    player =>
      !player.isSeasonAverage &&
      ((player.fieldGoalPct > 50 && player.fieldGoalsAttempted >= 5) ||
       (player.threePointPct > 40 && player.threePointsAttempted >= 3))
  );
}

function isGameLiveOrCompleted(game: MatchPanelGame | null): boolean {
  if (!game) return false;
  return game.isLive || game.status === 'complete' || game.status === 'closed';
}

export function useGameStats(options: UseGameStatsOptions): UseGameStatsResult {
  const { gameId, game, autoRefresh = true, homeInjuries, awayInjuries, preferSeasonStats = false } = options;
  const queryClient = useQueryClient();
  
  const isLiveOrCompleted = isGameLiveOrCompleted(game);
  const shouldUseBoxscore = isLiveOrCompleted && !preferSeasonStats;
  const homeTeamId = game?.home.team.id;
  const awayTeamId = game?.away.team.id;

  const boxscoreQuery = useQuery<NBAGameSummary, Error>({
    queryKey: ['nba-game-boxscore', gameId],
    queryFn: () => {
      if (!gameId) throw new Error('No game ID provided');
      return getNBAGameBoxscore(gameId);
    },
    enabled: !!gameId && shouldUseBoxscore,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (!autoRefresh || !gameId || !game?.isLive) return false;
      const data = query.state.data;
      if (data && (data.status === 'inprogress' || data.status === 'halftime')) {
        return 15 * 1000;
      }
      return false;
    },
  });

  const {
    data: boxscore,
    isLoading: boxscoreLoading,
    error: boxscoreError,
    refetch: refetchBoxscore,
  } = boxscoreQuery;

  const [prevShouldUseBoxscore, setPrevShouldUseBoxscore] = useState(shouldUseBoxscore);
  
  useEffect(() => {
    if (shouldUseBoxscore && !prevShouldUseBoxscore && gameId) {
      queryClient.removeQueries({ queryKey: ['nba-game-boxscore', gameId] });
      setTimeout(() => {
        refetchBoxscore();
      }, 100);
    }
    setPrevShouldUseBoxscore(shouldUseBoxscore);
  }, [shouldUseBoxscore, prevShouldUseBoxscore, gameId, refetchBoxscore, queryClient]);

  const seasonStatsQueries = useQueries({
    queries: [
      {
        queryKey: ['nba-team-season-stats', homeTeamId],
        queryFn: () => {
          if (!homeTeamId) throw new Error('No home team ID');
          return getNBATeamStats(homeTeamId);
        },
        enabled: !!homeTeamId,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      },
      {
        queryKey: ['nba-team-season-stats', awayTeamId],
        queryFn: () => {
          if (!awayTeamId) throw new Error('No away team ID');
          return getNBATeamStats(awayTeamId);
        },
        enabled: !!awayTeamId,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      },
    ],
  });

  const homeSeasonStats = seasonStatsQueries[0].data;
  const awaySeasonStats = seasonStatsQueries[1].data;
  const seasonStatsLoading = seasonStatsQueries.some(q => q.isLoading);
  const seasonStatsError = seasonStatsQueries.find(q => q.error)?.error as Error | undefined;

  const { homePlayers, awayPlayers, isSeasonStats } = useMemo(() => {
    if (preferSeasonStats || !isLiveOrCompleted) {
      if (homeSeasonStats || awaySeasonStats) {
        const home = homeSeasonStats 
          ? extractPlayerStatsFromSeasonStats(homeSeasonStats, 'home', homeInjuries)
          : [];
        const away = awaySeasonStats
          ? extractPlayerStatsFromSeasonStats(awaySeasonStats, 'away', awayInjuries)
          : [];
        return { homePlayers: home, awayPlayers: away, isSeasonStats: true };
      }
      return { homePlayers: [], awayPlayers: [], isSeasonStats: true };
    }
    
    if (shouldUseBoxscore) {
      if (boxscore) {
        const home = extractPlayerStatsFromBoxscore(boxscore, 'home', homeInjuries);
        const away = extractPlayerStatsFromBoxscore(boxscore, 'away', awayInjuries);
        
        if (home.length > 0 || away.length > 0) {
          return { homePlayers: home, awayPlayers: away, isSeasonStats: false };
        }
        
        if (homeSeasonStats || awaySeasonStats) {
          const homeFallback = homeSeasonStats 
            ? extractPlayerStatsFromSeasonStats(homeSeasonStats, 'home', homeInjuries)
            : [];
          const awayFallback = awaySeasonStats
            ? extractPlayerStatsFromSeasonStats(awaySeasonStats, 'away', awayInjuries)
            : [];
          if (homeFallback.length > 0 || awayFallback.length > 0) {
            return { homePlayers: homeFallback, awayPlayers: awayFallback, isSeasonStats: true };
          }
        }
        
        return { homePlayers: home, awayPlayers: away, isSeasonStats: false };
      }
      
      return { homePlayers: [], awayPlayers: [], isSeasonStats: false };
    }
    
    if (homeSeasonStats || awaySeasonStats) {
      const home = homeSeasonStats 
        ? extractPlayerStatsFromSeasonStats(homeSeasonStats, 'home', homeInjuries)
        : [];
      const away = awaySeasonStats
        ? extractPlayerStatsFromSeasonStats(awaySeasonStats, 'away', awayInjuries)
        : [];
      return { homePlayers: home, awayPlayers: away, isSeasonStats: true };
    }

    return { homePlayers: [], awayPlayers: [], isSeasonStats: false };
  }, [shouldUseBoxscore, preferSeasonStats, isLiveOrCompleted, boxscore, homeSeasonStats, awaySeasonStats, homeInjuries, awayInjuries]);

  const isLoading = shouldUseBoxscore 
    ? boxscoreLoading || (boxscoreQuery.isEnabled && !boxscore && !boxscoreError && boxscoreQuery.status === 'pending')
    : seasonStatsLoading;
  
  const error: Error | null = shouldUseBoxscore 
    ? (boxscoreError || null) 
    : (seasonStatsError || null);

  return {
    homePlayers,
    awayPlayers,
    isLoading,
    error: error ?? null,
    isSeasonStats,
    sortPlayers,
    getTopScorer: (team: 'home' | 'away') => {
      const players = team === 'home' ? homePlayers : awayPlayers;
      return getTopScorer(players);
    },
    getHotHandPlayers: (team: 'home' | 'away') => {
      const players = team === 'home' ? homePlayers : awayPlayers;
      return getHotHandPlayers(players);
    },
  };
}
