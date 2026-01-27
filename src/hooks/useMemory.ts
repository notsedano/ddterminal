/**
 * Memory Hook
 * Provides access to user memory context for chat sessions
 * Supports hybrid storage (Supabase + IndexedDB) for offline support
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMemoryContext,
  getOrCreateUserContextProfile,
  updateUserContextProfile,
  incrementUserStats,
  createMemoryFragment,
  createMemoryFragments,
  upsertConversationSummary,
  updateConversationSummary,
  formatMemoryContextForPrompt,
  subscribeToMemoryUpdates,
  isSupabaseConfigured,
} from '@/services/supabase';
import {
  saveLocalMemoryFragment,
  saveLocalMemoryFragments,
  getLocalMemoryFragments,
  saveLocalConversationSummary,
  getLocalConversationSummary,
  getLocalRecentSummaries,
  saveLocalUserContextProfile,
  getLocalUserContextProfile,
} from '@/services/storage/memoryStorage';
import { useAuth } from './useAuth';
import type {
  MemoryContext,
  MemoryContextOptions,
  MemoryFragment,
  CreateMemoryFragment,
  ConversationSummary,
  CreateConversationSummary,
  UpdateConversationSummary,
  UpdateUserContextProfile,
  UserContextProfile,
  MemoryType,
} from '@/types/memory';
import type { Message } from '@/types';

export interface UseMemoryOptions {
  agentId: string;
  sessionId?: string | null;
  enabled?: boolean;
  maxRecentSummaries?: number;
  maxMemoryFragments?: number;
}

/**
 * Build memory context from local IndexedDB storage
 */
async function getLocalMemoryContext(
  userId: string,
  agentId: string,
  sessionId: string | null | undefined,
  maxRecentSummaries: number,
  maxMemoryFragments: number
): Promise<MemoryContext> {
  const [userProfile, recentSummaries, currentSummary, memories] = await Promise.all([
    getLocalUserContextProfile(userId, agentId),
    getLocalRecentSummaries(userId, agentId, maxRecentSummaries),
    sessionId ? getLocalConversationSummary(sessionId) : Promise.resolve(undefined),
    getLocalMemoryFragments(userId, agentId, { limit: maxMemoryFragments, minImportance: 0.3 }),
  ]);

  const recentTopics = new Set<string>();
  recentSummaries.forEach((s) => {
    s.keyTopics.forEach((t) => recentTopics.add(t));
  });

  return {
    userProfile: userProfile || null,
    recentSummaries,
    currentSessionSummary: currentSummary || null,
    relevantMemories: memories,
    userFacts: {
      displayName: userProfile?.displayName || null,
      favoriteTeams: userProfile?.favoriteTeams || [],
      favoriteSports: userProfile?.favoriteSports || [],
      riskTolerance: userProfile?.riskTolerance || 'moderate',
      recentTopics: Array.from(recentTopics).slice(0, 10),
    },
    lastUpdated: new Date().toISOString(),
    memoryCount: memories.length + recentSummaries.length,
  };
}

/**
 * Sync Supabase context to local storage for offline support
 */
async function syncContextToLocal(context: MemoryContext): Promise<void> {
  const syncPromises: Promise<void>[] = [];

  // Sync user profile
  if (context.userProfile) {
    syncPromises.push(saveLocalUserContextProfile(context.userProfile));
  }

  // Sync conversation summaries
  for (const summary of context.recentSummaries) {
    syncPromises.push(saveLocalConversationSummary(summary));
  }
  if (context.currentSessionSummary) {
    syncPromises.push(saveLocalConversationSummary(context.currentSessionSummary));
  }

  // Sync memory fragments
  if (context.relevantMemories.length > 0) {
    syncPromises.push(saveLocalMemoryFragments(context.relevantMemories));
  }

  await Promise.all(syncPromises);
}

export interface UseMemoryReturn {
  // Memory context
  context: MemoryContext | null;
  contextPrompt: string;
  isLoading: boolean;
  error: Error | null;

  // User profile
  userProfile: UserContextProfile | null;

