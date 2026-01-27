/**
 * Supabase Services Index
 * Re-exports all Supabase-related functionality
 */

export { supabase, isSupabaseConfigured, setSupabaseAuth, createAuthenticatedClient } from './client';
export type { Database } from './client';

export {
  // User operations
  getOrCreateUser,
  getUserById,
  getUserByPrivyId,
  // Session operations
  saveSessionToSupabase,
  getSessionFromSupabase,
  getAllSessionsFromSupabase,
  getSessionsByAgent,
  deleteSessionFromSupabase,
  updateSessionExpiration,
  // Message operations
  saveMessageToSupabase,
  saveMessagesToSupabase,
  getMessagesFromSupabase,
  getMessagesWithPagination,
  deleteMessageFromSupabase,
  // Preferences operations
  getUserPreferencesFromSupabase,
  updateThemePreference,
  updateTerminalConfig,
  updateUserPreferences,
  // Realtime subscriptions
  subscribeToMessages,
  subscribeToSessions,
} from './storage';

export {
  migrateToSupabase,
  isMigrationCompleted,
  clearLocalData,
  resetMigrationStatus,
  getMigrationStatus,
} from './migrate';
export type { MigrationResult } from './migrate';

// Archive operations
export {
  archiveSession,
  getArchivedSessions,
  getArchivedSession,
  getArchivedSessionByOriginalId,
  deleteArchivedSession,
} from './archive';

// Memory operations
export {
  // Memory fragment operations
  createMemoryFragment,
  createMemoryFragments,
  getMemoryFragments,
  touchMemoryFragment,
  cleanupExpiredMemories,
  deleteMemoryFragment,
  // Conversation summary operations
  upsertConversationSummary,
  getConversationSummary,
  getRecentConversationSummaries,
  updateConversationSummary,
  deleteConversationSummary,
  // User context profile operations
  getOrCreateUserContextProfile,
  getUserContextProfile,
  updateUserContextProfile,
  incrementUserStats,
  // Memory context aggregation
  getMemoryContext,
  formatMemoryContextForPrompt,
  // Realtime subscriptions
  subscribeToMemoryUpdates,
} from './memory';
