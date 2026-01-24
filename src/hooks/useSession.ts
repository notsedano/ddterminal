import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSession, getSession, getMessages, deleteSession } from '@/services/api/sessions';
import { saveSession, getSession as getStoredSession, getAllSessions, deleteSession as deleteStoredSession } from '@/services/storage/conversationStorage';
import { generateUUID } from '@/utils/uuid';
import { getUserId } from '@/utils/storage';
import type { CreateSessionRequest, Session, MessagesResponse } from '@/types';

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { agentId: string; channelId?: string }): Promise<Session> => {
      const userId = getUserId();
      const channelId = data.channelId || generateUUID();
      
      const sessionData: CreateSessionRequest = {
        agentId: data.agentId,
        userId,
        channelId,
      };

      const session = await createSession(sessionData);
      await saveSession(session);
      return session;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(['session', session.sessionId], session);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useSession(sessionId: string | null) {
  return useQuery<Session | null>({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      
      const stored = await getStoredSession(sessionId);
      if (stored) return stored;
      
      const session = await getSession(sessionId);
      await saveSession(session);
      return session;
    },
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSessions() {
  const userId = getUserId();
  
  return useQuery<Session[]>({
    queryKey: ['sessions', userId],
    queryFn: () => getAllSessions(userId),
    staleTime: 1 * 60 * 1000,
  });
}

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

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      await deleteSession(sessionId);
      await deleteStoredSession(sessionId);
    },
    onSuccess: (_, sessionId) => {
      queryClient.removeQueries({ queryKey: ['session', sessionId] });
      queryClient.removeQueries({ queryKey: ['messages', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
