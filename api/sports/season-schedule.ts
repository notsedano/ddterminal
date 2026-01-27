import type { VercelRequest, VercelResponse } from '@vercel/node';

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_ACCESS_LEVEL = process.env.SPORTRADAR_ACCESS_LEVEL || 'production';
const SPORTRADAR_BASE_URL = 'https://api.sportradar.com/nba';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

// In-memory cache for season schedule data (30 minute TTL - season schedule is relatively static)
const scheduleCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCacheKey(seasonYear: number, seasonType: string): string {
  return `season-schedule-${seasonYear}-${seasonType}`;
}

function isValidCache(entry: CacheEntry | undefined): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Get the NBA season year based on current date
 */
function getCurrentSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year : year - 1;
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

  // Get season parameters from query
  const { year, seasonType, teamId } = req.query;
  
  const seasonYear = year ? parseInt(year as string) : getCurrentSeasonYear();
  const type = (seasonType as string) || 'REG';

  // Check cache first
  const cacheKey = getCacheKey(seasonYear, type);
  const cachedEntry = scheduleCache.get(cacheKey);
  
  if (isValidCache(cachedEntry)) {
    let data = cachedEntry.data;
    
    // Filter by team if requested
    if (teamId && typeof data === 'object' && data !== null && 'games' in data) {
      const fullData = data as { games: Array<{ home: { id: string }; away: { id: string } }> };
      data = {
        ...fullData,
        games: fullData.games.filter(
          (game) => game.home.id === teamId || game.away.id === teamId
        ),
      };
    }
    
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      cached: true,
    });
  }

  // Build Sportradar API URL for season schedule
  // Format: /nba/{access_level}/v8/en/games/{season_year}/{season_type}/schedule.json
  const apiUrl = `${SPORTRADAR_BASE_URL}/${SPORTRADAR_ACCESS_LEVEL}/v8/en/games/${seasonYear}/${type}/schedule.json?api_key=${SPORTRADAR_API_KEY}`;

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

  // Cache the full response
  scheduleCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  // Filter by team if requested
  let responseData = data;
  if (teamId && data.games) {
    responseData = {
      ...data,
      games: data.games.filter(
        (game: { home: { id: string }; away: { id: string } }) => 
          game.home.id === teamId || game.away.id === teamId
      ),
    };
  }

  // CDN cache for 10 minutes, stale-while-revalidate for 30 minutes
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  return res.status(200).json({
    success: true,
    data: responseData,
    timestamp: new Date().toISOString(),
    cached: false,
  });
}
