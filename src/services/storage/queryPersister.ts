/**
 * IndexedDB-based Query Persister for React Query
 * Persists query cache to IndexedDB for fast rehydration on app reload
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const DB_NAME = 'eliza-query-cache';
const DB_VERSION = 1;
const STORE_NAME = 'queryCache';
const CACHE_KEY = 'persistedQueries';

// Maximum age for persisted queries (24 hours)
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Flag to track if we've already logged a storage error (avoid spam)
let storageErrorLogged = false;

// Flag to track if persistence is disabled due to storage error
let persistenceDisabled = false;

interface QueryCacheDB {
  queryCache: {
    key: string;
    value: PersistedClient;
  };
}

let dbPromise: Promise<IDBPDatabase<QueryCacheDB>> | null = null;

/**
 * Check if an error is a storage-related error (quota, disk space, internal errors)
 */
function isStorageError(error: unknown): boolean {
  if (error instanceof Error) {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();
    
    return (
      errorName === 'quotaexceedederror' ||
      errorName === 'unknownerror' ||
      errorMessage.includes('quotaexceeded') ||
      errorMessage.includes('full disk') ||
      errorMessage.includes('storage quota') ||
      errorMessage.includes('internal error') ||
      errorMessage.includes('file_error_no_space') ||
      errorMessage.includes('no space') ||
      errorMessage.includes('disk full')
    );
  }
  return false;
}

/**
 * Get or create the IndexedDB database
 */
function getDB(): Promise<IDBPDatabase<QueryCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<QueryCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
      blocked() {
        console.warn('[QueryPersister] Database upgrade blocked by another tab');
      },
      blocking() {
        console.warn('[QueryPersister] This tab is blocking a database upgrade');
      },
      terminated() {
        console.warn('[QueryPersister] Database connection terminated unexpectedly');
        dbPromise = null;
      },
    }).catch((error) => {
      // Handle storage errors during database opening
      if (isStorageError(error)) {
        if (!storageErrorLogged) {
          console.warn('[QueryPersister] Storage error detected. Query persistence disabled.');
          console.info('[QueryPersister] To fix: Clear browser data or site storage for this domain.');
          storageErrorLogged = true;
        }
        persistenceDisabled = true;
        // Don't throw - return a dummy promise that resolves to prevent crashes
        return Promise.resolve(null as any);
      }
      throw error;
    });
  }
  return dbPromise;
}

/**
 * Create an IndexedDB-based persister for React Query
 * This allows query cache to survive page refreshes
 * Gracefully handles storage quota errors by disabling persistence
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      // Skip persistence if disabled due to quota error
      if (persistenceDisabled) {
        return;
      }

      try {
        const db = await getDB();
        if (!db) return; // DB failed to open due to storage error
        await db.put(STORE_NAME, client, CACHE_KEY);
      } catch (error) {
        if (isStorageError(error)) {
          // Disable persistence to prevent error loops
          persistenceDisabled = true;
          if (!storageErrorLogged) {
            console.warn('[QueryPersister] Storage error during persist. Disabling query cache persistence.');
            console.info('[QueryPersister] To fix: Clear browser data or site storage for this domain.');
            storageErrorLogged = true;
          }
          
          // Try to clear the old cache to free up space (silently fail)
          try {
            const db = await getDB();
            if (db) await db.clear(STORE_NAME);
          } catch {
            // Ignore errors during cleanup
          }
        } else {
          // Log other errors but don't throw to prevent app crashes
          console.error('[QueryPersister] Error persisting client:', error);
        }
      }
    },

    restoreClient: async (): Promise<PersistedClient | undefined> => {
      // Skip restore if persistence is disabled
      if (persistenceDisabled) {
        return undefined;
      }

      try {
        const db = await getDB();
        if (!db) return undefined; // DB failed to open due to storage error
        const cached = await db.get(STORE_NAME, CACHE_KEY);
        
        if (!cached) {
          return undefined;
        }

        // Check if the cache is too old
        if (cached.timestamp && Date.now() - cached.timestamp > MAX_AGE_MS) {
          await db.delete(STORE_NAME, CACHE_KEY);
          return undefined;
        }

        return cached;
      } catch (error) {
        if (isStorageError(error)) {
          persistenceDisabled = true;
          if (!storageErrorLogged) {
            console.warn('[QueryPersister] Storage error during restore. Disabling query cache persistence.');
            storageErrorLogged = true;
          }
        } else {
          console.error('[QueryPersister] Error restoring client:', error);
        }
        return undefined;
      }
    },

    removeClient: async () => {
      try {
        const db = await getDB();
        if (!db) return; // DB failed to open due to storage error
        await db.delete(STORE_NAME, CACHE_KEY);
      } catch (error) {
        // Ignore all errors during removal - not critical
        if (!isStorageError(error)) {
          console.error('[QueryPersister] Error removing client:', error);
        }
      }
    },
  };
}

/**
 * Query keys that should be persisted
 * Only persist relatively static data that doesn't change frequently
 */
export const PERSISTABLE_QUERY_KEYS = [
  'polymarket',           // Market metadata, events
  'nba-schedule',         // Daily schedule
  'championship-odds',    // Championship odds
] as const;

/**
 * Query key patterns that should NOT be persisted
 * These are per-game queries that can cause DataCloneError issues
 */
const EXCLUDED_QUERY_PATTERNS = [
  'game-market',          // Per-game market data - fetched on demand
  'game-markets',         // Per-game markets list
  'game-market-data',     // Per-game market data
  'live',                 // Live data
  'socket',               // WebSocket data
  'orderbook',            // Orderbook data
] as const;

/**
 * Filter function for queries that should be persisted
 * Excludes live/real-time data and per-game queries that change rapidly
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const key = queryKey[0];
  
  // Only persist specific query types
  if (typeof key === 'string') {
    // Check for excluded patterns in the entire query key
    const queryKeyStr = JSON.stringify(queryKey).toLowerCase();
    if (EXCLUDED_QUERY_PATTERNS.some(pattern => queryKeyStr.includes(pattern))) {
      return false;
    }
    
    // Persist market and schedule data
    return PERSISTABLE_QUERY_KEYS.some(persistKey => 
      key === persistKey || key.startsWith(persistKey)
    );
  }
  
  return false;
}

/**
 * Dehydrate options for persisting specific queries
 * Only dehydrates queries that are successful (not pending/error)
 */
export const dehydrateOptions = {
  shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) => {
    // Only persist queries that have successfully fetched data
    // This prevents DataCloneError from trying to persist Promises
    if (query.state.status !== 'success') {
      return false;
    }
    return shouldPersistQuery(query.queryKey);
  },
};

/**
 * Clear all persisted query cache
 */
export async function clearQueryCache(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
