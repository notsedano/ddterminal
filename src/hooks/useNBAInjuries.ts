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
  date?: Date;
  enabled?: boolean;
}

interface UseNBAInjuriesResult {
  /** Full daily injuries response */
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
 */
function matchTeam(
  teamIdentifier: string,
  teamInjuries: NBATeamInjuries
): boolean {
  const identifier = teamIdentifier.toLowerCase();
  
  return (
    teamInjuries.id?.toLowerCase() === identifier ||
    teamInjuries.alias?.toLowerCase() === identifier ||
    teamInjuries.name?.toLowerCase() === identifier ||
    teamInjuries.sr_id?.toLowerCase() === identifier ||
    teamInjuries.reference?.toLowerCase() === identifier ||
    teamInjuries.market?.toLowerCase() === identifier
  );
}

export function useNBAInjuries(options: UseNBAInjuriesOptions = {}): UseNBAInjuriesResult {
  const { date, enabled = true } = options;

  const {
    data: injuries,
    isLoading,
    isFetching: isRefreshing,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery<NBADailyInjuries, Error>({
    queryKey: [INJURIES_QUERY_KEY, date?.toISOString() ?? 'today'],
    queryFn: () => getNBAInjuries(date),
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

      // Try multiple identifiers for each team
      const homeIdentifiers = [
        game.home.team.id,
        game.home.team.alias,
        game.home.team.name,
        game.home.team.sr_id,
        game.home.team.reference,
      ].filter(Boolean) as string[];

      const awayIdentifiers = [
        game.away.team.id,
        game.away.team.alias,
        game.away.team.name,
        game.away.team.sr_id,
        game.away.team.reference,
      ].filter(Boolean) as string[];

      const homeInjuries = homeIdentifiers
        .map(id => getInjuriesForTeam(id))
        .find(team => team !== null) || null;

      const awayInjuries = awayIdentifiers
        .map(id => getInjuriesForTeam(id))
        .find(team => team !== null) || null;

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
