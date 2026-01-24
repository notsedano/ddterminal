import type { VercelRequest, VercelResponse } from '@vercel/node';

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_ACCESS_LEVEL = process.env.SPORTRADAR_ACCESS_LEVEL || 'production';
const SPORTRADAR_BASE_URL = 'https://api.sportradar.com/nba';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

// In-memory cache for game data (30 second TTL for live games)
const gameCache: Map<string, CacheEntry> = new Map();
const LIVE_CACHE_TTL_MS = 30 * 1000; // 30 seconds for live games
const COMPLETED_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for completed games

function isValidCache(entry: CacheEntry | undefined, isLive: boolean): entry is CacheEntry {
  if (!entry) return false;
  const ttl = isLive ? LIVE_CACHE_TTL_MS : COMPLETED_CACHE_TTL_MS;
  return Date.now() - entry.timestamp < ttl;
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

  const { gameId, type = 'summary' } = req.query;

  if (!gameId || typeof gameId !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'gameId is required' },
      timestamp: new Date().toISOString(),
    });
  }

  // Determine if this is potentially a live game (we'll update cache after fetch)
  const cachedEntry = gameCache.get(`${gameId}-${type}`);
  const isLikelyLive = cachedEntry ? 
    isGameStatusLive((cachedEntry.data as { status?: string })?.status) : 
    true; // Assume live if no cache

  if (isValidCache(cachedEntry, isLikelyLive)) {
    return res.status(200).json({
      success: true,
      data: cachedEntry.data,
      timestamp: new Date().toISOString(),
      cached: true,
    });
  }

  // Determine endpoint based on type
  let endpoint: string;
  if (type === 'boxscore') {
    endpoint = `${SPORTRADAR_BASE_URL}/${SPORTRADAR_ACCESS_LEVEL}/v8/en/games/${gameId}/boxscore.json`;
  } else if (type === 'pbp') {
    endpoint = `${SPORTRADAR_BASE_URL}/${SPORTRADAR_ACCESS_LEVEL}/v8/en/games/${gameId}/pbp.json`;
  } else {
    endpoint = `${SPORTRADAR_BASE_URL}/${SPORTRADAR_ACCESS_LEVEL}/v8/en/games/${gameId}/summary.json`;
  }

  const apiUrl = `${endpoint}?api_key=${SPORTRADAR_API_KEY}`;

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Sportradar API error: ${response.status} - ${errorText}`);
    
    return res.status(response.status).json({
      success: false,
      error: {
        code: `SPORTRADAR_${response.status}`,
        message: `Sportradar API returned ${response.status}`,
        details: errorText,
      },
      timestamp: new Date().toISOString(),
    });
  }

  const data = await response.json();

  // Cache the successful response
  gameCache.set(`${gameId}-${type}`, {
    data,
    timestamp: Date.now(),
  });

  return res.status(200).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
    cached: false,
  });
}

function isGameStatusLive(status: string | undefined): boolean {
  return status === 'inprogress' || status === 'halftime';
}
