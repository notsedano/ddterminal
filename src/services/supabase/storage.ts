/**
 * Supabase Storage Service
 * Handles all database operations for sessions, messages, and user preferences
 */

import { supabase, isSupabaseConfigured } from './client';
import type {
  UserRow,
  UserInsert,
  SessionRow,
  SessionInsert,
  MessageRow,
  MessageInsert,
  UserPreferencesRow,
  UserPreferencesInsert,
  UserPreferencesUpdate,
} from '@/types/database';
import type { Session, Message } from '@/types';
import type { TerminalConfig } from '@/types/auth';
import { sanitizeMetadata } from '@/utils/messageUtils';

// ============================================================================
// User Operations
// ============================================================================

/**
 * Get or create a user by their Privy user ID
 * Returns the Supabase user ID
 */
export async function getOrCreateUser(privyUserId: string): Promise<UserRow> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  // First, try to get existing user
  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('privy_user_id', privyUserId)
    .single();

  if (existingUser && !selectError) {
    return existingUser;
  }

  // If not found, create new user
  if (selectError && selectError.code === 'PGRST116') {
    const newUser: UserInsert = {
      privy_user_id: privyUserId,
    };

    const { data: createdUser, error: insertError } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create user: ${insertError.message}`);
    }

    // Create default preferences for new user
    if (createdUser) {
      await createDefaultPreferences(createdUser.id);
    }

    return createdUser;
  }

  throw new Error(`Failed to get user: ${selectError?.message}`);
}

/**
 * Get user by Supabase user ID
 */
export async function getUserById(userId: string): Promise<UserRow | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data;
}

/**
 * Get user by Privy user ID
 */
export async function getUserByPrivyId(privyUserId: string): Promise<UserRow | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('privy_user_id', privyUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data;
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Convert database session row to Session type
 */
function sessionRowToSession(row: SessionRow): Session {
  const metadata = typeof row.metadata === 'object' && row.metadata !== null 
    ? row.metadata as Record<string, unknown>
    : {};
  
  const timeoutConfig = typeof row.timeout_config === 'object' && row.timeout_config !== null
    ? row.timeout_config as Session['timeoutConfig']
    : {
        timeoutMinutes: 30,
        autoRenew: true,
        maxDurationMinutes: 1440,
        warningThresholdMinutes: 5,
      };

  return {
    sessionId: row.id,
    channelId: row.channel_id,
    agentId: row.agent_id,
    userId: row.user_id,
    createdAt: row.created_at,
    metadata,
    expiresAt: row.expires_at,
    timeoutConfig,
  };
}

/**
 * Convert Session type to database insert format
 */
function sessionToInsert(session: Session, supabaseUserId: string): SessionInsert {
  return {
    id: session.sessionId,
    user_id: supabaseUserId,
    channel_id: session.channelId,
    agent_id: session.agentId,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
    metadata: session.metadata as SessionInsert['metadata'],
    timeout_config: session.timeoutConfig as SessionInsert['timeout_config'],
  };
}

/**
 * Save a session to Supabase
 */
export async function saveSessionToSupabase(
  session: Session,
  supabaseUserId: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const insert = sessionToInsert(session, supabaseUserId);

  const { error } = await supabase
    .from('sessions')
    .upsert(insert, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to save session: ${error.message}`);
  }
}

/**
 * Get a session by ID from Supabase
 */
export async function getSessionFromSupabase(sessionId: string): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return sessionRowToSession(data);
}

/**
 * Get all sessions for a user from Supabase
 */
export async function getAllSessionsFromSupabase(supabaseUserId: string): Promise<Session[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', supabaseUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get sessions: ${error.message}`);
  }

  return (data || []).map(sessionRowToSession);
}

/**
 * Get sessions for a specific agent
 */
export async function getSessionsByAgent(
  supabaseUserId: string,
  agentId: string
): Promise<Session[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', supabaseUserId)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get sessions: ${error.message}`);
  }

  return (data || []).map(sessionRowToSession);
}

/**
 * Delete a session from Supabase
 * Also deletes associated messages (cascade)
 */
