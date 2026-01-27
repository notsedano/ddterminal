/**
 * Sportradar API Service
 * Uses Vite proxy for local development, Vercel serverless in production
 */

import type {
  NBADailySchedule,
  NBADailyInjuries,
  NBAGameSummary,
  SportradarAPIResponse,
  SportradarAPIError,
  NBAGame,
  MatchPanelGame,
  NBAStandings,
  NBASeasonSchedule,
  NBATeamSeasonalStats,
  NBATeamStanding,
  TeamMatchHistory,
  MatchResult,
} from '@/types';
import { transformToMatchPanelGame, isGameComplete } from '@/types';

// Detect environment and use appropriate API base
const IS_DEV = import.meta.env.DEV;
const ACCESS_LEVEL = import.meta.env.VITE_SPORTRADAR_ACCESS_LEVEL || 'production';

// In development, use Vite proxy directly to Sportradar
// In production, use Vercel serverless functions
const API_BASE = IS_DEV ? '/api/sportradar' : '/api/sports';
const API_VERSION = 'v8';

interface LiveGameUpdate {
  id: string;
  status: string;
  clock?: string;
  quarter?: number;
  home: {
    id: string;
    name: string;
    market: string;
    alias: string;
    points: number;
  };
  away: {
    id: string;
    name: string;
    market: string;
    alias: string;
    points: number;
  };
}

interface LiveGamesResponse {
  updates: LiveGameUpdate[];
  errors?: Array<{ gameId: string; error: string }>;
}

/**
 * Build the API URL based on environment
 * Dev: Direct to Sportradar via Vite proxy
 * Prod: Via Vercel serverless functions
 */
