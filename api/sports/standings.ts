import type { VercelRequest, VercelResponse } from '@vercel/node';

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_ACCESS_LEVEL = process.env.SPORTRADAR_ACCESS_LEVEL || 'production';
const SPORTRADAR_BASE_URL = 'https://api.sportradar.com/nba';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

// In-memory cache for standings data (15 minute TTL - standings don't change frequently)
const standingsCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getCacheKey(seasonYear: number, seasonType: string): string {
  return `standings-${seasonYear}-${seasonType}`;
}

function isValidCache(entry: CacheEntry | undefined): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Get the NBA season year based on current date
 * NBA season starts in October, so if we're in Oct-Dec, use current year
 * If Jan-Sep, use previous year
 */
function getCurrentSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = January)
  const year = now.getFullYear();
  
  // If October (9) through December (11), current year is season start
  // Otherwise, previous year is season start
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
  const { year, seasonType } = req.query;
  
  const seasonYear = year ? parseInt(year as string) : getCurrentSeasonYear();
  const type = (seasonType as string) || 'REG'; // REG, PRE, PST (playoffs)

  // Check cache first
  const cacheKey = getCacheKey(seasonYear, type);
  const cachedEntry = standingsCache.get(cacheKey);
  
  if (isValidCache(cachedEntry)) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      success: true,
      data: cachedEntry.data,
      timestamp: new Date().toISOString(),
      cached: true,
    });
  }

  // Build Sportradar API URL for standings
  // Format: /nba/{access_level}/v8/en/seasons/{season_year}/{season_type}/standings.json
  const apiUrl = `${SPORTRADAR_BASE_URL}/${SPORTRADAR_ACCESS_LEVEL}/v8/en/seasons/${seasonYear}/${type}/standings.json?api_key=${SPORTRADAR_API_KEY}`;

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
  standingsCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  // CDN cache for 5 minutes, stale-while-revalidate for 10 minutes
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
    cached: false,
  });
}
