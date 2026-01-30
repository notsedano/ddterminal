/**
 * Polymarket CLOB API Service
 * Pricing, orderbooks, trades, and price history
 */

import type {
  PolymarketOrderbook,
  PolymarketPriceHistoryPoint,
  PolymarketTrade,
  PolymarketSportsMarket,
  ParsedOutcome,
} from '@/types';

// API Configuration
// Always use proxy/serverless function to avoid CORS issues
// Development: Vite proxy, Production: Vercel serverless functions
const CLOB_API = '/api/polymarket/clob';

// Cache for prices with short TTL
interface PriceCache {
  prices: Map<string, number>;
  timestamp: number;
}

let priceCache: PriceCache | null = null;
const PRICE_CACHE_TTL = 10000; // 10 seconds - balance between freshness and rate limiting

// Track warnings to avoid console spam
let lastPriceWarningTime = 0;
const WARNING_COOLDOWN_MS = 60000; // Only warn once per minute

// Track consecutive failures for backoff
let consecutiveFailures = 0;
const MAX_BACKOFF_FAILURES = 5;

/**
 * Get current price for a single token
 * Note: This endpoint may not exist on Polymarket's API. Use getTokenPrices for batch requests instead.
 * @deprecated Use getTokenPrices for batch requests - individual endpoint may not exist
 */
export async function getTokenPrice(tokenId: string, side: 'buy' | 'sell' = 'buy'): Promise<number> {
  // Check if we have a cached price
  if (priceCache && Date.now() - priceCache.timestamp < PRICE_CACHE_TTL) {
    const cached = priceCache.prices.get(tokenId);
    if (cached !== undefined) return cached;
  }

  const response = await fetch(
    `${CLOB_API}/price?token_id=${encodeURIComponent(tokenId)}&side=${side}`,
    { headers: { 'Accept': 'application/json' } }
  ).catch(() => null);

  if (!response || !response.ok) {
    // Return cached price if available, otherwise 0
    return priceCache?.prices.get(tokenId) ?? 0;
  }

  const data = await response.json();
  const price = parseFloat(data.price) || 0;
  
  // Update cache
  if (!priceCache) {
    priceCache = { prices: new Map(), timestamp: Date.now() };
  }
  priceCache.prices.set(tokenId, price);
  
  return price;
}

/**
 * Get midpoint price for a token
 */
