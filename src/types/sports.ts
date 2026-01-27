/**
 * NBA Sports Types - Sportradar API Data Structures
 * Based on Sportradar NBA API v8
 */

// Team Information
export interface NBATeam {
  id: string;
  name: string;
  market: string;
  alias: string;
  sr_id?: string;
  reference?: string;
}

export interface NBATeamRecord {
  wins: number;
  losses: number;
}

// Game Participant (Home/Away Team in a Game)
export interface NBAGameTeam {
  id: string;
  name: string;
  market: string;
  alias: string;
  sr_id?: string;
  reference?: string;
  points?: number;
  record?: NBATeamRecord;
  scoring?: NBAQuarterScore[];
}

export interface NBAQuarterScore {
  type: string;
  number: number;
  sequence: number;
  points: number;
}

// Venue Information
export interface NBAVenue {
  id: string;
  name: string;
  capacity?: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  sr_id?: string;
  location?: {
    lat: string;
    lng: string;
  };
}

// Broadcast Information
export interface NBABroadcast {
  network: string;
  type: string;
  locale?: string;
  channel?: string;
}

// Game Status Types
export type NBAGameStatus = 
  | 'scheduled'
  | 'created'
  | 'inprogress'
  | 'halftime'
  | 'complete'
  | 'closed'
  | 'cancelled'
  | 'delayed'
  | 'postponed'
  | 'time-tbd'
  | 'if-necessary'
  | 'unnecessary';

// Game Clock Information (for live games)
export interface NBAGameClock {
  quarter: number;
  clock: string;
  clock_decimal: string;
}

// Individual Game
export interface NBAGame {
  id: string;
  status: NBAGameStatus;
  coverage: string;
  scheduled: string;
  home_points?: number;
  away_points?: number;
  track_on_court?: boolean;
  sr_id?: string;
  reference?: string;
  time_zones?: {
    venue: string;
    home: string;
    away: string;
  };
  venue?: NBAVenue;
  broadcasts?: NBABroadcast[];
  home: NBAGameTeam;
  away: NBAGameTeam;
  clock?: string;
  quarter?: number;
}

// Daily Schedule Response
export interface NBADailySchedule {
  date: string;
  league: {
    id: string;
    name: string;
    alias: string;
  };
  games: NBAGame[];
}

// Player Injury Information
export interface NBAInjury {
  id: string;
  status: 'Out' | 'Doubtful' | 'Questionable' | 'Probable' | 'Day-To-Day';
  desc?: string;
  start_date?: string;
  update_date?: string;
  comment?: string;
}

export interface NBAInjuredPlayer {
  id: string;
  sr_id?: string;
  reference?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  abbr_name?: string;
  position?: string;
  primary_position?: string;
  jersey_number?: string;
  injuries: NBAInjury[];
}

export interface NBATeamInjuries {
  id: string;
  name: string;
  market: string;
  alias: string;
  sr_id?: string;
  reference?: string;
  players: NBAInjuredPlayer[];
}

// Daily Injuries Response
export interface NBADailyInjuries {
  date: string;
  league: {
    id: string;
    name: string;
    alias: string;
  };
  teams: NBATeamInjuries[];
}

// Game Boxscore / Summary Types
export interface NBAPlayerStats {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  primary_position?: string;
  jersey_number?: string;
  played: boolean;
  active: boolean;
  starter: boolean;
  on_court?: boolean;
  statistics?: NBAPlayerStatistics;
}

export interface NBAPlayerStatistics {
  minutes: string;
  field_goals_made: number;
  field_goals_att: number;
  field_goals_pct: number;
  three_points_made: number;
  three_points_att: number;
  three_points_pct: number;
  two_points_made: number;
  two_points_att: number;
  two_points_pct: number;
  free_throws_made: number;
  free_throws_att: number;
  free_throws_pct: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personal_fouls: number;
  tech_fouls: number;
  flagrant_fouls: number;
  points: number;
  plus_minus?: number;
  pls_min?: number;
}

export interface NBATeamStatistics {
  minutes: string;
  field_goals_made: number;
  field_goals_att: number;
  field_goals_pct: number;
  three_points_made: number;
  three_points_att: number;
  three_points_pct: number;
  two_points_made: number;
  two_points_att: number;
  two_points_pct: number;
  free_throws_made: number;
  free_throws_att: number;
  free_throws_pct: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personal_fouls: number;
  tech_fouls: number;
  team_turnovers: number;
  points: number;
  fast_break_pts?: number;
  second_chance_pts?: number;
  team_rebounds?: number;
  points_off_turnovers?: number;
  points_in_paint?: number;
  points_in_paint_made?: number;
  points_in_paint_att?: number;
  biggest_lead?: number;
  bench_points?: number;
  true_shooting_att?: number;
  true_shooting_pct?: number;
  efficiency?: number;
  efficiency_game_score?: number;
}

