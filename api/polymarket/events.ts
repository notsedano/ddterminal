import type { VercelRequest, VercelResponse } from '@vercel/node';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

// In-memory cache for events (2 minute TTL)
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const eventsCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCacheKey(query: Record<string, unknown>): string {
  return `events-${JSON.stringify(query)}`;
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

  // Forward all query parameters to Polymarket
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      queryParams.append(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === 'string') {
          queryParams.append(key, v);
        }
      }
    }
  }

  // Check cache first
  const cacheKey = getCacheKey(req.query as Record<string, unknown>);
  const cachedEntry = eventsCache.get(cacheKey);
  
  if (isValidCache(cachedEntry)) {
    return res.status(200).json(cachedEntry.data);
  }

  // Build Polymarket API URL
  const apiUrl = `${GAMMA_API_BASE}/events?${queryParams.toString()}`;

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Polymarket API error: ${response.status} - ${errorText}`);
    
    return res.status(response.status).json({
      success: false,
      error: {
        code: `POLYMARKET_${response.status}`,
        message: `Polymarket API returned ${response.status}`,
        details: errorText,
      },
      timestamp: new Date().toISOString(),
    });
  }

  const data = await response.json();

  // Cache the successful response
  eventsCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  return res.status(200).json(data);
}
