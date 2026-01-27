/**
 * Memory Storage Service
 * Handles all memory-related database operations for short-term memory and context profiling
 */

import { supabase, isSupabaseConfigured } from './client';
import type {
  ConversationSummaryRow,
  ConversationSummaryInsert,
  ConversationSummaryUpdate,
  UserContextProfileRow,
  UserContextProfileInsert,
  UserContextProfileUpdate,
  MemoryFragmentRow,
  MemoryFragmentInsert,
} from '@/types/database';
import type {
  MemoryFragment,
  CreateMemoryFragment,
  ConversationSummary,
  CreateConversationSummary,
  UpdateConversationSummary,
  UserContextProfile,
  UpdateUserContextProfile,
  MemoryContext,
  MemoryContextOptions,
  MemoryType,
} from '@/types/memory';

// Import conversion functions
import {
  memoryFragmentFromRow as toMemoryFragment,
  conversationSummaryFromRow as toConversationSummary,
  userContextProfileFromRow as toUserContextProfile,
} from '@/types/memory';

// ============================================================================
// Memory Fragment Operations
// ============================================================================

/**
 * Create a new memory fragment
 */
export async function createMemoryFragment(
  memory: CreateMemoryFragment
): Promise<MemoryFragment | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const insert: MemoryFragmentInsert = {
    user_id: memory.userId,
    session_id: memory.sessionId,
    agent_id: memory.agentId,
    memory_type: memory.memoryType,
    content: memory.content,
    confidence: memory.confidence ?? 1.0,
    source_message_id: memory.sourceMessageId,
    importance: memory.importance ?? 0.5,
    expires_at: memory.expiresAt,
    metadata: memory.metadata as MemoryFragmentInsert['metadata'],
  };

  const { data, error } = await supabase
    .from('memory_fragments')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[Memory] Failed to create memory fragment:', error);
    return null;
  }

  return toMemoryFragment(data);
}

/**
 * Create multiple memory fragments at once
 */
export async function createMemoryFragments(
  memories: CreateMemoryFragment[]
): Promise<MemoryFragment[]> {
  if (!isSupabaseConfigured() || memories.length === 0) {
    return [];
  }

  const inserts: MemoryFragmentInsert[] = memories.map((memory) => ({
    user_id: memory.userId,
    session_id: memory.sessionId,
    agent_id: memory.agentId,
    memory_type: memory.memoryType,
    content: memory.content,
    confidence: memory.confidence ?? 1.0,
    source_message_id: memory.sourceMessageId,
    importance: memory.importance ?? 0.5,
    expires_at: memory.expiresAt,
    metadata: memory.metadata as MemoryFragmentInsert['metadata'],
  }));

  const { data, error } = await supabase
    .from('memory_fragments')
    .insert(inserts)
    .select();

  if (error) {
    console.error('[Memory] Failed to create memory fragments:', error);
    return [];
  }

  return (data || []).map(toMemoryFragment);
}

/**
 * Get memory fragments for a user
 */
export async function getMemoryFragments(
  userId: string,
  agentId: string,
  options: {
    types?: MemoryType[];
    minConfidence?: number;
    minImportance?: number;
    includeExpired?: boolean;
    limit?: number;
    sessionId?: string;
  } = {}
): Promise<MemoryFragment[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  let query = supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_id', agentId);

  if (options.sessionId) {
    query = query.eq('session_id', options.sessionId);
  }

  if (options.types && options.types.length > 0) {
    query = query.in('memory_type', options.types);
  }

  if (options.minConfidence !== undefined) {
    query = query.gte('confidence', options.minConfidence);
  }

  if (options.minImportance !== undefined) {
    query = query.gte('importance', options.minImportance);
  }

  if (!options.includeExpired) {
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }

  query = query.order('importance', { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Memory] Failed to get memory fragments:', error);
    return [];
  }

  return (data || []).map(toMemoryFragment);
}

/**
 * Update a memory fragment's access count and last accessed time
 */