export async function deleteSessionFromSupabase(sessionId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  // Delete messages first (in case cascade isn't set up)
  await supabase
    .from('messages')
    .delete()
    .eq('session_id', sessionId);

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

/**
 * Update session expiration
 */
export async function updateSessionExpiration(
  sessionId: string,
  expiresAt: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const { error } = await supabase
    .from('sessions')
    .update({ expires_at: expiresAt })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Convert database message row to Message type
 */
function messageRowToMessage(row: MessageRow): Message {
  const metadata = typeof row.metadata === 'object' && row.metadata !== null
    ? row.metadata as Record<string, unknown>
    : undefined;

  const isPredictionMessage = metadata?.isPredictionMessage === true;
  const displayText = metadata?.displayText as string | undefined;
  
  // For prediction messages, use displayText if available, otherwise use stored text
  const text = (isPredictionMessage && displayText) ? displayText : row.text;

  return {
    id: row.id,
    text,
    userId: row.user_id,
    agentId: row.agent_id || undefined,
    sessionId: row.session_id,
    createdAt: row.created_at,
    role: row.role,
    metadata,
  };
}

/**
 * Safely stringify an object to detect circular references before Supabase operations
 * This helps identify the source of circular references
 */
function safeStringifyForDebug(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    if (error instanceof Error && error.message.includes('cyclic')) {
      // Try to identify which field has the circular reference
      const objKeys = typeof obj === 'object' && obj !== null ? Object.keys(obj) : [];
      throw new Error(`Circular reference detected in object with keys: ${objKeys.join(', ')}`);
    }
    throw error;
  }
}

/**
 * Convert Message type to database insert format
 * Ensures all data is fully serializable before sending to Supabase
 */
function messageToInsert(message: Message, supabaseUserId: string): MessageInsert {
  // Sanitize metadata first
  const sanitizedMetadata = sanitizeMetadata(message.metadata);
  
  // Create the insert object with only primitive/serializable values
  const insert: MessageInsert = {
    id: String(message.id),
    session_id: String(message.sessionId),
    user_id: String(supabaseUserId),
    agent_id: message.agentId ? String(message.agentId) : null,
    text: String(message.text),
    role: message.role,
    created_at: String(message.createdAt),
    metadata: sanitizedMetadata as MessageInsert['metadata'],
  };
  
  // Verify the insert object is serializable before returning
  // This will throw an error with more context if there's a circular reference
  try {
    safeStringifyForDebug(insert);
  } catch (error) {
    console.error('[messageToInsert] Circular reference detected:', {
      messageId: message.id,
      hasMetadata: !!message.metadata,
      metadataKeys: message.metadata ? Object.keys(message.metadata) : [],
    });
    throw new Error(`Message contains circular references that cannot be serialized: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return insert;
}

/**
 * Save a message to Supabase
 */
export async function saveMessageToSupabase(
  message: Message,
  supabaseUserId: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const insert = messageToInsert(message, supabaseUserId);

    const { error } = await supabase
      .from('messages')
      .upsert(insert, { onConflict: 'id' });

    if (error) {
      // Check if the error is related to circular references
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('cyclic') || errorMessage.includes('circular') || errorMessage.includes('JSON.stringify')) {
        console.error('[saveMessageToSupabase] Circular reference error from Supabase:', {
          messageId: message.id,
          error: errorMessage,
          metadataKeys: message.metadata ? Object.keys(message.metadata) : [],
        });
        throw new Error(`Message contains circular references. Metadata keys: ${message.metadata ? Object.keys(message.metadata).join(', ') : 'none'}`);
      }
      throw new Error(`Failed to save message: ${errorMessage}`);
    }
  } catch (error) {
    // Re-throw with more context if it's a circular reference error
    if (error instanceof Error) {
      if (error.message.includes('cyclic') || error.message.includes('circular') || error.message.includes('JSON.stringify')) {
        throw new Error(`Cannot save message due to circular references: ${error.message}`);
      }
    }
    throw error;
  }
}

/**
 * Save multiple messages to Supabase
 */
export async function saveMessagesToSupabase(
  messages: Message[],
  supabaseUserId: string
): Promise<void> {
  if (!isSupabaseConfigured() || messages.length === 0) {
    return;
  }

  const inserts = messages.map((m) => messageToInsert(m, supabaseUserId));

  const { error } = await supabase
    .from('messages')
    .upsert(inserts, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to save messages: ${error.message}`);
  }
}

/**
 * Get messages for a session from Supabase
 */
export async function getMessagesFromSupabase(sessionId: string): Promise<Message[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  return (data || []).map(messageRowToMessage);
}

/**
 * Get messages with pagination
 */
export async function getMessagesWithPagination(
  sessionId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ messages: Message[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) {
    return { messages: [], hasMore: false };
  }

  const { data, error, count } = await supabase
    .from('messages')
    .select('*', { count: 'exact' })
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  const messages = (data || []).map(messageRowToMessage);
  const hasMore = count !== null && offset + limit < count;

  return { messages, hasMore };
}

/**
 * Delete a message from Supabase
 */
export async function deleteMessageFromSupabase(messageId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }
}

