/**
 * Session Archive Service
 * Handles archiving deleted sessions for recovery and analytics
 */

import { supabase, isSupabaseConfigured } from './client';
import { getMessagesFromSupabase } from './storage';
import { getConversationSummary, getMemoryFragments } from './memory';
import type { ArchivedSessionInsert, ArchivedSessionRow } from '@/types/database';
import type { Session, ArchivedSession, SessionMetadata } from '@/types/session';
import type { Message } from '@/types/message';

/**
 * Archive a session before deletion
 * Preserves the conversation, messages, and memory data
 */
export async function archiveSession(
  session: Session,
  supabaseUserId: string,
  archiveReason: 'user_deleted' | 'expired' | 'system_cleanup' = 'user_deleted'
): Promise<ArchivedSession | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[Archive] Supabase not configured, skipping archive');
    return null;
  }

  // Fetch messages for this session
  const messages = await getMessagesFromSupabase(session.sessionId).catch(() => [] as Message[]);

  // Fetch conversation summary if exists
  const summary = await getConversationSummary(session.sessionId).catch(() => null);

  // Fetch memory fragments for this session
  const fragments = await getMemoryFragments(supabaseUserId, session.agentId, {
    sessionId: session.sessionId,
    limit: 100,
  }).catch(() => []);

  // Build archived messages (simplified format)
  const archivedMessages = messages.map((m) => ({
    id: m.id,
    text: m.text,
    userId: m.userId,
    agentId: m.agentId,
    role: m.role,
    createdAt: m.createdAt,
  }));

  // Extract matchup info from metadata
  const metadata = session.metadata as SessionMetadata;
  const matchupTitle = metadata?.matchupTitle || null;

  const insert: ArchivedSessionInsert = {
    original_session_id: session.sessionId,
    user_id: supabaseUserId,
    channel_id: session.channelId,
    agent_id: session.agentId,
    matchup_title: matchupTitle,
    matchup_data: metadata as ArchivedSessionInsert['matchup_data'],
    original_created_at: session.createdAt,
    original_expires_at: session.expiresAt,
    original_metadata: session.metadata as ArchivedSessionInsert['original_metadata'],
    timeout_config: session.timeoutConfig as ArchivedSessionInsert['timeout_config'],
    message_count: messages.length,
    messages: archivedMessages as ArchivedSessionInsert['messages'],
    conversation_summary: (summary || {}) as ArchivedSessionInsert['conversation_summary'],
    memory_fragments: fragments as ArchivedSessionInsert['memory_fragments'],
    archived_by: supabaseUserId,
    archive_reason: archiveReason,
  };

  const { data, error } = await supabase
    .from('archived_sessions')
    .upsert(insert, { onConflict: 'original_session_id,user_id' })
    .select()
    .single();

  if (error) {
    console.error('[Archive] Failed to archive session:', error);
    return null;
  }

  return archivedSessionFromRow(data);
}

/**
 * Get all archived sessions for a user
 */
export async function getArchivedSessions(
  supabaseUserId: string,
  options: {
    limit?: number;
    offset?: number;
    agentId?: string;
  } = {}
): Promise<ArchivedSession[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  let query = supabase
    .from('archived_sessions')
    .select('*')
    .eq('user_id', supabaseUserId)
    .order('archived_at', { ascending: false });

  if (options.agentId) {
    query = query.eq('agent_id', options.agentId);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Archive] Failed to get archived sessions:', error);
    return [];
  }

  return (data || []).map(archivedSessionFromRow);
}

/**
 * Get a single archived session by ID
 */
export async function getArchivedSession(archiveId: string): Promise<ArchivedSession | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('archived_sessions')
    .select('*')
    .eq('id', archiveId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Archive] Failed to get archived session:', error);
    return null;
  }

  return archivedSessionFromRow(data);
}

/**
 * Get archived session by original session ID
 */
export async function getArchivedSessionByOriginalId(
  originalSessionId: string,
  supabaseUserId: string
): Promise<ArchivedSession | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('archived_sessions')
    .select('*')
    .eq('original_session_id', originalSessionId)
    .eq('user_id', supabaseUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Archive] Failed to get archived session:', error);
    return null;
  }

  return archivedSessionFromRow(data);
}

/**
 * Permanently delete an archived session
 */
export async function deleteArchivedSession(archiveId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const { error } = await supabase.from('archived_sessions').delete().eq('id', archiveId);

  if (error) {
    console.error('[Archive] Failed to delete archived session:', error);
  }
}

/**
 * Convert database row to ArchivedSession type
 */
function archivedSessionFromRow(row: ArchivedSessionRow): ArchivedSession {
  // Parse messages from JSON
  let messages: ArchivedSession['messages'] = [];
  if (row.messages && Array.isArray(row.messages)) {
    messages = row.messages as unknown as ArchivedSession['messages'];
  }

  return {
    id: row.id,
    originalSessionId: row.original_session_id,
    userId: row.user_id,
    channelId: row.channel_id,
    agentId: row.agent_id,
    matchupTitle: row.matchup_title,
    matchupData: (row.matchup_data || {}) as SessionMetadata,
    originalCreatedAt: row.original_created_at,
    originalExpiresAt: row.original_expires_at,
    originalMetadata: (row.original_metadata || {}) as SessionMetadata,
    timeoutConfig: row.timeout_config as ArchivedSession['timeoutConfig'],
    messageCount: row.message_count,
    messages,
    conversationSummary: (row.conversation_summary || {}) as Record<string, unknown>,
    memoryFragments: (row.memory_fragments || []) as unknown as Record<string, unknown>[],
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    archiveReason: row.archive_reason as ArchivedSession['archiveReason'],
  };
}