function buildApiUrl(endpoint: string, params?: Record<string, string | number>): string {
  if (IS_DEV) {
    // Development: Use Vite proxy -> Sportradar directly
    // The Vite proxy will add the API key
    const url = new URL(`${window.location.origin}${API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  } else {
    // Production: Use Vercel serverless proxy
    const url = new URL(`${window.location.origin}${API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  }
}

/**
 * Build Sportradar-specific URL path for dev mode
 */
function buildSportradarPath(type: 'schedule' | 'injuries' | 'game' | 'live', options?: {
  year?: number;
  month?: number;
  day?: number;
  gameId?: string;
}): string {
  const { year, month, day, gameId } = options || {};
  
  // Get current date in ET if not provided
  const now = new Date();
  const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const y = year || etDate.getFullYear();
  const m = (month || etDate.getMonth() + 1).toString().padStart(2, '0');
  const d = (day || etDate.getDate()).toString().padStart(2, '0');

  switch (type) {
    case 'schedule':
      return `/nba/${ACCESS_LEVEL}/${API_VERSION}/en/games/${y}/${m}/${d}/schedule.json`;
    case 'injuries':
      // Use league-wide injuries endpoint (all active injuries across all teams)
      // Not the daily_injuries endpoint which only shows injuries for games on that day
      return `/nba/${ACCESS_LEVEL}/${API_VERSION}/en/league/injuries.json`;
    case 'game':
      return `/nba/${ACCESS_LEVEL}/${API_VERSION}/en/games/${gameId}/summary.json`;
    case 'live':
      return `/nba/${ACCESS_LEVEL}/${API_VERSION}/en/games/${gameId}/boxscore.json`;
    default:
      throw new Error(`Unknown endpoint type: ${type}`);
  }
}

async function fetchFromApi<T>(
  endpoint: string,
  params?: Record<string, string | number>
): Promise<T> {
  const url = buildApiUrl(endpoint, params);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    if (IS_DEV) {
      // Direct Sportradar error format
      throw new Error(data.message || `Sportradar API error: ${response.status}`);
    } else {
      // Vercel proxy error format
      const errorData = data as SportradarAPIError;
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }
  }

  // In dev mode, Sportradar returns data directly
  // In prod mode, our proxy wraps it in { success, data, timestamp }
  if (IS_DEV) {
    return data as T;
  } else {
    return (data as SportradarAPIResponse<T>).data;
  }
}

/**
 * Fetch today's NBA schedule
 */
export async function getNBASchedule(date?: Date): Promise<NBADailySchedule> {
  const year = date?.getFullYear();
  const month = date ? date.getMonth() + 1 : undefined;
  const day = date?.getDate();

  if (IS_DEV) {
    // Direct Sportradar API via Vite proxy
    const path = buildSportradarPath('schedule', { year, month, day });
    return fetchFromApi<NBADailySchedule>(path);
  } else {
    // Vercel serverless proxy
    const params: Record<string, string | number> = {};
    if (year) params.year = year;
    if (month) params.month = month;
    if (day) params.day = day;
    return fetchFromApi<NBADailySchedule>('/schedule', params);
  }
}

/**
 * Fetch today's NBA schedule and transform to MatchPanelGame format
 */
export async function getNBAMatchPanelGames(date?: Date): Promise<MatchPanelGame[]> {
  const schedule = await getNBASchedule(date);
  
  if (!schedule.games || schedule.games.length === 0) {
    return [];
  }

  return schedule.games.map((game: NBAGame) => transformToMatchPanelGame(game));
}

/**
 * Fetch league-wide injuries report (all active injuries across all teams)
 * This returns ALL current injuries, not just for games on a specific day
 */
export async function getNBAInjuries(): Promise<NBADailyInjuries> {
  if (IS_DEV) {
    // Use league injuries endpoint - no date parameters needed
    const path = buildSportradarPath('injuries');
    return fetchFromApi<NBADailyInjuries>(path);
  } else {
    // Vercel serverless proxy - also uses league injuries endpoint now
    return fetchFromApi<NBADailyInjuries>('/injuries');
  }
}

/**
 * Fetch game summary/boxscore
 */
export async function getNBAGameSummary(gameId: string): Promise<NBAGameSummary> {
  if (IS_DEV) {
    const path = buildSportradarPath('game', { gameId });
    return fetchFromApi<NBAGameSummary>(path);
  } else {
    return fetchFromApi<NBAGameSummary>(`/game/${gameId}`, { type: 'summary' });
  }
}

/**
 * Fetch game boxscore (more detailed stats)
 */
export async function getNBAGameBoxscore(gameId: string): Promise<NBAGameSummary> {
  if (IS_DEV) {
    const path = buildSportradarPath('live', { gameId });
    return fetchFromApi<NBAGameSummary>(path);
  } else {
    return fetchFromApi<NBAGameSummary>(`/game/${gameId}`, { type: 'boxscore' });
  }
}

/**
 * Fetch live updates for multiple games
 */
export async function getNBALiveUpdates(gameIds: string[]): Promise<LiveGamesResponse> {
  if (gameIds.length === 0) {
    return { updates: [] };
  }

  if (IS_DEV) {
    // In dev mode, fetch each game's boxscore individually
    const updates: LiveGameUpdate[] = [];
    const errors: Array<{ gameId: string; error: string }> = [];

    await Promise.all(
      gameIds.map(async (gameId) => {
        const path = buildSportradarPath('live', { gameId });
        const data = await fetchFromApi<NBAGameSummary>(path).catch((err) => {
          errors.push({ gameId, error: err.message });
          return null;
        });
        
        if (data) {
          updates.push({
            id: data.id,
            status: data.status,
            clock: data.clock,
            quarter: data.quarter,
            home: {
              id: data.home.id,
              name: data.home.name,
              market: data.home.market,
              alias: data.home.alias,
              points: data.home.points ?? 0,
            },
            away: {
              id: data.away.id,
              name: data.away.name,
              market: data.away.market,
              alias: data.away.alias,
              points: data.away.points ?? 0,
            },
          });
        }
      })
    );

    return { updates, errors: errors.length > 0 ? errors : undefined };
  } else {
    return fetchFromApi<LiveGamesResponse>('/live', { gameIds: gameIds.join(',') });
  }
}

/**
 * Apply live updates to existing games
 */
export function applyLiveUpdatesToGames(
  games: MatchPanelGame[],
  updates: LiveGameUpdate[]
): MatchPanelGame[] {
  const updateMap = new Map(updates.map(u => [u.id, u]));

  return games.map(game => {
    const update = updateMap.get(game.id);
    if (!update) return game;

    return {
      ...game,
      status: update.status as MatchPanelGame['status'],
      isLive: update.status === 'inprogress' || update.status === 'halftime',
      home: {
        ...game.home,
        score: update.home.points,
      },
      away: {
        ...game.away,
        score: update.away.points,
      },
      clock: update.quarter && update.clock ? {
        quarter: update.quarter,
        time: update.clock,
      } : game.clock,
    };
  });
}

/**
 * Sort games by status (live first, then upcoming, then completed)
 */
export function sortGamesByStatus(games: MatchPanelGame[]): MatchPanelGame[] {
  return [...games].sort((a, b) => {
    // Live games first
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;

    // Then by status priority
    const statusPriority: Record<string, number> = {
      'inprogress': 0,
      'halftime': 1,
      'scheduled': 2,
      'created': 2,
      'time-tbd': 3,
      'delayed': 4,
      'postponed': 5,
      'complete': 6,
      'closed': 6,
      'cancelled': 7,
      'unnecessary': 8,
      'if-necessary': 9,
    };

    const aPriority = statusPriority[a.status] ?? 10;
    const bPriority = statusPriority[b.status] ?? 10;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Finally by scheduled time
    return a.scheduledTime.getTime() - b.scheduledTime.getTime();
  });
}

/**
 * Get only games that are live or upcoming
 */
export function getActiveGames(games: MatchPanelGame[]): MatchPanelGame[] {
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  return games.filter(game => {
    // Include all live games
    if (game.isLive) return true;

    // Include scheduled games
    if (game.status === 'scheduled' || game.status === 'created' || game.status === 'time-tbd') {
      return true;
    }

    // Include recently completed games (within 6 hours)
    if (game.status === 'complete' || game.status === 'closed') {
      return game.scheduledTime > sixHoursAgo;
    }

    return false;
  });
}

/**
 * Get IDs of games that are currently live
 */
export function getLiveGameIds(games: MatchPanelGame[]): string[] {
  return games.filter(game => game.isLive).map(game => game.id);
}

/**
 * Get upcoming games (scheduled but not started)
 */
export function getUpcomingGames(games: MatchPanelGame[]): MatchPanelGame[] {
  return games.filter(game => 
    game.status === 'scheduled' || 
    game.status === 'created' || 
    game.status === 'time-tbd'
  );
}

/**
 * Get completed games
 */
export function getCompletedGames(games: MatchPanelGame[]): MatchPanelGame[] {
  return games.filter(game => 
    game.status === 'complete' || 
    game.status === 'closed'
  );
}

/**
 * Get the next upcoming game by schedule time
 */
export function getNextUpcomingGame(games: MatchPanelGame[]): MatchPanelGame | null {
  const now = new Date();
  const upcoming = getUpcomingGames(games)
    .filter(game => game.scheduledTime > now)
    .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  
  return upcoming[0] || null;
}

// =============================================================================
// NEW ENDPOINTS: STANDINGS, SEASON SCHEDULE, TEAM STATS
// =============================================================================

/**
 * Get the NBA season year based on current date
 */
function getCurrentSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year : year - 1;
}

