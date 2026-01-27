/**
 * Hook to automatically create and switch to matchup sessions
 * when the current match changes or on initial page load
 */

import { useEffect, useRef, useState } from 'react';
import { useMatchPanel } from './useMatchPanel';
import { useMatchupSessionContext } from '@/contexts/MatchupSessionContext';
import { useSessions } from './useSession';

interface UseAutoMatchupSessionOptions {
  /** Whether to auto-create sessions (default: true) */
  enabled?: boolean;
  /** Callback when a session is created/selected */
  onSessionReady?: (sessionId: string) => void;
}

/**
 * Automatically creates and switches to matchup sessions when:
 * 1. Page loads and there's a current match (only if no existing sessions)
 * 2. User switches between matchups (always creates if no session exists for that matchup)
 */
export function useAutoMatchupSession(options: UseAutoMatchupSessionOptions = {}) {
  const { enabled = true, onSessionReady } = options;
  const { currentMatch } = useMatchPanel({ autoRefresh: true });
  const matchupContext = useMatchupSessionContext();
  const { data: allSessions = [] } = useSessions();
  
  // Track the last game ID we processed to avoid duplicate creation
  const lastProcessedGameIdRef = useRef<string | null>(null);
  // Track if we've done initial load check
  const hasCheckedInitialLoadRef = useRef(false);
  // Track if we're currently creating a session
  const isCreatingRef = useRef(false);
  // Track if we've checked for existing sessions on initial load
  const [hasCheckedExistingSessions, setHasCheckedExistingSessions] = useState(false);

  // Check for existing sessions on initial load (only once)
  useEffect(() => {
    if (hasCheckedExistingSessions || allSessions.length === 0) {
      setHasCheckedExistingSessions(true);
    }
  }, [allSessions.length, hasCheckedExistingSessions]);

  useEffect(() => {
    if (!enabled || !currentMatch?.game || matchupContext.isCreating || isCreatingRef.current) {
      return;
    }

    const game = currentMatch.game;
    const gameId = game.id;

    // Skip if we already processed this game
    if (lastProcessedGameIdRef.current === gameId) {
      return;
    }

    // Check if there's already a session for this game
    const existingSession = matchupContext.getSessionForGame(gameId);

    if (existingSession) {
      // Session exists - switch to it if not already active
      if (matchupContext.activeMatchupSessionId !== existingSession.sessionId) {
        matchupContext.setActiveMatchupSession(existingSession.sessionId);
        onSessionReady?.(existingSession.sessionId);
      }
      lastProcessedGameIdRef.current = gameId;
      hasCheckedInitialLoadRef.current = true;
      return;
    }

    // On initial load, only create if there are no existing sessions at all
    if (!hasCheckedInitialLoadRef.current) {
      // Wait for session check to complete
      if (!hasCheckedExistingSessions) {
        return;
      }
      
      // If there are any existing sessions (not matchup-specific), don't auto-create on initial load
      // This allows users to continue their previous conversations
      if (allSessions.length > 0) {
        hasCheckedInitialLoadRef.current = true;
        lastProcessedGameIdRef.current = gameId;
        return;
      }
    }

    // No existing session - create one automatically
    // This happens when:
    // 1. Initial load with no existing sessions
    // 2. User switches to a different matchup
    isCreatingRef.current = true;
    matchupContext
      .startMatchupChat(game)
      .then((session) => {
        if (session) {
          lastProcessedGameIdRef.current = gameId;
          hasCheckedInitialLoadRef.current = true;
          onSessionReady?.(session.sessionId);
        }
      })
      .catch((error) => {
        console.error('Failed to auto-create matchup session:', error);
      })
      .finally(() => {
        isCreatingRef.current = false;
      });
  }, [
    enabled,
    currentMatch?.game?.id,
    matchupContext,
    onSessionReady,
    hasCheckedExistingSessions,
    allSessions.length,
  ]);
}