// ============================================================================
// User Preferences Operations
// ============================================================================

/**
 * Create default preferences for a new user
 */
async function createDefaultPreferences(supabaseUserId: string): Promise<void> {
  const defaultPrefs: UserPreferencesInsert = {
    user_id: supabaseUserId,
    theme: 'dark',
    terminal_config: {
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      lineHeight: 1.2,
      letterSpacing: 0,
    },
  };

  await supabase.from('user_preferences').insert(defaultPrefs);
}

/**
 * Get user preferences from Supabase
 */
export async function getUserPreferencesFromSupabase(
  supabaseUserId: string
): Promise<UserPreferencesRow | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', supabaseUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No preferences found, create defaults
      await createDefaultPreferences(supabaseUserId);
      return getUserPreferencesFromSupabase(supabaseUserId);
    }
    throw new Error(`Failed to get preferences: ${error.message}`);
  }

  return data;
}

/**
 * Update user theme preference
 */
export async function updateThemePreference(
  supabaseUserId: string,
  theme: 'dark' | 'light'
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const update: UserPreferencesUpdate = {
    theme,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_preferences')
    .update(update)
    .eq('user_id', supabaseUserId);

  if (error) {
    throw new Error(`Failed to update theme: ${error.message}`);
  }
}

/**
 * Update terminal configuration
 */
export async function updateTerminalConfig(
  supabaseUserId: string,
  terminalConfig: TerminalConfig
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const update: UserPreferencesUpdate = {
    terminal_config: terminalConfig as UserPreferencesUpdate['terminal_config'],
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_preferences')
    .update(update)
    .eq('user_id', supabaseUserId);

  if (error) {
    throw new Error(`Failed to update terminal config: ${error.message}`);
  }
}

/**
 * Update all user preferences
 */
export async function updateUserPreferences(
  supabaseUserId: string,
  preferences: Partial<Pick<UserPreferencesRow, 'theme' | 'terminal_config'>>
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const update: UserPreferencesUpdate = {
    ...preferences,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_preferences')
    .update(update)
    .eq('user_id', supabaseUserId);

  if (error) {
    throw new Error(`Failed to update preferences: ${error.message}`);
  }
}

// ============================================================================
// Realtime Subscriptions
// ============================================================================

/**
 * Subscribe to messages for a session
 * Returns an unsubscribe function
 */
export function subscribeToMessages(
  sessionId: string,
  onMessage: (message: Message) => void
): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const subscription = supabase
    .channel(`messages:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const message = messageRowToMessage(payload.new as MessageRow);
        onMessage(message);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Subscribe to session changes for a user
 * Returns an unsubscribe function
 */
export function subscribeToSessions(
  supabaseUserId: string,
  onSessionChange: (session: Session, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const subscription = supabase
    .channel(`sessions:${supabaseUserId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `user_id=eq.${supabaseUserId}`,
      },
      (payload) => {
        const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
        if (eventType === 'DELETE') {
          // For DELETE, payload.old contains the deleted row
          const session = sessionRowToSession(payload.old as SessionRow);
          onSessionChange(session, eventType);
        } else {
          const session = sessionRowToSession(payload.new as SessionRow);
          onSessionChange(session, eventType);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