/**
 * Fetch NBA standings
 */
export async function getNBAStandings(seasonYear?: number, seasonType?: string): Promise<NBAStandings> {
  const year = seasonYear ?? getCurrentSeasonYear();
  const type = seasonType ?? 'REG';

  if (IS_DEV) {
    const path = `/nba/${ACCESS_LEVEL}/${API_VERSION}/en/seasons/${year}/${type}/standings.json`;
    return fetchFromApi<NBAStandings>(path);
  } else {
    return fetchFromApi<NBAStandings>('/standings', { year, seasonType: type });
  }
}

/**
 * Fetch NBA season schedule
 */
export async function getNBASeasonSchedule(
  seasonYear?: number, 
  seasonType?: string,
  teamId?: string
): Promise<NBASeasonSchedule> {
  const year = seasonYear ?? getCurrentSeasonYear();
  const type = seasonType ?? 'REG';

  if (IS_DEV) {
    const path = `/nba/${ACCESS_LEVEL}/${API_VERSION}/en/games/${year}/${type}/schedule.json`;
    const data = await fetchFromApi<NBASeasonSchedule>(path);
    
    // Filter by team if requested
    if (teamId && data.games) {
      return {
        ...data,
        games: data.games.filter(
          game => game.home.id === teamId || game.away.id === teamId
        ),
      };
    }
    return data;
  } else {
    const params: Record<string, string | number> = { year, seasonType: type };
    if (teamId) params.teamId = teamId;
    return fetchFromApi<NBASeasonSchedule>('/season-schedule', params);
  }
}

/**
 * Fetch team seasonal statistics
 */
export async function getNBATeamStats(
  teamId: string,
  seasonYear?: number,
  seasonType?: string
): Promise<NBATeamSeasonalStats> {
  const year = seasonYear ?? getCurrentSeasonYear();
  const type = seasonType ?? 'REG';

  if (IS_DEV) {
    const path = `/nba/${ACCESS_LEVEL}/${API_VERSION}/en/seasons/${year}/${type}/teams/${teamId}/statistics.json`;
    return fetchFromApi<NBATeamSeasonalStats>(path);
  } else {
    return fetchFromApi<NBATeamSeasonalStats>('/team-stats', { teamId, year, seasonType: type });
  }
}

/**
 * Extract team standing from full standings response
 */
export function getTeamStanding(standings: NBAStandings, teamId: string): NBATeamStanding | null {
  for (const conference of standings.conferences) {
    for (const division of conference.divisions) {
      const team = division.teams.find(t => t.id === teamId);
      if (team) {
        return {
          ...team,
          conference: conference.name,
          division: division.name,
        };
      }
    }
  }
  return null;
}

