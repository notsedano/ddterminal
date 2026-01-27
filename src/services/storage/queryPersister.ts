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

interface QueryCacheDB {
  queryCache: {
    key: string;
    value: PersistedClient;
  };
}

let dbPromise: Promise<IDBPDatabase<QueryCacheDB>> | null = null;

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
    });
  }
  return dbPromise;
}

/**
 * Create an IndexedDB-based persister for React Query
 * This allows query cache to survive page refreshes
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      const db = await getDB();
      await db.put(STORE_NAME, client, CACHE_KEY);
    },

    restoreClient: async (): Promise<PersistedClient | undefined> => {
      const db = await getDB();
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
    },

    removeClient: async () => {
      const db = await getDB();
      await db.delete(STORE_NAME, CACHE_KEY);
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