export interface NBABoxscoreTeam {
  id: string;
  name: string;
  market: string;
  alias: string;
  sr_id?: string;
  reference?: string;
  points: number;
  bonus?: boolean;
  scoring?: NBAQuarterScore[];
  statistics?: NBATeamStatistics;
  players?: NBAPlayerStats[];
}

export interface NBAGameSummary {
  id: string;
  status: NBAGameStatus;
  coverage: string;
  scheduled: string;
  attendance?: number;
  lead_changes?: number;
  times_tied?: number;
  clock?: string;
  clock_decimal?: string;
  quarter?: number;
  duration?: string;
  sr_id?: string;
  reference?: string;
  venue?: NBAVenue;
  home: NBABoxscoreTeam;
  away: NBABoxscoreTeam;
}

// Push Feed Event Types
export interface NBAPushEvent {
  type: 'game' | 'heartbeat';
  locale: string;
  payload: NBAPushGamePayload;
}

export interface NBAPushGamePayload {
  game: {
    id: string;
    status: NBAGameStatus;
    clock: string;
    clock_decimal: string;
    quarter: number;
    sr_id?: string;
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
  };
  event?: {
    id: string;
    event_type: string;
    clock: string;
    clock_decimal: string;
    description: string;
    home_points: number;
    away_points: number;
    attribution?: {
      id: string;
      name: string;
      market: string;
    };
    location?: {
      coord_x: number;
      coord_y: number;
    };
  };
}

// =============================================================================
// MATCH HISTORY TYPES
// =============================================================================

/**
 * Result of a single match for history tracking
 */
export interface MatchResult {
  gameId: string;
  date: string;
  opponent: NBATeam;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  result: 'W' | 'L';
  spreadResult?: 'COVER' | 'PUSH' | 'MISS';
  totalResult?: 'OVER' | 'PUSH' | 'UNDER';
  marginOfVictory: number;
}

/**
 * Team match history with streaks and patterns
 */
export interface TeamMatchHistory {
  teamId: string;
  teamAlias: string;
  lastNGames: MatchResult[];
  headToHead: MatchResult[];
  streakType: 'W' | 'L';
  streakCount: number;
  last10Record: { wins: number; losses: number };
  homeRecord: { wins: number; losses: number };
  awayRecord: { wins: number; losses: number };
  atsRecord: { covers: number; pushes: number; total: number };
  ouRecord: { overs: number; pushes: number; total: number };
}

/**
 * Team standing information from standings API
 * Uses snake_case to match SportRadar API response
 */
export interface NBATeamStanding {
  id: string;
  name: string;
  market: string;
  alias: string;
  sr_id?: string;
  wins: number;
  losses: number;
  win_pct: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  games_behind?: number;
  streak?: {
    kind: 'win' | 'loss';
    length: number;
  };
  records?: {
    home?: { wins: number; losses: number };
    road?: { wins: number; losses: number };
    last_ten?: { wins: number; losses: number };
    conference?: { wins: number; losses: number };
    division?: { wins: number; losses: number };
  };
  calc_rank?: {
    conf_rank?: number;
    div_rank?: number;
  };
  // Added after extraction from standings
  conference?: string;
  division?: string;
}

/**
 * Full standings response
 */
export interface NBAStandings {
  season: {
    id: string;
    year: number;
    type: string;
  };
  conferences: Array<{
    id: string;
    name: string;
    alias: string;
    divisions: Array<{
      id: string;
      name: string;
      alias: string;
      teams: NBATeamStanding[];
    }>;
  }>;
}

/**
 * Season schedule response
 */
export interface NBASeasonSchedule {
  season: {
    id: string;
    year: number;
    type: string;
  };
  games: NBAGame[];
}

/**
 * Player stats structure for team seasonal statistics
 * Different from boxscore player stats - uses average/total instead of statistics
 */
export interface NBASeasonPlayerStats {
  id: string;
  sr_id?: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position?: string;
  primary_position?: string;
  jersey_number?: string;
  // Season stats are in average/total, not statistics
  average?: NBAPlayerStatistics;
  total?: NBAPlayerStatistics;
}

/**
 * Team seasonal statistics
 */
export interface NBATeamSeasonalStats {
  id: string;
  name: string;
  market: string;
  alias: string;
  own_record: { wins: number; losses: number };
  opponents?: NBATeamStatistics;
  players?: NBASeasonPlayerStats[];
  statistics: {
    totals: NBATeamStatistics;
    average: NBATeamStatistics;
  };
}

// =============================================================================
// BETTING INDICATORS TYPES
// =============================================================================

/**
 * Line movement tracking
 */