export async function touchMemoryFragment(memoryId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  // First get the current access count
  const { data: current } = await supabase
    .from('memory_fragments')
    .select('access_count')
    .eq('id', memoryId)
    .single();

  const newCount = (current?.access_count || 0) + 1;

  await supabase
    .from('memory_fragments')
    .update({
      access_count: newCount,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', memoryId);
}

/**
 * Delete expired memory fragments
 */
export async function cleanupExpiredMemories(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const { data, error } = await supabase
    .from('memory_fragments')
    .delete()
    .eq('user_id', userId)
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('[Memory] Failed to cleanup expired memories:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Delete a memory fragment
 */
export async function deleteMemoryFragment(memoryId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const { error } = await supabase.from('memory_fragments').delete().eq('id', memoryId);

  if (error) {
    console.error('[Memory] Failed to delete memory fragment:', error);
  }
}

// ============================================================================
// Conversation Summary Operations
// ============================================================================

/**
 * Create or update a conversation summary for a session
 */
export async function upsertConversationSummary(
  summary: CreateConversationSummary
): Promise<ConversationSummary | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const insert: ConversationSummaryInsert = {
    session_id: summary.sessionId,
    user_id: summary.userId,
    agent_id: summary.agentId,
    summary: summary.summary,
    key_topics: summary.keyTopics || [],
    key_entities: summary.keyEntities as ConversationSummaryInsert['key_entities'],
    sentiment_score: summary.sentimentScore ?? 0,
    message_count: summary.messageCount ?? 0,
    first_message_at: summary.firstMessageAt,
    last_message_at: summary.lastMessageAt,
    metadata: summary.metadata as ConversationSummaryInsert['metadata'],
  };

  const { data, error } = await supabase
    .from('conversation_summaries')
    .upsert(insert, { onConflict: 'session_id' })
    .select()
    .single();

  if (error) {
    console.error('[Memory] Failed to upsert conversation summary:', error);
    return null;
  }

  return toConversationSummary(data);
}

/**
 * Get conversation summary for a session
 */
export async function getConversationSummary(
  sessionId: string
): Promise<ConversationSummary | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('[Memory] Failed to get conversation summary:', error);
    return null;
  }

  return toConversationSummary(data);
}

/**
 * Get recent conversation summaries for a user
 */
export async function getRecentConversationSummaries(
  userId: string,
  agentId: string,
  limit: number = 10
): Promise<ConversationSummary[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Memory] Failed to get recent summaries:', error);
    return [];
  }

  return (data || []).map(toConversationSummary);
}

/**
 * Update a conversation summary
 */
export async function updateConversationSummary(
  sessionId: string,
  updates: UpdateConversationSummary
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const update: ConversationSummaryUpdate = {};

  if (updates.summary !== undefined) update.summary = updates.summary;
  if (updates.keyTopics !== undefined) update.key_topics = updates.keyTopics;
  if (updates.keyEntities !== undefined)
    update.key_entities = updates.keyEntities as ConversationSummaryUpdate['key_entities'];
  if (updates.sentimentScore !== undefined) update.sentiment_score = updates.sentimentScore;
  if (updates.messageCount !== undefined) update.message_count = updates.messageCount;
  if (updates.lastMessageAt !== undefined) update.last_message_at = updates.lastMessageAt;
  if (updates.metadata !== undefined)
    update.metadata = updates.metadata as ConversationSummaryUpdate['metadata'];

  const { error } = await supabase
    .from('conversation_summaries')
    .update(update)
    .eq('session_id', sessionId);

  if (error) {
    console.error('[Memory] Failed to update conversation summary:', error);
  }
}

/**
 * Delete a conversation summary
 */
export async function deleteConversationSummary(sessionId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const { error } = await supabase
    .from('conversation_summaries')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    console.error('[Memory] Failed to delete conversation summary:', error);
  }
}

// ============================================================================
// User Context Profile Operations
// ============================================================================

/**
 * Get or create a user context profile
 */
export async function getOrCreateUserContextProfile(
  userId: string,
  agentId: string
): Promise<UserContextProfile | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  // Try to get existing profile
  const { data: existing, error: selectError } = await supabase
    .from('user_context_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .single();

  if (existing && !selectError) {
    return toUserContextProfile(existing);
  }

  // Create new profile if not found
  if (selectError && selectError.code === 'PGRST116') {
    const insert: UserContextProfileInsert = {
      user_id: userId,
      agent_id: agentId,
    };

    const { data: created, error: insertError } = await supabase
      .from('user_context_profiles')
      .insert(insert)
      .select()
      .single();

    if (insertError) {
      console.error('[Memory] Failed to create user context profile:', insertError);
      return null;
    }

    return toUserContextProfile(created);
  }

  console.error('[Memory] Failed to get user context profile:', selectError);
  return null;
}

