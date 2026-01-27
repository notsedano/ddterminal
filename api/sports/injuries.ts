import type { VercelRequest, VercelResponse } from '@vercel/node';

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_ACCESS_LEVEL = process.env.SPORTRADAR_ACCESS_LEVEL || 'production';
const SPORTRADAR_BASE_URL = 'https://api.sportradar.com/nba';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

// In-memory cache for injuries data (15 minute TTL)
const injuriesCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Cache key for league-wide injuries (not date-specific)
const LEAGUE_INJURIES_CACHE_KEY = 'league-injuries';

function isValidCache(entry: CacheEntry | undefined): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
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

  // Check cache first - use league-wide cache key
  const cachedEntry = injuriesCache.get(LEAGUE_INJURIES_CACHE_KEY);
  
  if (isValidCache(cachedEntry)) {
    // CDN cache for 10 minutes, stale-while-revalidate for 15 minutes
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=900');
    return res.status(200).json({
      success: true,
      data: cachedEntry.data,
      timestamp: new Date().toISOString(),
      cached: true,
    });
  }

  // Build Sportradar API URL for LEAGUE injuries (all active injuries across all teams)
  // This endpoint returns all current injuries, not just for games on a specific day
  const apiUrl = `${SPORTRADAR_BASE_URL}/${SPORTRADAR_ACCESS_LEVEL}/v8/en/league/injuries.json?api_key=${SPORTRADAR_API_KEY}`;

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

  // Cache the successful response using league-wide cache key
  injuriesCache.set(LEAGUE_INJURIES_CACHE_KEY, {
    data,
    timestamp: Date.now(),
  });

  // CDN cache for 10 minutes, stale-while-revalidate for 15 minutes
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=900');
  return res.status(200).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
    cached: false,
  });
}