export async function getTokenMidpoint(tokenId: string): Promise<number> {
  const response = await fetch(
    `${CLOB_API}/midpoint?token_id=${encodeURIComponent(tokenId)}`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch midpoint: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parseFloat(data.mid) || 0;
}

/**
 * Get prices for multiple tokens in batch
 * More efficient than multiple individual calls
 */
export async function getTokenPrices(tokenIds: string[]): Promise<Map<string, number>> {
  if (tokenIds.length === 0) {
    return new Map();
  }

  // If we've had too many consecutive failures, use cache and skip API call
  if (consecutiveFailures >= MAX_BACKOFF_FAILURES) {
    const prices = new Map<string, number>();
    if (priceCache) {
      for (const tokenId of tokenIds) {
        const cachedPrice = priceCache.prices.get(tokenId);
        if (cachedPrice !== undefined) {
          prices.set(tokenId, cachedPrice);
        }
      }
    }
    // Reset after a longer cooldown
    if (Date.now() - lastPriceWarningTime > WARNING_COOLDOWN_MS * 2) {
      consecutiveFailures = 0;
    }
    return prices;
  }

  // Check cache - if fresh enough, use it
  if (priceCache && Date.now() - priceCache.timestamp < PRICE_CACHE_TTL) {
    const allCached = tokenIds.every(id => priceCache!.prices.has(id));
    if (allCached) {
      const result = new Map<string, number>();
      for (const id of tokenIds) {
        result.set(id, priceCache.prices.get(id)!);
      }
      return result;
    }
  }

  // Batch request using the /prices endpoint
  // Limit token IDs to prevent URL length issues (400 error)
  // Reduced from 20 to 10 to avoid URL length limits with very long token IDs
  const MAX_TOKENS_PER_REQUEST = 10;
  const limitedTokenIds = tokenIds.slice(0, MAX_TOKENS_PER_REQUEST);
  
  // Build URL with token_ids as multiple query parameters
  // This is more reliable than comma-separated strings for long lists
  const params = new URLSearchParams();
  for (const tokenId of limitedTokenIds) {
    params.append('token_ids', tokenId);
  }
  
  const response = await fetch(
    `${CLOB_API}/prices?${params.toString()}`,
    { headers: { 'Accept': 'application/json' } }
  ).catch(() => null);

  if (!response || !response.ok) {
    consecutiveFailures++;
    
    // Only log warning occasionally to avoid spam
    const now = Date.now();
    if (now - lastPriceWarningTime > WARNING_COOLDOWN_MS) {
      lastPriceWarningTime = now;
      console.warn(`Polymarket price API unavailable (${response?.status || 'network error'}). Using cached prices.`);
    }
    
    // Return cached prices
    const prices = new Map<string, number>();
    if (priceCache) {
      for (const tokenId of tokenIds) {
        const cachedPrice = priceCache.prices.get(tokenId);
        if (cachedPrice !== undefined) {
          prices.set(tokenId, cachedPrice);
        }
      }
    }
    return prices;
  }

  // Success - reset failure counter
  consecutiveFailures = 0;
  
  const data = await response.json();
  const prices = new Map<string, number>();
  
  for (const tokenId of limitedTokenIds) {
    const priceValue = data[tokenId];
    if (typeof priceValue === 'number') {
      prices.set(tokenId, priceValue);
    } else if (typeof priceValue === 'string') {
      prices.set(tokenId, parseFloat(priceValue) || 0);
    } else {
      prices.set(tokenId, 0);
    }
  }

  // Update cache with new prices
  if (!priceCache) {
    priceCache = { prices: new Map(), timestamp: Date.now() };
  }
  for (const [id, price] of prices) {
    priceCache.prices.set(id, price);
  }
  priceCache.timestamp = Date.now();

  return prices;
}

/**
 * Get full orderbook for a token
 */
export async function getOrderbook(tokenId: string): Promise<PolymarketOrderbook> {
  const response = await fetch(
    `${CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch orderbook: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get orderbooks for multiple tokens
 */
export async function getOrderbooks(tokenIds: string[]): Promise<Map<string, PolymarketOrderbook>> {
  if (tokenIds.length === 0) {
    return new Map();
  }

  const tokenIdsParam = tokenIds.join(',');
  const response = await fetch(
    `${CLOB_API}/books?token_ids=${encodeURIComponent(tokenIdsParam)}`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    // Don't fallback to individual requests - they will likely also fail
    // Return empty map to avoid cascading 404s and console spam
    return new Map();
  }

  const data = await response.json();
  const orderbooks = new Map<string, PolymarketOrderbook>();
  
  // The response is an array of orderbooks
  if (Array.isArray(data)) {
    for (const book of data) {
      if (book && book.asset_id) {
        orderbooks.set(book.asset_id, book);
      }
    }
  } else if (typeof data === 'object') {
    // Or it might be an object keyed by token ID
    for (const [tokenId, book] of Object.entries(data)) {
      if (book && typeof book === 'object') {
        orderbooks.set(tokenId, book as PolymarketOrderbook);
      }
    }
  }

  return orderbooks;
}

/**
 * Get tick size for a token (minimum price increment)
 */
export async function getTickSize(tokenId: string): Promise<number> {
  const response = await fetch(
    `${CLOB_API}/tick-size?token_id=${encodeURIComponent(tokenId)}`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    // Default tick size is 0.01
    return 0.01;
  }

  const data = await response.json();
  return parseFloat(data.minimum_tick_size) || 0.01;
}

/**
 * Get recent trades for a market or token
 */
export async function getTrades(options: {
  tokenId?: string;
  marketId?: string;
  limit?: number;
}): Promise<PolymarketTrade[]> {
  const params = new URLSearchParams();
  
  if (options.tokenId) params.append('asset_id', options.tokenId);
  if (options.marketId) params.append('market', options.marketId);
  if (options.limit) params.append('limit', String(options.limit));

  const response = await fetch(
    `${CLOB_API}/trades?${params}`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch trades: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get price history for a token
 * Note: This endpoint may have specific format requirements
 */
export async function getPriceHistory(
  tokenId: string,
  options: {
    interval?: 'minute' | 'hour' | 'day' | '1m' | '1h' | '6h' | '1d' | '1w' | 'max';
    startTs?: number;
    endTs?: number;
    fidelity?: number;
  } = {}
): Promise<PolymarketPriceHistoryPoint[]> {
  const { interval = '1h', fidelity = 60 } = options;
  
  // Map legacy interval names to Polymarket API format
  const apiIntervalMap: Record<string, string> = {
    'minute': '1m',
    'hour': '1h',
    'day': '1d',
    '1m': '1m',
    '1h': '1h',
    '6h': '6h',
    '1d': '1d',
    '1w': '1w',
    'max': 'max',
  };
  const apiInterval = apiIntervalMap[interval] || '1h';
  
  const params = new URLSearchParams({
    market: tokenId,
    interval: apiInterval,
    fidelity: String(fidelity),
  });
  
  if (options.startTs) params.append('startTs', String(options.startTs));
  if (options.endTs) params.append('endTs', String(options.endTs));

  const response = await fetch(
    `${CLOB_API}/prices-history?${params}`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch price history: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Handle different response formats
  if (data.history) {
    return data.history;
  }
  if (Array.isArray(data)) {
    return data;
  }
  
  return [];
}

/**
 * Calculate spread from best bid and ask
 */
export function calculateSpread(bestBid: number, bestAsk: number): number {
  return bestAsk - bestBid;
}

/**
 * Get best bid and ask from orderbook
 */
export function getBestBidAsk(orderbook: PolymarketOrderbook): {
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  bidDepth: number;
  askDepth: number;
} {
  const bestBid = orderbook.bids.length > 0 ? parseFloat(orderbook.bids[0].price) : null;
  const bestAsk = orderbook.asks.length > 0 ? parseFloat(orderbook.asks[0].price) : null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  
  // Calculate depth (total size at all levels)
  const bidDepth = orderbook.bids.reduce((sum, entry) => sum + parseFloat(entry.size), 0);
  const askDepth = orderbook.asks.reduce((sum, entry) => sum + parseFloat(entry.size), 0);

  return { bestBid, bestAsk, spread, bidDepth, askDepth };
}

/**
 * Calculate orderbook metrics
 */
export function calculateOrderbookMetrics(orderbook: PolymarketOrderbook): {
  bestBid: number | null;
  bestAsk: number | null;
  midpoint: number | null;
  spread: number | null;
  spreadBps: number | null;
  bidDepth: number;
  askDepth: number;
  imbalance: number; // Positive = more bids, negative = more asks
} {
  const { bestBid, bestAsk, spread, bidDepth, askDepth } = getBestBidAsk(orderbook);
  
  const midpoint = bestBid !== null && bestAsk !== null 
    ? (bestBid + bestAsk) / 2 
    : null;
  
  const spreadBps = spread !== null && midpoint !== null && midpoint > 0
    ? (spread / midpoint) * 10000 // Basis points
    : null;
  
  const totalDepth = bidDepth + askDepth;
  const imbalance = totalDepth > 0 
    ? (bidDepth - askDepth) / totalDepth 
    : 0;

  return {
    bestBid,
    bestAsk,
    midpoint,
    spread,
    spreadBps,
    bidDepth,
    askDepth,
    imbalance,
  };
}

/**
 * Aggregate orderbook levels for display
 * Combines multiple price levels into buckets
 */
export function aggregateOrderbook(
  orderbook: PolymarketOrderbook,
  numLevels: number = 10,
  priceIncrement: number = 0.01
): {
  bids: Array<{ price: number; size: number; total: number }>;
  asks: Array<{ price: number; size: number; total: number }>;
} {
  // Helper to aggregate levels
  const aggregateLevels = (
    entries: Array<{ price: string; size: string }>,
    isAsk: boolean
  ): Array<{ price: number; size: number; total: number }> => {
    const buckets = new Map<number, number>();
    
    for (const entry of entries) {
      const price = parseFloat(entry.price);
      const size = parseFloat(entry.size);
      const bucketPrice = Math.round(price / priceIncrement) * priceIncrement;
      buckets.set(bucketPrice, (buckets.get(bucketPrice) || 0) + size);
    }
    
    // Sort and limit
    const sorted = Array.from(buckets.entries())
      .sort((a, b) => isAsk ? a[0] - b[0] : b[0] - a[0])
      .slice(0, numLevels);
    
    // Calculate running totals
    let runningTotal = 0;
    return sorted.map(([price, size]) => {
      runningTotal += size;
      return { price, size, total: runningTotal };
    });
  };

  return {
    bids: aggregateLevels(orderbook.bids, false),
    asks: aggregateLevels(orderbook.asks, true),
  };
}

/**
 * Refresh market prices and update outcomes
 */
export async function refreshMarketPrices(
  markets: PolymarketSportsMarket[]
): Promise<PolymarketSportsMarket[]> {
  // Collect all token IDs
  const tokenIds: string[] = [];
  for (const market of markets) {
    for (const outcome of market.market.outcomes) {
      if (outcome.tokenId) {
        tokenIds.push(outcome.tokenId);
      }
    }
  }

  if (tokenIds.length === 0) {
    return markets;
  }

  try {
    // Fetch all prices in batch
    const prices = await getTokenPrices(tokenIds);

    // Only update if we got some prices (avoid unnecessary re-renders)
    if (prices.size === 0) {
      // No prices fetched, return original markets to avoid triggering updates
      return markets;
    }

    // Update markets with new prices
    return markets.map(market => ({
      ...market,
      market: {
        ...market.market,
        outcomes: market.market.outcomes.map(outcome => ({
          ...outcome,
          price: prices.get(outcome.tokenId) ?? outcome.price,
        })),
      },
      lastUpdated: new Date(),
    }));
  } catch {
    // Silently fail and return original markets to prevent error cascades
    return markets;
  }
}

/**
 * Fetch and enrich market with orderbook data
 */
export async function enrichMarketWithOrderbook(
  market: PolymarketSportsMarket
): Promise<PolymarketSportsMarket> {
  const tokenIds = market.market.outcomes
    .map(o => o.tokenId)
    .filter(id => id);

  if (tokenIds.length === 0) {
    return market;
  }

  const orderbooks = await getOrderbooks(tokenIds);
  
  const enrichedOutcomes: ParsedOutcome[] = market.market.outcomes.map(outcome => {
    const orderbook = orderbooks.get(outcome.tokenId);
    if (!orderbook) {
      return outcome;
    }

    const { bestBid, bestAsk, spread } = getBestBidAsk(orderbook);
    
    return {
      ...outcome,
      bestBid: bestBid ?? undefined,
      bestAsk: bestAsk ?? undefined,
      spread: spread ?? undefined,
    };
  });

  // Calculate market-level best bid/ask (from first outcome, typically "Yes")
  const primaryOutcome = enrichedOutcomes[0];

  return {
    ...market,
    market: {
      ...market.market,
      outcomes: enrichedOutcomes,
      bestBid: primaryOutcome?.bestBid,
      bestAsk: primaryOutcome?.bestAsk,
      spread: primaryOutcome?.spread,
    },
    lastUpdated: new Date(),
  };
}

/**
 * Fetch orderbooks for all outcomes in a market
 */
export async function getMarketOrderbooks(
  market: PolymarketSportsMarket
): Promise<Map<string, PolymarketOrderbook>> {
  const tokenIds = market.market.outcomes
    .map(o => o.tokenId)
    .filter(id => id);

  return getOrderbooks(tokenIds);
}

/**
 * Clear the price cache
 */
export function clearPriceCache(): void {
  priceCache = null;
}
