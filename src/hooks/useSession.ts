/**
 * Session Hooks
 * Manages chat sessions with hybrid storage (Supabase + IndexedDB)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSession, getSession, getMessages, deleteSession } from '@/services/api/sessions';
import { SessionNotFoundError } from '@/services/api/client';
import {
  saveSession as saveLocalSession,
  getSession as getStoredSession,
  getAllSessions as getLocalSessions,
  deleteSession as deleteStoredSession,
} from '@/services/storage/conversationStorage';
import {
  saveSessionToSupabase,
  getSessionFromSupabase,
  getAllSessionsFromSupabase,
  deleteSessionFromSupabase,
  isSupabaseConfigured,
  archiveSession,
} from '@/services/supabase';
import { useAuth } from './useAuth';
import { generateUUID } from '@/utils/uuid';
import { getUserId } from '@/utils/storage';
import type { CreateSessionRequest, Session, MessagesResponse } from '@/types';

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  agentId: string;
  channelId?: string;
  /** Matchup metadata for this session */
  matchup?: {
    title: string;
    gameId?: string;
    homeTeam?: { id: string; name: string; alias: string };
    awayTeam?: { id: string; name: string; alias: string };
    sport?: 'NBA' | 'NFL' | 'MLB' | 'NHL' | 'other';
    scheduledTime?: string;
  };
}

/**
 * Hook to create a new session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  const { isAuthenticated, supabaseUserId } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateSessionOptions): Promise<Session> => {
      const userId = getUserId();
      const channelId = data.channelId || generateUUID();

      const sessionData: CreateSessionRequest = {
        agentId: data.agentId,
        userId,
        channelId,
      };

      // Create session on backend
      const session = await createSession(sessionData);

      // Add matchup metadata if provided
      if (data.matchup) {
        session.metadata = {
          ...session.metadata,
          matchupTitle: data.matchup.title,
          gameId: data.matchup.gameId,
          homeTeam: data.matchup.homeTeam,
          awayTeam: data.matchup.awayTeam,
          sport: data.matchup.sport,
          scheduledTime: data.matchup.scheduledTime,
        };
      }

      // Save to local storage (always, for offline support)
      await saveLocalSession(session);

      // Save to Supabase if authenticated
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        await saveSessionToSupabase(session, supabaseUserId);
      }

      return session;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(['session', session.sessionId], session);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

/**
 * Hook to get a single session
 */
export function useSession(sessionId: string | null) {
  const { isAuthenticated, supabaseUserId } = useAuth();

  return useQuery<Session | null>({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;

      // First check Supabase if authenticated
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        const supabaseSession = await getSessionFromSupabase(sessionId);
        if (supabaseSession) {
          // Also save to local for offline access
          await saveLocalSession(supabaseSession);
          return supabaseSession;
        }
      }

      // Check local storage
      const stored = await getStoredSession(sessionId);
      if (stored) return stored;

      // Fetch from backend and save
      try {
        const session = await getSession(sessionId);
        await saveLocalSession(session);

        // Save to Supabase if authenticated
        if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
          await saveSessionToSupabase(session, supabaseUserId);
        }

        return session;
      } catch (error) {
        // If session not found on backend, return null (caller should handle)
        if (error instanceof SessionNotFoundError) {
          console.warn(`[useSession] Session ${sessionId.slice(0, 8)}... not found on backend`);
          return null;
        }
        throw error;
      }
    },
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get all sessions for the current user
 */
