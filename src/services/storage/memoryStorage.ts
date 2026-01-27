/**
 * Memory Local Storage
 * IndexedDB storage for memory system (offline support)
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  MemoryFragment,
  ConversationSummary,
  UserContextProfile,
  MemoryType,
} from '@/types/memory';

interface MemoryDB extends DBSchema {
  memory_fragments: {
    key: string;
    value: MemoryFragment;
    indexes: {
      'by-userId': string;
      'by-sessionId': string;
      'by-agentId': string;
      'by-type': MemoryType;
      'by-importance': number;
      'by-createdAt': string;
    };
  };
  conversation_summaries: {
    key: string;
    value: ConversationSummary;
    indexes: {
      'by-userId': string;
      'by-sessionId': string;
      'by-agentId': string;
      'by-updatedAt': string;
    };
  };
  user_context_profiles: {
    key: string;
    value: UserContextProfile;
    indexes: {
      'by-userId': string;
      'by-agentId': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<MemoryDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MemoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MemoryDB>('eliza-memory', 1, {
      upgrade(db) {
        // Memory fragments store
        const fragmentStore = db.createObjectStore('memory_fragments', { keyPath: 'id' });
        fragmentStore.createIndex('by-userId', 'userId');
        fragmentStore.createIndex('by-sessionId', 'sessionId');
        fragmentStore.createIndex('by-agentId', 'agentId');
        fragmentStore.createIndex('by-type', 'memoryType');
        fragmentStore.createIndex('by-importance', 'importance');
        fragmentStore.createIndex('by-createdAt', 'createdAt');

        // Conversation summaries store
        const summaryStore = db.createObjectStore('conversation_summaries', { keyPath: 'id' });
        summaryStore.createIndex('by-userId', 'userId');
        summaryStore.createIndex('by-sessionId', 'sessionId');
        summaryStore.createIndex('by-agentId', 'agentId');
        summaryStore.createIndex('by-updatedAt', 'updatedAt');

        // User context profiles store
        const profileStore = db.createObjectStore('user_context_profiles', { keyPath: 'id' });
        profileStore.createIndex('by-userId', 'userId');
        profileStore.createIndex('by-agentId', 'agentId');
      },
    });
  }
  return dbPromise;
}

// ============================================================================
// Memory Fragment Operations
// ============================================================================

export async function saveLocalMemoryFragment(fragment: MemoryFragment): Promise<void> {
  const db = await getDB();
  await db.put('memory_fragments', fragment);
}

export async function saveLocalMemoryFragments(fragments: MemoryFragment[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('memory_fragments', 'readwrite');
  await Promise.all([
    ...fragments.map((f) => tx.store.put(f)),
    tx.done,
  ]);
}

export async function getLocalMemoryFragments(
  userId: string,
  agentId: string,
  options: {
    types?: MemoryType[];
    minImportance?: number;
    limit?: number;
    sessionId?: string;
  } = {}
): Promise<MemoryFragment[]> {
  const db = await getDB();
  const tx = db.transaction('memory_fragments', 'readonly');
  const index = tx.store.index('by-userId');
  
  let fragments = await index.getAll(userId);
  
  // Filter by agentId
  fragments = fragments.filter((f) => f.agentId === agentId);
  
  // Filter by session if specified
  if (options.sessionId) {
    fragments = fragments.filter((f) => f.sessionId === options.sessionId);
  }
  
  // Filter by types
  if (options.types && options.types.length > 0) {
    fragments = fragments.filter((f) => options.types!.includes(f.memoryType));
  }
  
  // Filter by importance
  if (options.minImportance !== undefined) {
    fragments = fragments.filter((f) => f.importance >= options.minImportance!);
  }
  
  // Filter out expired
  const now = new Date().toISOString();
  fragments = fragments.filter((f) => !f.expiresAt || f.expiresAt > now);
  
  // Sort by importance descending
  fragments.sort((a, b) => b.importance - a.importance);
  
  // Limit results
  if (options.limit) {
    fragments = fragments.slice(0, options.limit);
  }
  
  await tx.done;
  return fragments;
}

export async function deleteLocalMemoryFragment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('memory_fragments', id);
}

export async function cleanupExpiredLocalMemories(userId: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('memory_fragments', 'readwrite');
  const index = tx.store.index('by-userId');
  
  const fragments = await index.getAll(userId);
  const now = new Date().toISOString();
  let deleted = 0;
  
  for (const fragment of fragments) {
    if (fragment.expiresAt && fragment.expiresAt < now) {
      await tx.store.delete(fragment.id);
      deleted++;
    }
  }
  
  await tx.done;
  return deleted;
}

// ============================================================================
// Conversation Summary Operations
// ============================================================================

export async function saveLocalConversationSummary(summary: ConversationSummary): Promise<void> {
  const db = await getDB();
  await db.put('conversation_summaries', summary);
}

export async function getLocalConversationSummary(sessionId: string): Promise<ConversationSummary | undefined> {
  const db = await getDB();
  const tx = db.transaction('conversation_summaries', 'readonly');
  const index = tx.store.index('by-sessionId');
  const summaries = await index.getAll(sessionId);
  await tx.done;
  return summaries[0];
}

export async function getLocalRecentSummaries(
  userId: string,
  agentId: string,
  limit: number = 10
): Promise<ConversationSummary[]> {
  const db = await getDB();
  const tx = db.transaction('conversation_summaries', 'readonly');
  const index = tx.store.index('by-userId');
  
  let summaries = await index.getAll(userId);
  
  // Filter by agentId
  summaries = summaries.filter((s) => s.agentId === agentId);
  
  // Sort by updatedAt descending
  summaries.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  
  // Limit results
  summaries = summaries.slice(0, limit);
  
  await tx.done;
  return summaries;
}

export async function deleteLocalConversationSummary(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('conversation_summaries', 'readonly');
  const index = tx.store.index('by-sessionId');
  const summaries = await index.getAll(sessionId);
  await tx.done;
  
  if (summaries.length > 0) {
    const deleteTx = db.transaction('conversation_summaries', 'readwrite');
    await Promise.all([
      ...summaries.map((s) => deleteTx.store.delete(s.id)),
      deleteTx.done,
    ]);
  }
}

// ============================================================================
// User Context Profile Operations
// ============================================================================

export async function saveLocalUserContextProfile(profile: UserContextProfile): Promise<void> {
  const db = await getDB();
  await db.put('user_context_profiles', profile);
}

export async function getLocalUserContextProfile(
  userId: string,
  agentId: string
): Promise<UserContextProfile | undefined> {
  const db = await getDB();
  const tx = db.transaction('user_context_profiles', 'readonly');
  const index = tx.store.index('by-userId');
  
  const profiles = await index.getAll(userId);
  const profile = profiles.find((p) => p.agentId === agentId);
  
  await tx.done;
  return profile;
}

export async function deleteLocalUserContextProfile(userId: string, agentId: string): Promise<void> {
  const db = await getDB();
  const profile = await getLocalUserContextProfile(userId, agentId);
  if (profile) {
    await db.delete('user_context_profiles', profile.id);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export async function clearAllMemoryData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['memory_fragments', 'conversation_summaries', 'user_context_profiles'],
    'readwrite'
  );
  await tx.objectStore('memory_fragments').clear();
  await tx.objectStore('conversation_summaries').clear();
  await tx.objectStore('user_context_profiles').clear();
  await tx.done;
}

export async function clearUserMemoryData(userId: string): Promise<void> {
  const db = await getDB();
  
  // Delete memory fragments
  const fragmentTx = db.transaction('memory_fragments', 'readwrite');
  const fragmentIndex = fragmentTx.store.index('by-userId');
  const fragments = await fragmentIndex.getAll(userId);
  await Promise.all([
    ...fragments.map((f) => fragmentTx.store.delete(f.id)),
    fragmentTx.done,
  ]);
  
  // Delete summaries
  const summaryTx = db.transaction('conversation_summaries', 'readwrite');
  const summaryIndex = summaryTx.store.index('by-userId');
  const summaries = await summaryIndex.getAll(userId);
  await Promise.all([
    ...summaries.map((s) => summaryTx.store.delete(s.id)),
    summaryTx.done,
  ]);
  
  // Delete profiles
  const profileTx = db.transaction('user_context_profiles', 'readwrite');
  const profileIndex = profileTx.store.index('by-userId');
  const profiles = await profileIndex.getAll(userId);
  await Promise.all([
    ...profiles.map((p) => profileTx.store.delete(p.id)),
    profileTx.done,
  ]);
}

/**
 * Get memory stats for a user
 */
export async function getLocalMemoryStats(userId: string): Promise<{
  fragmentCount: number;
  summaryCount: number;
  profileCount: number;
}> {
  const db = await getDB();
  
  const fragmentTx = db.transaction('memory_fragments', 'readonly');
  const fragmentIndex = fragmentTx.store.index('by-userId');
  const fragments = await fragmentIndex.getAll(userId);
  
  const summaryTx = db.transaction('conversation_summaries', 'readonly');
  const summaryIndex = summaryTx.store.index('by-userId');
  const summaries = await summaryIndex.getAll(userId);
  
  const profileTx = db.transaction('user_context_profiles', 'readonly');
  const profileIndex = profileTx.store.index('by-userId');
  const profiles = await profileIndex.getAll(userId);
  
  return {
    fragmentCount: fragments.length,
    summaryCount: summaries.length,
    profileCount: profiles.length,
  };
}
