/**
 * Data Migration Service
 * Migrates existing IndexedDB data to Supabase when user authenticates
 */

import { isSupabaseConfigured } from './client';
import {
  saveSessionToSupabase,
  saveMessagesToSupabase,
  getSessionFromSupabase,
  updateUserPreferences,
} from './storage';
import {
  getAllSessions as getIndexedDBSessions,
  getMessages as getIndexedDBMessages,
  clearAllData as clearIndexedDB,
} from '../storage/conversationStorage';
import { getTheme } from '@/utils/storage';
import type { Session } from '@/types';

const MIGRATION_KEY = 'eliza_migration_completed';
const MIGRATION_VERSION = 'v1';

/**
 * Check if migration has been completed for a user
 */
export function isMigrationCompleted(supabaseUserId: string): boolean {
  const migrationData = localStorage.getItem(MIGRATION_KEY);
  if (!migrationData) return false;

  const migrations = JSON.parse(migrationData) as Record<string, string>;
  return migrations[supabaseUserId] === MIGRATION_VERSION;
}

/**
 * Mark migration as completed for a user
 */
function markMigrationCompleted(supabaseUserId: string): void {
  const migrationData = localStorage.getItem(MIGRATION_KEY);
  const migrations = migrationData ? JSON.parse(migrationData) : {};
  migrations[supabaseUserId] = MIGRATION_VERSION;
  localStorage.setItem(MIGRATION_KEY, JSON.stringify(migrations));
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  sessionsCount: number;
  messagesCount: number;
  errors: string[];
  skipped: number;
}

/**
 * Migrate all data from IndexedDB to Supabase
 * This is called once when a user first authenticates
 */
export async function migrateToSupabase(
  legacyUserId: string,
  supabaseUserId: string,
  onProgress?: (progress: { current: number; total: number; stage: string }) => void
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    sessionsCount: 0,
    messagesCount: 0,
    errors: [],
    skipped: 0,
  };

  if (!isSupabaseConfigured()) {
    result.errors.push('Supabase not configured');
    return result;
  }

  if (isMigrationCompleted(supabaseUserId)) {
    result.success = true;
    result.skipped = 1;
    return result;
  }

  // Get all sessions from IndexedDB
  let sessions: Session[];
  try {
    sessions = await getIndexedDBSessions(legacyUserId);
  } catch (error) {
    // No existing data to migrate
    markMigrationCompleted(supabaseUserId);
    result.success = true;
    return result;
  }

  if (sessions.length === 0) {
    // No data to migrate
    markMigrationCompleted(supabaseUserId);
    result.success = true;
    return result;
  }

  const totalSessions = sessions.length;
  let processedSessions = 0;

  // Migrate each session and its messages
  for (const session of sessions) {
    onProgress?.({
      current: processedSessions,
      total: totalSessions,
      stage: `Migrating session ${processedSessions + 1}/${totalSessions}`,
    });

    // Check if session already exists in Supabase
    const existingSession = await getSessionFromSupabase(session.sessionId);
    if (existingSession) {
      // Skip already migrated sessions
      processedSessions++;
      result.skipped++;
      continue;
    }

    // Migrate session
    try {
      await saveSessionToSupabase(session, supabaseUserId);
      result.sessionsCount++;
    } catch (error) {
      result.errors.push(`Failed to migrate session ${session.sessionId}: ${error}`);
      continue;
    }

    // Get and migrate messages for this session
    try {
      const messages = await getIndexedDBMessages(session.sessionId);
      if (messages.length > 0) {
        await saveMessagesToSupabase(messages, supabaseUserId);
        result.messagesCount += messages.length;
      }
    } catch (error) {
      result.errors.push(`Failed to migrate messages for session ${session.sessionId}: ${error}`);
    }

    processedSessions++;
  }

  // Migrate user preferences (theme)
  try {
    const theme = getTheme();
    await updateUserPreferences(supabaseUserId, { theme });
  } catch (error) {
    result.errors.push(`Failed to migrate preferences: ${error}`);
  }

  // Mark migration as completed
  markMigrationCompleted(supabaseUserId);

  result.success = result.errors.length === 0;

  onProgress?.({
    current: totalSessions,
    total: totalSessions,
    stage: 'Migration complete',
  });

  return result;
}

/**
 * Clear local IndexedDB data after successful migration
 * Call this after confirming migration was successful
 */
export async function clearLocalData(): Promise<void> {
  await clearIndexedDB();
}

/**
 * Reset migration status for a user
 * Useful for debugging or re-migration
 */
export function resetMigrationStatus(supabaseUserId: string): void {
  const migrationData = localStorage.getItem(MIGRATION_KEY);
  if (migrationData) {
    const migrations = JSON.parse(migrationData) as Record<string, string>;
    delete migrations[supabaseUserId];
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(migrations));
  }
}

/**
 * Get migration status for all users
 */
export function getMigrationStatus(): Record<string, string> {
  const migrationData = localStorage.getItem(MIGRATION_KEY);
  return migrationData ? JSON.parse(migrationData) : {};
}
