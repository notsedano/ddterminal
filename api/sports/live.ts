import type { VercelRequest, VercelResponse } from '@vercel/node';

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_ACCESS_LEVEL = process.env.SPORTRADAR_ACCESS_LEVEL || 'production';
const SPORTRADAR_BASE_URL = 'https://api.sportradar.com/nba';

/**
 * This endpoint provides live game data by polling the boxscore endpoint.
 * For true real-time updates, Sportradar Push Feeds require a persistent
 * server connection. Since Vercel functions are stateless, we use a polling
 * approach with short cache TTL.
 * 
 * The frontend will poll this endpoint every 10-15 seconds during live games.
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

// In-memory cache for live games (10 second TTL)
const liveGamesCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 10 * 1000; // 10 seconds

function isValidCache(entry: CacheEntry | undefined): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

interface LiveGameUpdate {
  id: string;
  status: string;
  clock?: string;
  quarter?: number;
  home: {
    id: string;
    name: string;
    market: string;
    alias: string;
    points: number;
  };
  away: {
    id: string;
    name: string;
    market: string;
    alias: string;
    points: number;
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are allowed' },
      timestamp: new Date().toISOString(),
    });
  }

  if (!SPORTRADAR_API_KEY) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'Sportradar API key not configured' },
      timestamp: new Date().toISOString(),
    });
  }

  const { gameIds } = req.query;

  if (!gameIds || typeof gameIds !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'gameIds is required (comma-separated)' },
      timestamp: new Date().toISOString(),
    });
  }

  const gameIdList = gameIds.split(',').map(id => id.trim()).filter(Boolean);

  if (gameIdList.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'At least one gameId is required' },
      timestamp: new Date().toISOString(),
    });
  }

  if (gameIdList.length > 10) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'Maximum 10 games per request' },
      timestamp: new Date().toISOString(),
    });
  }

  // Fetch updates for each game
  const updates: LiveGameUpdate[] = [];
  const errors: Array<{ gameId: string; error: string }> = [];

  await Promise.all(
    gameIdList.map(async (gameId) => {
      // Check cache first
      const cacheKey = `live-${gameId}`;
      const cachedEntry = liveGamesCache.get(cacheKey);

      if (isValidCache(cachedEntry)) {
        updates.push(cachedEntry.data as LiveGameUpdate);
        return;
      }

      const apiUrl = `${SPORTRADAR_BASE_URL}/${SPORTRADAR_ACCESS_LEVEL}/v8/en/games/${gameId}/boxscore.json?api_key=${SPORTRADAR_API_KEY}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        errors.push({
          gameId,
          error: `API returned ${response.status}`,
        });
        return;
      }

      const data = await response.json();

      const update: LiveGameUpdate = {
        id: data.id,
        status: data.status,
        clock: data.clock,
        quarter: data.quarter,
        home: {
          id: data.home.id,
          name: data.home.name,
          market: data.home.market,
          alias: data.home.alias,
          points: data.home.points ?? 0,
        },
        away: {
          id: data.away.id,
          name: data.away.name,
          market: data.away.market,
          alias: data.away.alias,
          points: data.away.points ?? 0,
        },
      };

      // Cache the update
      liveGamesCache.set(cacheKey, {
        data: update,
        timestamp: Date.now(),
      });

      updates.push(update);
    })
  );

  return res.status(200).json({
    success: true,
    data: {
      updates,
      errors: errors.length > 0 ? errors : undefined,
    },
    timestamp: new Date().toISOString(),
    cached: false,
  });
}