export function useSessions() {
  const { isAuthenticated, supabaseUserId } = useAuth();
  const legacyUserId = getUserId();

  return useQuery<Session[]>({
    queryKey: ['sessions', isAuthenticated ? supabaseUserId : legacyUserId],
    queryFn: async () => {
      console.log('[useSessions] Fetching sessions...', {
        isAuthenticated,
        supabaseUserId,
        legacyUserId,
        isSupabaseConfigured: isSupabaseConfigured(),
      });

      // If authenticated with Supabase, fetch from Supabase
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        const supabaseSessions = await getAllSessionsFromSupabase(supabaseUserId);
        console.log('[useSessions] Fetched from Supabase:', supabaseSessions.length, 'sessions');
        
        // Also update local cache (sync Supabase -> local)
        for (const session of supabaseSessions) {
          await saveLocalSession(session);
        }
        // Clean up local storage: remove any sessions that don't exist in Supabase
        const localSessions = await getLocalSessions(legacyUserId);
        const supabaseSessionIds = new Set(supabaseSessions.map((s) => s.sessionId));
        for (const localSession of localSessions) {
          if (!supabaseSessionIds.has(localSession.sessionId)) {
            await deleteStoredSession(localSession.sessionId);
          }
        }
        return supabaseSessions;
      }

      // Otherwise, use local storage
      const localSessions = await getLocalSessions(legacyUserId);
      console.log('[useSessions] Fetched from IndexedDB:', localSessions.length, 'sessions');
      return localSessions;
    },
    staleTime: 0, // Always refetch to ensure consistency after deletions
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get sessions for a specific agent
 */
export function useAgentSessions(agentId: string) {
  const { data: allSessions, ...rest } = useSessions();

  const agentSessions = allSessions?.filter((s) => s.agentId === agentId) || [];

  return {
    data: agentSessions,
    ...rest,
  };
}

/**
 * Hook to get messages for a session
 */
export function useSessionMessages(sessionId: string | null) {
  return useQuery<MessagesResponse>({
    queryKey: ['messages', sessionId],
    queryFn: () => {
      if (!sessionId) return { messages: [], hasMore: false };
      return getMessages(sessionId);
    },
    enabled: !!sessionId,
    refetchInterval: 30000,
  });
}

/**
 * Hook to delete a session (archives to Supabase before deleting)
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();
  const { isAuthenticated, supabaseUserId } = useAuth();
  const legacyUserId = getUserId();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      console.log('[useDeleteSession] Starting deletion for:', sessionId);
      console.log('[useDeleteSession] Auth state:', { isAuthenticated, supabaseUserId, legacyUserId });

      // Archive to Supabase first if authenticated (preserves conversation history)
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        try {
          const session = await getSessionFromSupabase(sessionId);
          if (session) {
            console.log('[useDeleteSession] Archiving session to Supabase');
            await archiveSession(session, supabaseUserId, 'user_deleted');
          }
        } catch (error) {
          console.warn('[useDeleteSession] Failed to archive session:', error);
        }
      }

      // Delete from backend API (non-blocking - continue even if fails)
      try {
        console.log('[useDeleteSession] Deleting from backend API');
        await deleteSession(sessionId);
        console.log('[useDeleteSession] Backend delete successful');
      } catch (error) {
        console.warn('[useDeleteSession] Backend delete failed (continuing):', error);
        // Continue with local deletion even if backend fails
      }

      // ALWAYS delete from local storage (IndexedDB) - this is critical
      console.log('[useDeleteSession] Deleting from IndexedDB');
      await deleteStoredSession(sessionId);
      console.log('[useDeleteSession] IndexedDB delete successful');

      // Delete from Supabase if authenticated
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        try {
          console.log('[useDeleteSession] Deleting from Supabase');
          await deleteSessionFromSupabase(sessionId);
        } catch (error) {
          console.warn('[useDeleteSession] Supabase delete failed:', error);
        }
      }

      console.log('[useDeleteSession] Deletion complete for:', sessionId);
    },
    onSuccess: (_, sessionId) => {
      console.log('[useDeleteSession] Session deleted:', sessionId);
      
      // Remove individual session and message queries
      queryClient.removeQueries({ queryKey: ['session', sessionId] });
      queryClient.removeQueries({ queryKey: ['messages', sessionId] });
      
      // Immediately update the sessions list by removing the deleted session from cache
      const queryKey = ['sessions', isAuthenticated ? supabaseUserId : legacyUserId];
      queryClient.setQueryData<Session[]>(queryKey, (oldSessions = []) => {
        const filtered = oldSessions.filter((s) => s.sessionId !== sessionId);
        console.log('[useDeleteSession] Updated sessions cache:', {
          before: oldSessions.length,
          after: filtered.length,
          queryKey,
        });
        return filtered;
      });
      
      // Then invalidate to refetch from server (ensures consistency)
      queryClient.invalidateQueries({ 
        queryKey: ['sessions'],
        refetchType: 'active' // Only refetch active queries
      });
    },
  });
}

/**
 * Hook to save a session (update existing)
 */
export function useSaveSession() {
  const queryClient = useQueryClient();
  const { isAuthenticated, supabaseUserId } = useAuth();

  return useMutation({
    mutationFn: async (session: Session) => {
      // Save to local storage
      await saveLocalSession(session);

      // Save to Supabase if authenticated
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        await saveSessionToSupabase(session, supabaseUserId);
      }

      return session;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(['session', session.sessionId], session);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

/**
 * Hook to get or create a session for a specific matchup
 * Ensures each matchup has its own dedicated chat session
 */
export function useMatchupSession(agentId: string) {
  const { data: sessions = [] } = useSessions();
  const createSession = useCreateSession();

  /**
   * Find an existing session for a matchup or create a new one
   */
  const getOrCreateMatchupSession = async (matchup: {
    gameId: string;
    title: string;
    homeTeam?: { id: string; name: string; alias: string };
    awayTeam?: { id: string; name: string; alias: string };
    sport?: 'NBA' | 'NFL' | 'MLB' | 'NHL' | 'other';
    scheduledTime?: string;
  }): Promise<Session> => {
    // Look for existing session with this gameId
    const existingSession = sessions.find((session) => {
      const metadata = session.metadata as { gameId?: string };
      return metadata?.gameId === matchup.gameId;
    });

    if (existingSession) {
      return existingSession;
    }

    // Create new session for this matchup
    return new Promise((resolve, reject) => {
      createSession.mutate(
        {
          agentId,
          matchup: {
            title: matchup.title,
            gameId: matchup.gameId,
            homeTeam: matchup.homeTeam,
            awayTeam: matchup.awayTeam,
            sport: matchup.sport,
            scheduledTime: matchup.scheduledTime,
          },
        },
        {
          onSuccess: resolve,
          onError: reject,
        }
      );
    });
  };

  /**
   * Find session for a game (returns null if not found)
   */
  const findSessionForGame = (gameId: string): Session | null => {
    return (
      sessions.find((session) => {
        const metadata = session.metadata as { gameId?: string };
        return metadata?.gameId === gameId;
      }) || null
    );
  };

  return {
    getOrCreateMatchupSession,
    findSessionForGame,
    isCreating: createSession.isPending,
  };
}
