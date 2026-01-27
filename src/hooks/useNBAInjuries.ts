/**
 * Hook for fetching and managing NBA injury data
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { NBADailyInjuries, NBATeamInjuries, NBAInjuredPlayer, MatchPanelGame } from '@/types';
import { getNBAInjuries } from '@/services/api/sportradar';

// Query key for injuries
const INJURIES_QUERY_KEY = 'nba-injuries';

// Cache time - injuries update throughout the day
const INJURIES_STALE_TIME = 15 * 60 * 1000; // 15 minutes
const INJURIES_CACHE_TIME = 30 * 60 * 1000; // 30 minutes

interface UseNBAInjuriesOptions {
  /** Whether the hook is enabled (defaults to true) */
  enabled?: boolean;
}

interface UseNBAInjuriesResult {
  /** Full league-wide injuries response (all active injuries) */
  injuries: NBADailyInjuries | null;
  /** All teams with injuries */
  teamsWithInjuries: NBATeamInjuries[];
  /** Get injuries for a specific team by ID, alias, or name */
  getInjuriesForTeam: (teamIdentifier: string) => NBATeamInjuries | null;
  /** Get injuries for teams in a game */
  getInjuriesForGame: (game: MatchPanelGame) => {
    home: NBATeamInjuries | null;
    away: NBATeamInjuries | null;
  };
  /** Get all injured players for a team */
  getInjuredPlayers: (teamIdentifier: string) => NBAInjuredPlayer[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => void;
  lastUpdated: Date | null;
}

/**
 * Match a team identifier (id, alias, name, sr_id, reference) to injury data
 * Uses fuzzy matching to handle variations in team names
 */
function matchTeam(
  teamIdentifier: string,
  teamInjuries: NBATeamInjuries
): boolean {
  if (!teamIdentifier) return false;
  
  const identifier = teamIdentifier.toLowerCase().trim();
  
  // Direct exact matches
  if (
    teamInjuries.id?.toLowerCase() === identifier ||
    teamInjuries.alias?.toLowerCase() === identifier ||
    teamInjuries.name?.toLowerCase() === identifier ||
    teamInjuries.sr_id?.toLowerCase() === identifier ||
    teamInjuries.reference?.toLowerCase() === identifier ||
    teamInjuries.market?.toLowerCase() === identifier
  ) {
    return true;
  }
  
  // Fuzzy matching: check if identifier is contained in team name/market
  const fullTeamName = teamInjuries.market && teamInjuries.name
    ? `${teamInjuries.market} ${teamInjuries.name}`.toLowerCase()
    : teamInjuries.name?.toLowerCase() || '';
  
  if (fullTeamName && (
    fullTeamName.includes(identifier) ||
    identifier.includes(fullTeamName) ||
    identifier.includes(teamInjuries.name?.toLowerCase() || '') ||
    identifier.includes(teamInjuries.market?.toLowerCase() || '')
  )) {
    return true;
  }
  
  // Check if alias matches (case-insensitive partial match)
  if (teamInjuries.alias && (
    identifier === teamInjuries.alias.toLowerCase() ||
    identifier.includes(teamInjuries.alias.toLowerCase()) ||
    teamInjuries.alias.toLowerCase().includes(identifier)
  )) {
    return true;
  }
  
  return false;
}

export function useNBAInjuries(options: UseNBAInjuriesOptions = {}): UseNBAInjuriesResult {
  const { enabled = true } = options;

  const {
    data: injuries,
    isLoading,
    isFetching: isRefreshing,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery<NBADailyInjuries, Error>({
    // Use a single cache key since we now fetch league-wide injuries (all active injuries)
    queryKey: [INJURIES_QUERY_KEY, 'league'],
    queryFn: () => getNBAInjuries(),
    staleTime: INJURIES_STALE_TIME,
    gcTime: INJURIES_CACHE_TIME,
    refetchOnWindowFocus: true,
    enabled,
  });

  // Helper functions
  const getInjuriesForTeam = useMemo(() => {
    return (teamIdentifier: string): NBATeamInjuries | null => {
      if (!injuries?.teams) return null;
      
      const team = injuries.teams.find(team => matchTeam(teamIdentifier, team));
      return team || null;
    };
  }, [injuries]);

  const getInjuriesForGame = useMemo(() => {
    return (game: MatchPanelGame): { home: NBATeamInjuries | null; away: NBATeamInjuries | null } => {
      if (!injuries?.teams) {
        return { home: null, away: null };
      }

      // Try multiple identifiers for each team, including combined market+name
      const homeIdentifiers = [
        game.home.team.id,
        game.home.team.alias,
        game.home.team.name,
        game.home.team.sr_id,
        game.home.team.reference,
        game.home.team.market && game.home.team.name 
          ? `${game.home.team.market} ${game.home.team.name}`
          : null,
        game.home.team.market,
      ].filter(Boolean) as string[];

      const awayIdentifiers = [
        game.away.team.id,
        game.away.team.alias,
        game.away.team.name,
        game.away.team.sr_id,
        game.away.team.reference,
        game.away.team.market && game.away.team.name 
          ? `${game.away.team.market} ${game.away.team.name}`
          : null,
        game.away.team.market,
      ].filter(Boolean) as string[];

      // Try to find injuries using identifiers
      let homeInjuries: NBATeamInjuries | null = null;
      let awayInjuries: NBATeamInjuries | null = null;

      for (const id of homeIdentifiers) {
        const found = getInjuriesForTeam(id);
        if (found) {
          homeInjuries = found;
          break;
        }
      }

      // If not found, try direct search through all teams
      if (!homeInjuries && injuries.teams) {
        for (const team of injuries.teams) {
          if (matchTeam(game.home.team.id || '', team) ||
              matchTeam(game.home.team.alias || '', team) ||
              matchTeam(game.home.team.name || '', team) ||
              matchTeam(game.home.team.market || '', team)) {
            homeInjuries = team;
            break;
          }
        }
      }

      for (const id of awayIdentifiers) {
        const found = getInjuriesForTeam(id);
        if (found) {
          awayInjuries = found;
          break;
        }
      }

      // If not found, try direct search through all teams
      if (!awayInjuries && injuries.teams) {
        for (const team of injuries.teams) {
          if (matchTeam(game.away.team.id || '', team) ||
              matchTeam(game.away.team.alias || '', team) ||
              matchTeam(game.away.team.name || '', team) ||
              matchTeam(game.away.team.market || '', team)) {
            awayInjuries = team;
            break;
          }
        }
      }

      return { home: homeInjuries, away: awayInjuries };
    };
  }, [injuries, getInjuriesForTeam]);

  const getInjuredPlayers = useMemo(() => {
    return (teamIdentifier: string): NBAInjuredPlayer[] => {
      const teamInjuries = getInjuriesForTeam(teamIdentifier);
      return teamInjuries?.players || [];
    };
  }, [getInjuriesForTeam]);

  const teamsWithInjuries = useMemo(() => {
    if (!injuries?.teams) return [];
    return injuries.teams.filter(team => team.players && team.players.length > 0);
  }, [injuries]);

  return {
    injuries: injuries ?? null,
    teamsWithInjuries,
    getInjuriesForTeam,
    getInjuriesForGame,
    getInjuredPlayers,
    isLoading,
    isRefreshing,
    error,
    refetch,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}
