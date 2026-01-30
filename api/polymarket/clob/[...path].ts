import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOB_API_BASE = 'https://clob.polymarket.com';

// In-memory cache (30 second TTL for pricing data)
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds for pricing data

function getCacheKey(path: string, query: Record<string, unknown>): string {
  return `clob-${path}-${JSON.stringify(query)}`;
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

  // Get the path from the catch-all parameter
  const { path: pathParam } = req.query;
  const pathSegments = Array.isArray(pathParam) ? pathParam : [pathParam];
  const apiPath = pathSegments.filter(Boolean).join('/');

  // Build query string from remaining query params
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue; // Skip the path parameter
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

  const queryString = queryParams.toString();
  const fullPath = queryString ? `${apiPath}?${queryString}` : apiPath;

  // Check cache first (skip for orderbook which changes rapidly)
  const skipCache = apiPath.includes('book');
  const cacheKey = getCacheKey(apiPath, req.query as Record<string, unknown>);
  
  if (!skipCache) {
    const cachedEntry = cache.get(cacheKey);
    if (isValidCache(cachedEntry)) {
      // CDN cache for 15 seconds for price data
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
      return res.status(200).json(cachedEntry.data);
    }
  }

  // Build Polymarket API URL
  const apiUrl = `${CLOB_API_BASE}/${fullPath}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Polymarket CLOB API error: ${response.status} - ${errorText}`);
      
      return res.status(response.status).json({
        success: false,
        error: {
          code: `POLYMARKET_CLOB_${response.status}`,
          message: `Polymarket CLOB API returned ${response.status}`,
          details: errorText,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const data = await response.json();

    // Cache the successful response
    if (!skipCache) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
      // CDN cache for 15 seconds for price data
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    } else {
      // No CDN cache for orderbooks - they change too rapidly
      res.setHeader('Cache-Control', 'no-store');
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Polymarket CLOB API fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'POLYMARKET_CLOB_FETCH_ERROR',
        message: 'Failed to fetch from Polymarket CLOB API',
        details: errorMessage,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