/**
 * Calculate match history for a team from season schedule
 */
export function calculateTeamMatchHistory(
  teamId: string,
  teamAlias: string,
  games: NBAGame[],
  opponentId?: string,
  limit: number = 10
): TeamMatchHistory {
  // Filter to completed games for this team
  const teamGames = games
    .filter(game => 
      isGameComplete(game.status) && 
      (game.home.id === teamId || game.away.id === teamId)
    )
    .sort((a, b) => new Date(b.scheduled).getTime() - new Date(a.scheduled).getTime());

  // Convert to match results
  const matchResults: MatchResult[] = teamGames.map(game => {
    const isHome = game.home.id === teamId;
    const teamScore = isHome ? (game.home.points ?? game.home_points ?? 0) : (game.away.points ?? game.away_points ?? 0);
    const opponentScore = isHome ? (game.away.points ?? game.away_points ?? 0) : (game.home.points ?? game.home_points ?? 0);
    const result: 'W' | 'L' = teamScore > opponentScore ? 'W' : 'L';
    
    return {
      gameId: game.id,
      date: game.scheduled,
      opponent: isHome ? game.away : game.home,
      isHome,
      teamScore,
      opponentScore,
      result,
      marginOfVictory: teamScore - opponentScore,
    };
  });

  // Get last N games
  const lastNGames = matchResults.slice(0, limit);

  // Calculate head-to-head if opponent specified
  const headToHead = opponentId 
    ? matchResults.filter(r => r.opponent.id === opponentId).slice(0, 10)
    : [];

  // Calculate streak
  let streakType: 'W' | 'L' = lastNGames[0]?.result ?? 'W';
  let streakCount = 0;
  for (const game of lastNGames) {
    if (game.result === streakType) {
      streakCount++;
    } else {
      break;
    }
  }

  // Calculate last 10 record
  const last10 = lastNGames.slice(0, 10);
  const last10Wins = last10.filter(g => g.result === 'W').length;
  const last10Record = { wins: last10Wins, losses: last10.length - last10Wins };

  // Calculate home/away records
  const homeGames = matchResults.filter(g => g.isHome);
  const awayGames = matchResults.filter(g => !g.isHome);
  const homeRecord = { 
    wins: homeGames.filter(g => g.result === 'W').length, 
    losses: homeGames.filter(g => g.result === 'L').length 
  };
  const awayRecord = { 
    wins: awayGames.filter(g => g.result === 'W').length, 
    losses: awayGames.filter(g => g.result === 'L').length 
  };

  // ATS and OU records need market data - initialize empty for now
  // These will be populated by betting indicators hook
  const atsRecord = { covers: 0, pushes: 0, total: 0 };
  const ouRecord = { overs: 0, pushes: 0, total: 0 };

  return {
    teamId,
    teamAlias,
    lastNGames,
    headToHead,
    streakType,
    streakCount,
    last10Record,
    homeRecord,
    awayRecord,
    atsRecord,
    ouRecord,
  };
}

/**
 * Categorize games into live, upcoming, and completed
 */
export interface CategorizedGames {
  live: MatchPanelGame[];
  upcoming: MatchPanelGame[];
  completed: MatchPanelGame[];
}

export function categorizeGames(games: MatchPanelGame[]): CategorizedGames {
  const live: MatchPanelGame[] = [];
  const upcoming: MatchPanelGame[] = [];
  const completed: MatchPanelGame[] = [];

  for (const game of games) {
    if (game.isLive) {
      live.push(game);
    } else if (game.status === 'scheduled' || game.status === 'created' || game.status === 'time-tbd') {
      upcoming.push(game);
    } else if (game.status === 'complete' || game.status === 'closed') {
      completed.push(game);
    }
  }

  // Sort upcoming by scheduled time (soonest first)
  upcoming.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  
  // Sort completed by scheduled time (most recent first)
  completed.sort((a, b) => b.scheduledTime.getTime() - a.scheduledTime.getTime());

  return { live, upcoming, completed };
}

/**
 * Get games sorted with priority: live first, then upcoming by time, then completed
 */
export function getGamesByPriority(games: MatchPanelGame[]): MatchPanelGame[] {
  const { live, upcoming, completed } = categorizeGames(games);
  return [...live, ...upcoming, ...completed];
}

/**
 * Format time until game starts
 */
export function formatTimeUntilGame(scheduledTime: Date): string {
  const now = new Date();
  const diff = scheduledTime.getTime() - now.getTime();
  
  if (diff <= 0) return 'Starting soon';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  }
  
  if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  }
  
  return `in ${minutes}m`;
}
