/**
 * Matchup Session Context
 * Provides ability to start chat sessions for specific matchups from anywhere in the app
 */

import { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { useMatchupSession } from '@/hooks/useSession';
import type { Session } from '@/types/session';
import type { MatchPanelGame } from '@/types/sports';

interface MatchupSessionContextValue {
  /** Start or get a chat session for a specific game/matchup */
  startMatchupChat: (game: MatchPanelGame) => Promise<Session | null>;
  /** Currently active matchup session ID */
  activeMatchupSessionId: string | null;
  /** Set the active matchup session */
  setActiveMatchupSession: (sessionId: string | null) => void;
  /** Check if a game has an existing session */
  hasSessionForGame: (gameId: string) => boolean;
  /** Get session for a game */
  getSessionForGame: (gameId: string) => Session | null;
  /** Is creating a session */
  isCreating: boolean;
}

const MatchupSessionContext = createContext<MatchupSessionContextValue | null>(null);

interface MatchupSessionProviderProps {
  children: ReactNode;
  agentId: string;
  onSessionStarted?: (session: Session) => void;
}

/**
 * Generate matchup title from a game
 */
function getMatchupTitle(game: MatchPanelGame): string {
  const home = game.home?.team?.name || game.home?.team?.alias || 'Home';
  const away = game.away?.team?.name || game.away?.team?.alias || 'Away';
  return `${away} @ ${home}`;
}

export function MatchupSessionProvider({ 
  children, 
  agentId,
  onSessionStarted,
}: MatchupSessionProviderProps) {
  const { getOrCreateMatchupSession, findSessionForGame, isCreating } = useMatchupSession(agentId);
  const [activeMatchupSessionId, setActiveMatchupSession] = useState<string | null>(null);

  const startMatchupChat = useCallback(async (game: MatchPanelGame): Promise<Session | null> => {
    const session = await getOrCreateMatchupSession({
      gameId: game.id,
      title: getMatchupTitle(game),
      homeTeam: game.home?.team ? {
        id: game.home.team.id,
        name: game.home.team.name,
        alias: game.home.team.alias,
      } : undefined,
      awayTeam: game.away?.team ? {
        id: game.away.team.id,
        name: game.away.team.name,
        alias: game.away.team.alias,
      } : undefined,
      sport: 'NBA',
      scheduledTime: game.scheduledTime?.toISOString(),
    });

    if (session) {
      setActiveMatchupSession(session.sessionId);
      onSessionStarted?.(session);
    }

    return session;
  }, [getOrCreateMatchupSession, onSessionStarted]);

  const hasSessionForGame = useCallback((gameId: string): boolean => {
    return findSessionForGame(gameId) !== null;
  }, [findSessionForGame]);

  const getSessionForGame = useCallback((gameId: string): Session | null => {
    return findSessionForGame(gameId);
  }, [findSessionForGame]);

  return (
    <MatchupSessionContext.Provider
      value={{
        startMatchupChat,
        activeMatchupSessionId,
        setActiveMatchupSession,
        hasSessionForGame,
        getSessionForGame,
        isCreating,
      }}
    >
      {children}
    </MatchupSessionContext.Provider>
  );
}

export function useMatchupSessionContext() {
  const context = useContext(MatchupSessionContext);
  if (!context) {
    throw new Error('useMatchupSessionContext must be used within a MatchupSessionProvider');
  }
  return context;
}

/**
 * Hook to check if matchup session context is available
 */
export function useOptionalMatchupSession() {
  return useContext(MatchupSessionContext);
}
