/**
 * Hook to automatically create and switch to matchup sessions
 * when the current match changes or on initial page load
 */

import { useEffect, useRef, useState } from 'react';
import { useMatchPanel } from './useMatchPanel';
import { useMatchupSessionContext } from '@/contexts/MatchupSessionContext';
import { useSessions } from './useSession';
import { useAuth } from './useAuth';

interface UseAutoMatchupSessionOptions {
  /** Whether to auto-create sessions (default: true) */
  enabled?: boolean;
  /** Callback when a session is created/selected */
  onSessionReady?: (sessionId: string) => void;
  /** Force recreation of session (e.g., when current session is invalidated) */
  forceRecreate?: boolean;
}

/**
 * Automatically creates and switches to matchup sessions when:
 * 1. Page loads and there's a current match (only if no existing sessions)
 * 2. User switches between matchups (always creates if no session exists for that matchup)
 */
export function useAutoMatchupSession(options: UseAutoMatchupSessionOptions = {}) {
  const { enabled = true, onSessionReady, forceRecreate = false } = options;
  const { currentMatch } = useMatchPanel({ autoRefresh: true });
  const matchupContext = useMatchupSessionContext();
  const { data: allSessions = [] } = useSessions();
  
  // Get auth state - we need to wait for auth to be fully ready before creating sessions
  // to ensure sessions are properly saved to Supabase
  const { isAuthenticated, supabaseUserId, isLoading: isAuthLoading } = useAuth();
  
  // Track the last game ID we processed to avoid duplicate creation
  const lastProcessedGameIdRef = useRef<string | null>(null);
  // Track if we've done initial load check
  const hasCheckedInitialLoadRef = useRef(false);
  // Track if we're currently creating a session
  const isCreatingRef = useRef(false);
  // Track if we've checked for existing sessions on initial load
  const [hasCheckedExistingSessions, setHasCheckedExistingSessions] = useState(false);
  // Track forceRecreate state
  const prevForceRecreateRef = useRef(forceRecreate);

  // Reset tracking when forceRecreate becomes true
  useEffect(() => {
    if (forceRecreate && !prevForceRecreateRef.current) {
      console.log('[useAutoMatchupSession] Force recreate triggered, resetting tracking');
      lastProcessedGameIdRef.current = null;
      hasCheckedInitialLoadRef.current = false;
    }
    prevForceRecreateRef.current = forceRecreate;
  }, [forceRecreate]);

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

    // IMPORTANT: Wait for auth to be fully ready before creating sessions
    // This ensures that if the user is authenticated, the supabaseUserId is populated
    // so sessions are properly saved to Supabase (avoiding foreign key errors on messages)
    if (isAuthLoading) {
      return;
    }
    
    // If user is authenticated but supabaseUserId isn't ready yet, wait
    // (supabaseUserId is fetched async after Privy auth completes)
    if (isAuthenticated && !supabaseUserId) {
      return;
    }

    const game = currentMatch.game;
    const gameId = game.id;

    // Check if there's already a session for this game
    const existingSession = matchupContext.getSessionForGame(gameId);
    
    // Skip if we already processed this game AND the session still exists
    // This allows recreation if the session was invalidated/deleted
    if (lastProcessedGameIdRef.current === gameId && existingSession) {
      return;
    }

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
        // Check if it's a storage error - these are non-critical storage errors
        const isStorageError = error instanceof Error && (
          error.name === 'QuotaExceededError' ||
          error.name === 'UnknownError' ||
          error.message.includes('QuotaExceeded') ||
          error.message.includes('full disk') ||
          error.message.includes('storage quota') ||
          error.message.includes('Internal error') ||
          error.message.includes('FILE_ERROR_NO_SPACE') ||
          error.message.includes('no space')
        );
        
        if (isStorageError) {
          // Log once but don't spam console - this is a known issue with full storage
          console.warn('Failed to auto-create matchup session due to storage error. Clear browser data to fix.');
        } else {
          console.error('Failed to auto-create matchup session:', error);
        }
        
        // Mark as processed to prevent infinite retry loop
        lastProcessedGameIdRef.current = gameId;
        hasCheckedInitialLoadRef.current = true;
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
    isAuthLoading,
    isAuthenticated,
    supabaseUserId,
  ]);
}
