import type { VercelRequest, VercelResponse } from '@vercel/node';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

// In-memory cache (2 minute TTL)
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCacheKey(path: string, query: Record<string, unknown>): string {
  return `gamma-${path}-${JSON.stringify(query)}`;
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

  // Check cache first
  const cacheKey = getCacheKey(apiPath, req.query as Record<string, unknown>);
  const cachedEntry = cache.get(cacheKey);
  
  if (isValidCache(cachedEntry)) {
    // CDN cache for 1 minute, stale-while-revalidate for 2 minutes
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(cachedEntry.data);
  }

  // Build Polymarket API URL
  const apiUrl = `${GAMMA_API_BASE}/${fullPath}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Polymarket Gamma API error: ${response.status} - ${errorText}`);
      
      return res.status(response.status).json({
        success: false,
        error: {
          code: `POLYMARKET_GAMMA_${response.status}`,
          message: `Polymarket Gamma API returned ${response.status}`,
          details: errorText,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`Polymarket returned non-JSON: ${contentType}`, text.substring(0, 200));
      return res.status(502).json({
        success: false,
        error: { code: 'POLYMARKET_INVALID_RESPONSE', message: 'Polymarket returned non-JSON response' },
        timestamp: new Date().toISOString(),
      });
    }

    const data = await response.json();

    // Cache the successful response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    // Longer cache for static endpoints (tags, sports metadata)
    const isStaticEndpoint = apiPath === 'tags' || apiPath === 'sports' || apiPath === 'sports/market-types';
    const cacheSeconds = isStaticEndpoint ? 3600 : 60; // 1 hour for static, 1 minute for dynamic
    const revalidateSeconds = isStaticEndpoint ? 7200 : 120;
    res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=${revalidateSeconds}`);
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Polymarket Gamma API fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'POLYMARKET_GAMMA_FETCH_ERROR',
        message: 'Failed to fetch from Polymarket Gamma API',
        details: errorMessage,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