/**
 * Get user context profile
 */
export async function getUserContextProfile(
  userId: string,
  agentId: string
): Promise<UserContextProfile | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_context_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('[Memory] Failed to get user context profile:', error);
    return null;
  }

  return toUserContextProfile(data);
}

/**
 * Update user context profile
 */
export async function updateUserContextProfile(
  userId: string,
  agentId: string,
  updates: UpdateUserContextProfile
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const update: UserContextProfileUpdate = {};

  if (updates.displayName !== undefined) update.display_name = updates.displayName;
  if (updates.inferredInterests !== undefined) update.inferred_interests = updates.inferredInterests;
  if (updates.communicationStyle !== undefined)
    update.communication_style = updates.communicationStyle as UserContextProfileUpdate['communication_style'];
  if (updates.preferredTopics !== undefined) update.preferred_topics = updates.preferredTopics;
  if (updates.favoriteTeams !== undefined) update.favorite_teams = updates.favoriteTeams;
  if (updates.favoriteSports !== undefined) update.favorite_sports = updates.favoriteSports;
  if (updates.riskTolerance !== undefined) update.risk_tolerance = updates.riskTolerance;
  if (updates.bettingPreferences !== undefined)
    update.betting_preferences = updates.bettingPreferences as UserContextProfileUpdate['betting_preferences'];
  if (updates.totalSessions !== undefined) update.total_sessions = updates.totalSessions;
  if (updates.totalMessages !== undefined) update.total_messages = updates.totalMessages;
  if (updates.avgSessionDurationMinutes !== undefined)
    update.avg_session_duration_minutes = updates.avgSessionDurationMinutes;
  if (updates.lastInteractionAt !== undefined) update.last_interaction_at = updates.lastInteractionAt;
  if (updates.metadata !== undefined)
    update.metadata = updates.metadata as UserContextProfileUpdate['metadata'];

  const { error } = await supabase
    .from('user_context_profiles')
    .update(update)
    .eq('user_id', userId)
    .eq('agent_id', agentId);

  if (error) {
    console.error('[Memory] Failed to update user context profile:', error);
  }
}

/**
 * Increment session/message counts for a user profile
 */
export async function incrementUserStats(
  userId: string,
  agentId: string,
  messageCount: number = 1,
  isNewSession: boolean = false
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  // Get current profile
  const profile = await getUserContextProfile(userId, agentId);
  if (!profile) {
    // Create profile if it doesn't exist
    await getOrCreateUserContextProfile(userId, agentId);
    return;
  }

  const updates: UpdateUserContextProfile = {
    totalMessages: profile.totalMessages + messageCount,
    lastInteractionAt: new Date().toISOString(),
  };

  if (isNewSession) {
    updates.totalSessions = profile.totalSessions + 1;
  }

  await updateUserContextProfile(userId, agentId, updates);
}

// ============================================================================
// Memory Context Aggregation
// ============================================================================

/**
 * Get aggregated memory context for a chat session
 * This is the main function used by the chat to get relevant context
 */
