import type { VercelRequest, VercelResponse } from '@vercel/node';

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_ACCESS_LEVEL = process.env.SPORTRADAR_ACCESS_LEVEL || 'production';
const SPORTRADAR_BASE_URL = 'https://api.sportradar.com/nba';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

// In-memory cache for schedule data (5 minute TTL)
const scheduleCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(year: number, month: number, day: number): string {
  return `schedule-${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

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

  // Get date from query params or use today
  const { year, month, day } = req.query;
  
  let targetDate: Date;
  if (year && month && day) {
    targetDate = new Date(
      parseInt(year as string),
      parseInt(month as string) - 1,
      parseInt(day as string)
    );
  } else {
    // Use Eastern Time for NBA schedule (games are scheduled in ET)
    targetDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  }

  const y = targetDate.getFullYear();
  const m = targetDate.getMonth() + 1;
  const d = targetDate.getDate();

  // Check cache first
  const cacheKey = getCacheKey(y, m, d);
  const cachedEntry = scheduleCache.get(cacheKey);
  
  if (isValidCache(cachedEntry)) {
    // CDN cache for 2 minutes, stale-while-revalidate for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json({
      success: true,
      data: cachedEntry.data,
      timestamp: new Date().toISOString(),
      cached: true,
    });
  }

  // Build Sportradar API URL
  const apiUrl = `${SPORTRADAR_BASE_URL}/${SPORTRADAR_ACCESS_LEVEL}/v8/en/games/${y}/${m.toString().padStart(2, '0')}/${d.toString().padStart(2, '0')}/schedule.json?api_key=${SPORTRADAR_API_KEY}`;

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
  scheduleCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  // CDN cache for 2 minutes, stale-while-revalidate for 5 minutes
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  return res.status(200).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
    cached: false,
  });
}