export interface LineMovement {
  timestamp: Date;
  oldLine: number;
  newLine: number;
  direction: 'up' | 'down' | 'neutral';
  magnitude: number;
}

/**
 * Betting signal indicators
 */
export interface BettingSignal {
  type: 'steam_move' | 'reverse_line' | 'sharp_action' | 'public_money';
  team: string;
  description: string;
  timestamp: Date;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Comprehensive betting indicators for a game
 */
export interface GameBettingIndicators {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  
  // Rest and schedule
  homeRestDays: number;
  awayRestDays: number;
  homeIsBackToBack: boolean;
  awayIsBackToBack: boolean;
  
  // Streaks (from match history)
  homeStreak: { type: 'W' | 'L'; count: number };
  awayStreak: { type: 'W' | 'L'; count: number };
  
  // Records
  homeLast10: { wins: number; losses: number };
  awayLast10: { wins: number; losses: number };
  homeATS: { covers: number; pushes: number; total: number };
  awayATS: { covers: number; pushes: number; total: number };
  homeOU: { overs: number; pushes: number; total: number };
  awayOU: { overs: number; pushes: number; total: number };
  
  // Line movement
  lineMovements: LineMovement[];
  currentSpread?: number;
  openingSpread?: number;
  
  // Market efficiency
  overround: number;
  marketEfficiency: 'low' | 'medium' | 'high';
  
  // Signals
  signals: BettingSignal[];
  
  // Head to head
  h2hRecord: { homeWins: number; awayWins: number; total: number };
  h2hAverageTotal: number;
}

// Frontend-specific types for display
export interface MatchPanelGame {
  id: string;
  status: NBAGameStatus;
  isLive: boolean;
  scheduledTime: Date;
  home: {
    team: NBATeam;
    score: number;
    record?: NBATeamRecord;
  };
  away: {
    team: NBATeam;
    score: number;
    record?: NBATeamRecord;
  };
  clock?: {
    quarter: number;
    time: string;
  };
  venue?: NBAVenue;
  broadcasts?: NBABroadcast[];
}

// API Response wrapper for proxy
export interface SportradarAPIResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  cached?: boolean;
}

export interface SportradarAPIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
  timestamp: string;
}

// Helper function types
export function isGameLive(status: NBAGameStatus): boolean {
  return status === 'inprogress' || status === 'halftime';
}

export function isGameComplete(status: NBAGameStatus): boolean {
  return status === 'complete' || status === 'closed';
}

export function isGameScheduled(status: NBAGameStatus): boolean {
  return status === 'scheduled' || status === 'created' || status === 'time-tbd';
}

export function getGameStatusLabel(status: NBAGameStatus): string {
  const labels: Record<NBAGameStatus, string> = {
    'scheduled': 'Scheduled',
    'created': 'Scheduled',
    'inprogress': 'Live',
    'halftime': 'Halftime',
    'complete': 'Final',
    'closed': 'Final',
    'cancelled': 'Cancelled',
    'delayed': 'Delayed',
    'postponed': 'Postponed',
    'time-tbd': 'TBD',
    'if-necessary': 'If Necessary',
    'unnecessary': 'Unnecessary',
  };
  return labels[status] || status;
}

export function formatGameClock(quarter: number, clock: string): string {
  const quarterLabels: Record<number, string> = {
    1: 'Q1',
    2: 'Q2',
    3: 'Q3',
    4: 'Q4',
    5: 'OT1',
    6: 'OT2',
    7: 'OT3',
    8: 'OT4',
  };
  const quarterLabel = quarterLabels[quarter] || `OT${quarter - 4}`;
  return `${quarterLabel} ${clock}`;
}

// Transform Sportradar game to MatchPanelGame
export function transformToMatchPanelGame(game: NBAGame): MatchPanelGame {
  return {
    id: game.id,
    status: game.status,
    isLive: isGameLive(game.status),
    scheduledTime: new Date(game.scheduled),
    home: {
      team: {
        id: game.home.id,
        name: game.home.name,
        market: game.home.market,
        alias: game.home.alias,
        sr_id: game.home.sr_id,
        reference: game.home.reference,
      },
      score: game.home.points ?? game.home_points ?? 0,
      record: game.home.record,
    },
    away: {
      team: {
        id: game.away.id,
        name: game.away.name,
        market: game.away.market,
        alias: game.away.alias,
        sr_id: game.away.sr_id,
        reference: game.away.reference,
      },
      score: game.away.points ?? game.away_points ?? 0,
      record: game.away.record,
    },
    clock: game.quarter && game.clock ? {
      quarter: game.quarter,
      time: game.clock,
    } : undefined,
    venue: game.venue,
    broadcasts: game.broadcasts,
  };
}