  // Actions
  refreshContext: () => void;
  addMemory: (memory: Omit<CreateMemoryFragment, 'userId' | 'agentId'>) => Promise<MemoryFragment | null>;
  addMemories: (memories: Omit<CreateMemoryFragment, 'userId' | 'agentId'>[]) => Promise<MemoryFragment[]>;
  updateProfile: (updates: UpdateUserContextProfile) => Promise<void>;
  trackInteraction: (messageCount?: number, isNewSession?: boolean) => Promise<void>;
  saveSummary: (summary: Omit<CreateConversationSummary, 'userId' | 'agentId'>) => Promise<ConversationSummary | null>;
  updateSummary: (updates: UpdateConversationSummary) => Promise<void>;
}

/**
 * Hook to access and manage user memory context
 */
export function useMemory({
  agentId,
  sessionId,
  enabled = true,
  maxRecentSummaries = 5,
  maxMemoryFragments = 20,
}: UseMemoryOptions): UseMemoryReturn {
  const { isAuthenticated, supabaseUserId, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const isEnabled = enabled && isAuthenticated && !!supabaseUserId && isSupabaseConfigured();

  // Query for memory context with hybrid storage
  const {
    data: context,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['memoryContext', supabaseUserId, agentId, sessionId],
    queryFn: async (): Promise<MemoryContext | null> => {
      if (!supabaseUserId) return null;

      const options: MemoryContextOptions = {
        agentId,
        sessionId: sessionId || undefined,
        maxRecentSummaries,
        maxMemoryFragments,
        minConfidence: 0.5,
      };

      // Try Supabase first if configured
      if (isSupabaseConfigured()) {
        const supabaseContext = await getMemoryContext(supabaseUserId, options).catch(() => null);
        if (supabaseContext && supabaseContext.memoryCount > 0) {
          // Sync to local storage for offline support (non-blocking)
          syncContextToLocal(supabaseContext).catch(() => {});
          return supabaseContext;
        }
      }

      // Fallback to local storage
      return getLocalMemoryContext(supabaseUserId, agentId, sessionId, maxRecentSummaries, maxMemoryFragments);
    },
    enabled: isEnabled && !isAuthLoading,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  // Generate context prompt string
  const contextPrompt = context ? formatMemoryContextForPrompt(context) : '';

  // Mutation for adding a single memory (saves to both Supabase and local)
  const addMemoryMutation = useMutation({
    mutationFn: async (memory: Omit<CreateMemoryFragment, 'userId' | 'agentId'>): Promise<MemoryFragment | null> => {
      if (!supabaseUserId) return null;

      const fullMemory: CreateMemoryFragment = {
        ...memory,
        userId: supabaseUserId,
        agentId,
      };

      // Try Supabase first
      if (isSupabaseConfigured()) {
        const result = await createMemoryFragment(fullMemory);
        if (result) {
          // Sync to local (non-blocking)
          saveLocalMemoryFragment(result).catch(() => {});
          return result;
        }
      }

      // Fallback: create locally with generated ID
      const localFragment: MemoryFragment = {
        id: crypto.randomUUID(),
        userId: supabaseUserId,
        sessionId: memory.sessionId || null,
        agentId,
        memoryType: memory.memoryType,
        content: memory.content,
        confidence: memory.confidence ?? 1.0,
        sourceMessageId: memory.sourceMessageId || null,
        extractedAt: new Date().toISOString(),
        importance: memory.importance ?? 0.5,
        accessCount: 0,
        lastAccessedAt: null,
        expiresAt: memory.expiresAt || null,
        createdAt: new Date().toISOString(),
        metadata: memory.metadata,
      };

      await saveLocalMemoryFragment(localFragment);
      return localFragment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryContext', supabaseUserId, agentId] });
    },
  });

  // Mutation for adding multiple memories (saves to both Supabase and local)
  const addMemoriesMutation = useMutation({
    mutationFn: async (memories: Omit<CreateMemoryFragment, 'userId' | 'agentId'>[]): Promise<MemoryFragment[]> => {
      if (!supabaseUserId || memories.length === 0) return [];

      const fullMemories: CreateMemoryFragment[] = memories.map((m) => ({
        ...m,
        userId: supabaseUserId,
        agentId,
      }));

      // Try Supabase first
      if (isSupabaseConfigured()) {
        const results = await createMemoryFragments(fullMemories);
        if (results.length > 0) {
          // Sync to local (non-blocking)
          saveLocalMemoryFragments(results).catch(() => {});
          return results;
        }
      }

      // Fallback: create locally with generated IDs
      const localFragments: MemoryFragment[] = memories.map((m) => ({
        id: crypto.randomUUID(),
        userId: supabaseUserId,
        sessionId: m.sessionId || null,
        agentId,
        memoryType: m.memoryType,
        content: m.content,
        confidence: m.confidence ?? 1.0,
        sourceMessageId: m.sourceMessageId || null,
        extractedAt: new Date().toISOString(),
        importance: m.importance ?? 0.5,
        accessCount: 0,
        lastAccessedAt: null,
        expiresAt: m.expiresAt || null,
        createdAt: new Date().toISOString(),
        metadata: m.metadata,
      }));

      await saveLocalMemoryFragments(localFragments);
      return localFragments;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryContext', supabaseUserId, agentId] });
    },
  });

  // Mutation for updating user profile (saves to both Supabase and local)
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: UpdateUserContextProfile) => {
      if (!supabaseUserId) return;

      // Update Supabase if configured
      if (isSupabaseConfigured()) {
        await updateUserContextProfile(supabaseUserId, agentId, updates);
      }

      // Also update local storage
      const localProfile = await getLocalUserContextProfile(supabaseUserId, agentId);
      if (localProfile) {
        const updatedProfile: UserContextProfile = {
          ...localProfile,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        await saveLocalUserContextProfile(updatedProfile);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryContext', supabaseUserId, agentId] });
    },
  });

  // Track interaction (increment stats)
  const trackInteraction = useCallback(
    async (messageCount: number = 1, isNewSession: boolean = false) => {
      if (!supabaseUserId) return;
      await incrementUserStats(supabaseUserId, agentId, messageCount, isNewSession);
    },
    [supabaseUserId, agentId]
  );

  // Mutation for saving conversation summary (saves to both Supabase and local)
  const saveSummaryMutation = useMutation({
    mutationFn: async (summary: Omit<CreateConversationSummary, 'userId' | 'agentId'>): Promise<ConversationSummary | null> => {
      if (!supabaseUserId) return null;

      const fullSummary: CreateConversationSummary = {
        ...summary,
        userId: supabaseUserId,
        agentId,
      };

      // Try Supabase first
      if (isSupabaseConfigured()) {
        const result = await upsertConversationSummary(fullSummary);
        if (result) {
          // Sync to local (non-blocking)
          saveLocalConversationSummary(result).catch(() => {});
          return result;
        }
      }

      // Fallback: create locally with generated ID
      const localSummary: ConversationSummary = {
        id: crypto.randomUUID(),
        sessionId: summary.sessionId,
        userId: supabaseUserId,
        agentId,
        summary: summary.summary,
        keyTopics: summary.keyTopics || [],
        keyEntities: summary.keyEntities || {},
        sentimentScore: summary.sentimentScore ?? 0,
        messageCount: summary.messageCount ?? 0,
        firstMessageAt: summary.firstMessageAt || null,
        lastMessageAt: summary.lastMessageAt || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: summary.metadata,
      };

      await saveLocalConversationSummary(localSummary);
      return localSummary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryContext', supabaseUserId, agentId] });
    },
  });

  // Mutation for updating conversation summary (saves to both Supabase and local)
  const updateSummaryMutation = useMutation({
    mutationFn: async (updates: UpdateConversationSummary) => {
      if (!sessionId) return;

      // Update Supabase if configured
      if (isSupabaseConfigured()) {
        await updateConversationSummary(sessionId, updates);
      }

      // Also update local storage
      const localSummary = await getLocalConversationSummary(sessionId);
      if (localSummary) {
        const updatedSummary: ConversationSummary = {
          ...localSummary,
          ...updates,
          keyTopics: updates.keyTopics ?? localSummary.keyTopics,
          keyEntities: updates.keyEntities ?? localSummary.keyEntities,
          updatedAt: new Date().toISOString(),
        };
        await saveLocalConversationSummary(updatedSummary);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryContext', supabaseUserId, agentId] });
    },
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!isEnabled || !supabaseUserId) return;

    // Subscribe to memory updates
    unsubscribeRef.current = subscribeToMemoryUpdates(
      supabaseUserId,
      agentId,
      () => {
        // Invalidate queries when memory updates
        queryClient.invalidateQueries({ queryKey: ['memoryContext', supabaseUserId, agentId] });
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isEnabled, supabaseUserId, agentId, queryClient]);

  // Initialize user profile when authenticated
  useEffect(() => {
    if (isEnabled && supabaseUserId) {
      // Ensure profile exists
      getOrCreateUserContextProfile(supabaseUserId, agentId);
    }
  }, [isEnabled, supabaseUserId, agentId]);

  return {
    context: context || null,
    contextPrompt,
    isLoading: isLoading || isAuthLoading,
    error: error as Error | null,
    userProfile: context?.userProfile || null,

    refreshContext: refetch,
    addMemory: addMemoryMutation.mutateAsync,
    addMemories: addMemoriesMutation.mutateAsync,
    updateProfile: updateProfileMutation.mutateAsync,
    trackInteraction,
    saveSummary: saveSummaryMutation.mutateAsync,
    updateSummary: updateSummaryMutation.mutateAsync,
  };
}

/**
 * Hook to extract and save memories from a message
 * Uses pattern matching for entity extraction and preference detection
 */
export function useMemoryExtraction(agentId: string, sessionId?: string | null) {
  const { addMemory, addMemories, saveSummary } = useMemory({ agentId, sessionId });

  /**
   * Extract and save entities from a message
   */
  const extractEntities = useCallback(
    async (text: string, messageId?: string) => {
      const memories: Omit<CreateMemoryFragment, 'userId' | 'agentId'>[] = [];

      // NBA Teams pattern
      const nbaTeamPattern = /\b(Lakers?|Celtics?|Warriors?|Heat|Bulls?|Nets?|Knicks?|76ers?|Sixers?|Bucks?|Suns?|Mavericks?|Mavs?|Nuggets?|Clippers?|Kings?|Hawks?|Raptors?|Cavaliers?|Cavs?|Magic|Pacers?|Hornets?|Wizards?|Pistons?|Thunder|Trail\s*Blazers?|Blazers?|Spurs?|Rockets?|Grizzlies?|Timberwolves?|Wolves?|Pelicans?|Jazz)\b/gi;
      
      // NFL Teams pattern
      const nflTeamPattern = /\b(Chiefs?|Eagles?|49ers?|Cowboys?|Bills?|Bengals?|Ravens?|Dolphins?|Lions?|Packers?|Vikings?|Jets?|Patriots?|Chargers?|Raiders?|Broncos?|Steelers?|Browns?|Colts?|Titans?|Jaguars?|Texans?|Seahawks?|Rams?|Cardinals?|Saints?|Buccaneers?|Bucs?|Panthers?|Falcons?|Bears?|Commanders?|Giants?)\b/gi;

      // Extract NBA teams
      const nbaMatches = text.match(nbaTeamPattern);
      if (nbaMatches) {
        const uniqueTeams = [...new Set(nbaMatches.map(t => t.toLowerCase()))];
        uniqueTeams.forEach((team) => {
          memories.push({
            sessionId,
            memoryType: 'entity',
            content: `Mentioned NBA team: ${team}`,
            confidence: 0.95,
            sourceMessageId: messageId,
            importance: 0.6,
          });
        });
      }

      // Extract NFL teams
      const nflMatches = text.match(nflTeamPattern);
      if (nflMatches) {
        const uniqueTeams = [...new Set(nflMatches.map(t => t.toLowerCase()))];
        uniqueTeams.forEach((team) => {
          memories.push({
            sessionId,
            memoryType: 'entity',
            content: `Mentioned NFL team: ${team}`,
            confidence: 0.95,
            sourceMessageId: messageId,
            importance: 0.6,
          });
        });
      }

      // Extract explicit preferences
      const preferencePatterns = [
        { pattern: /I\s+(like|love|prefer|enjoy)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/gi, type: 'preference' as MemoryType, importance: 0.7 },
        { pattern: /(?:my\s+)?favorite\s+(?:team\s+is|is)\s+(?:the\s+)?(\w+)/gi, type: 'preference' as MemoryType, importance: 0.8 },
        { pattern: /I\s+(?:always|usually|often)\s+bet\s+(?:on\s+)?(\w+(?:\s+\w+)?)/gi, type: 'preference' as MemoryType, importance: 0.75 },
      ];

      for (const { pattern, type, importance } of preferencePatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          memories.push({
            sessionId,
            memoryType: type,
            content: match[0].trim(),
            confidence: 0.8,
            sourceMessageId: messageId,
            importance,
          });
        }
      }

      // Extract intents
      const intentPatterns = [
        { pattern: /I('m| am)\s+(bullish|bearish)\s+on\s+(\w+(?:\s+\w+)?)/gi, importance: 0.65 },
        { pattern: /I\s+(?:want|need)\s+to\s+(?:bet|place|make)\s+(?:a\s+)?(\w+(?:\s+\w+){0,3})/gi, importance: 0.6 },
        { pattern: /looking\s+(?:for|at)\s+(\w+(?:\s+\w+){0,3})\s+(?:bets?|picks?|predictions?)/gi, importance: 0.55 },
      ];

      for (const { pattern, importance } of intentPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          memories.push({
            sessionId,
            memoryType: 'intent',
            content: match[0].trim(),
            confidence: 0.75,
            sourceMessageId: messageId,
            importance,
            // Intents expire after 24 hours
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      if (memories.length > 0) {
        await addMemories(memories);
      }

      return memories;
    },
    [addMemories, sessionId]
  );

  /**
   * Save a specific fact about the user
   */
  const saveFact = useCallback(
    async (fact: string, importance: number = 0.7, messageId?: string) => {
      return addMemory({
        sessionId,
        memoryType: 'fact',
        content: fact,
        confidence: 1.0,
        sourceMessageId: messageId,
        importance,
      });
    },
    [addMemory, sessionId]
  );

  /**
   * Save user intent
   */
  const saveIntent = useCallback(
    async (intent: string, confidence: number = 0.8, messageId?: string) => {
      return addMemory({
        sessionId,
        memoryType: 'intent',
        content: intent,
        confidence,
        sourceMessageId: messageId,
        importance: 0.6,
        // Intent expires after 24 hours
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    },
    [addMemory, sessionId]
  );

  /**
   * Generate and save a conversation summary from messages
   */
  const summarizeConversation = useCallback(
    async (messages: Message[]) => {
      if (!sessionId || messages.length === 0) return null;

      // Dynamic import to avoid circular dependencies
      const { createSummaryFromMessages, extractUserPreferences } = await import('@/utils/conversationSummary');
      
      // Create summary
      const summaryData = createSummaryFromMessages(messages, sessionId, '', '');
      const result = await saveSummary(summaryData);

      // Extract and save user preferences as memory fragments
      const preferences = extractUserPreferences(messages);
      if (preferences.length > 0) {
        const prefMemories: Omit<CreateMemoryFragment, 'userId' | 'agentId'>[] = preferences.map((p) => ({
          sessionId,
          memoryType: p.memoryType,
          content: p.content,
          confidence: 0.7,
          importance: 0.65,
        }));
        await addMemories(prefMemories);
      }

      return result;
    },
    [sessionId, saveSummary, addMemories]
  );

  return {
    extractEntities,
    saveFact,
    saveIntent,
    summarizeConversation,
  };
}