export async function getMemoryContext(
  userId: string,
  options: MemoryContextOptions
): Promise<MemoryContext> {
  const {
    sessionId,
    agentId,
    maxRecentSummaries = 5,
    maxMemoryFragments = 20,
    memoryTypes,
    minConfidence = 0.5,
    includeExpired = false,
  } = options;

  // Default empty context
  const emptyContext: MemoryContext = {
    userProfile: null,
    recentSummaries: [],
    currentSessionSummary: null,
    relevantMemories: [],
    userFacts: {
      displayName: null,
      favoriteTeams: [],
      favoriteSports: [],
      riskTolerance: 'moderate',
      recentTopics: [],
    },
    lastUpdated: new Date().toISOString(),
    memoryCount: 0,
  };

  if (!isSupabaseConfigured()) {
    return emptyContext;
  }

  try {
    // Fetch all data in parallel
    const [userProfile, recentSummaries, currentSummary, memories] = await Promise.all([
      getUserContextProfile(userId, agentId),
      getRecentConversationSummaries(userId, agentId, maxRecentSummaries),
      sessionId ? getConversationSummary(sessionId) : Promise.resolve(null),
      getMemoryFragments(userId, agentId, {
        types: memoryTypes,
        minConfidence,
        includeExpired,
        limit: maxMemoryFragments,
      }),
    ]);

    // Extract recent topics from summaries
    const recentTopics = new Set<string>();
    recentSummaries.forEach((s) => {
      s.keyTopics.forEach((t) => recentTopics.add(t));
    });

    return {
      userProfile,
      recentSummaries,
      currentSessionSummary: currentSummary,
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
  } catch (error) {
    console.error('[Memory] Failed to get memory context:', error);
    return emptyContext;
  }
}

/**
 * Format memory context as a string for inclusion in prompts
 */
export function formatMemoryContextForPrompt(context: MemoryContext): string {
  const lines: string[] = [];

  // User profile summary
  if (context.userProfile) {
    lines.push('## User Profile');
    if (context.userFacts.displayName) {
      lines.push(`- Name: ${context.userFacts.displayName}`);
    }
    if (context.userFacts.favoriteTeams.length > 0) {
      lines.push(`- Favorite Teams: ${context.userFacts.favoriteTeams.join(', ')}`);
    }
    if (context.userFacts.favoriteSports.length > 0) {
      lines.push(`- Favorite Sports: ${context.userFacts.favoriteSports.join(', ')}`);
    }
    lines.push(`- Risk Tolerance: ${context.userFacts.riskTolerance}`);
    if (context.userProfile.totalSessions > 0) {
      lines.push(
        `- Interaction History: ${context.userProfile.totalSessions} sessions, ${context.userProfile.totalMessages} messages`
      );
    }
    lines.push('');
  }

  // Recent topics
  if (context.userFacts.recentTopics.length > 0) {
    lines.push('## Recent Topics');
    lines.push(context.userFacts.recentTopics.join(', '));
    lines.push('');
  }

  // Key memories
  const importantMemories = context.relevantMemories.filter((m) => m.importance >= 0.7);
  if (importantMemories.length > 0) {
    lines.push('## Key User Facts');
    importantMemories.slice(0, 5).forEach((m) => {
      lines.push(`- [${m.memoryType}] ${m.content}`);
    });
    lines.push('');
  }

  // Current session context
  if (context.currentSessionSummary) {
    lines.push('## Current Session');
    lines.push(context.currentSessionSummary.summary);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Realtime Subscriptions
// ============================================================================

/**
 * Subscribe to memory updates for a user
 */
export function subscribeToMemoryUpdates(
  userId: string,
  agentId: string,
  onUpdate: (type: 'fragment' | 'summary' | 'profile', data: MemoryFragment | ConversationSummary | UserContextProfile) => void
): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channels: ReturnType<typeof supabase.channel>[] = [];

  // Subscribe to memory fragments
  const fragmentChannel = supabase
    .channel(`memory_fragments:${userId}:${agentId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'memory_fragments',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newRow = payload.new as MemoryFragmentRow | null;
        if (newRow && newRow.agent_id === agentId) {
          onUpdate('fragment', toMemoryFragment(newRow));
        }
      }
    )
    .subscribe();
  channels.push(fragmentChannel);

  // Subscribe to conversation summaries
  const summaryChannel = supabase
    .channel(`conversation_summaries:${userId}:${agentId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversation_summaries',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newRow = payload.new as ConversationSummaryRow | null;
        if (newRow && newRow.agent_id === agentId) {
          onUpdate('summary', toConversationSummary(newRow));
        }
      }
    )
    .subscribe();
  channels.push(summaryChannel);

  // Subscribe to profile updates
  const profileChannel = supabase
    .channel(`user_context_profiles:${userId}:${agentId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_context_profiles',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newRow = payload.new as UserContextProfileRow | null;
        if (newRow && newRow.agent_id === agentId) {
          onUpdate('profile', toUserContextProfile(newRow));
        }
      }
    )
    .subscribe();
  channels.push(profileChannel);

  // Return unsubscribe function
  return () => {
    channels.forEach((channel) => channel.unsubscribe());
  };
}
