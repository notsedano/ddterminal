/**
 * Polymarket Gamma API Service
 * Market discovery, metadata, events, and sports-specific endpoints
 */

import type {
  PolymarketEvent,
  PolymarketSportsMarket,
  PolymarketSportsMetadata,
  PolymarketTag,
  SportsMarketType,
} from '@/types';
import { transformToSportsMarket, transformAllMarketsFromEvent } from '@/types';
import { TEAM_ALIASES, NBA_KEYWORDS } from '@/data';

// API Configuration
// Always use proxy/serverless function to avoid CORS issues
// Development: Vite proxy, Production: Vercel serverless functions
const GAMMA_API = '/api/polymarket/gamma';

// Cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: {
  tags: CacheEntry<PolymarketTag[]> | null;
  sportsMetadata: CacheEntry<PolymarketSportsMetadata[]> | null;
  sportsMarketTypes: CacheEntry<string[]> | null;
  nbaEvents: CacheEntry<PolymarketEvent[]> | null;
} = {
  tags: null,
  sportsMetadata: null,
  sportsMarketTypes: null,
  nbaEvents: null,
};

const CACHE_TTL = {
  tags: 24 * 60 * 60 * 1000, // 24 hours
  sportsMetadata: 24 * 60 * 60 * 1000, // 24 hours
  sportsMarketTypes: 24 * 60 * 60 * 1000, // 24 hours
  nbaEvents: 2 * 60 * 1000, // 2 minutes
};

/**
 * Helper to check if cache is valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | null, ttl: number): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.timestamp < ttl;
}

/**
 * Fetch all available tags
 */
export async function getTags(): Promise<PolymarketTag[]> {
  if (isCacheValid(cache.tags, CACHE_TTL.tags)) {
    return cache.tags.data;
  }

  const response = await fetch(`${GAMMA_API}/tags?limit=500`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  cache.tags = { data, timestamp: Date.now() };
  return data;
}

/**
 * Get sports metadata
 */
export async function getSportsMetadata(): Promise<PolymarketSportsMetadata[]> {
  if (isCacheValid(cache.sportsMetadata, CACHE_TTL.sportsMetadata)) {
    return cache.sportsMetadata.data;
  }

  const response = await fetch(`${GAMMA_API}/sports`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sports metadata: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  cache.sportsMetadata = { data, timestamp: Date.now() };
  return data;
}

/**
 * Get valid sports market types
 */
export async function getSportsMarketTypes(): Promise<string[]> {
  if (isCacheValid(cache.sportsMarketTypes, CACHE_TTL.sportsMarketTypes)) {
    return cache.sportsMarketTypes.data;
  }

  const response = await fetch(`${GAMMA_API}/sports/market-types`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sports market types: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const marketTypes = data.marketTypes || data;
  cache.sportsMarketTypes = { data: marketTypes, timestamp: Date.now() };
  return marketTypes;
}

/**
 * Find NBA-related tag IDs from all tags
 */
export async function findNBATagIds(): Promise<string[]> {
  const tags = await getTags();
  
  const nbaRelatedSlugs = ['nba', 'basketball', 'sports'];
  const nbaRelatedLabels = ['nba', 'basketball', 'sports'];

  const matchingTags = tags.filter(tag => {
    const slugLower = tag.slug.toLowerCase();
    const labelLower = tag.label.toLowerCase();
    
    return nbaRelatedSlugs.some(s => slugLower.includes(s)) ||
           nbaRelatedLabels.some(l => labelLower.includes(l));
  });

  return matchingTags.map(t => t.id);
}

/**
 * Search for events by query
 */
export async function searchEvents(query: string, options: {
  active?: boolean;
  closed?: boolean;
  limit?: number;
} = {}): Promise<PolymarketEvent[]> {
  const { active = true, closed = false, limit = 50 } = options;
  
  const params = new URLSearchParams({
    active: String(active),
    closed: String(closed),
    limit: String(limit),
    _q: query,
  });

  const response = await fetch(`${GAMMA_API}/events?${params}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get events with filtering options
 */
export async function getEvents(options: {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  tagId?: string;
  slug?: string;
  order?: 'volume' | 'liquidity' | 'startDate' | 'endDate' | 'createdAt';
  ascending?: boolean;
} = {}): Promise<PolymarketEvent[]> {
  const params = new URLSearchParams();
  
  if (options.active !== undefined) params.append('active', String(options.active));
  if (options.closed !== undefined) params.append('closed', String(options.closed));
  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.offset !== undefined) params.append('offset', String(options.offset));
  if (options.tagId) params.append('tag_id', options.tagId);
  if (options.slug) params.append('slug', options.slug);
  if (options.order) params.append('order', options.order);
  if (options.ascending !== undefined) params.append('ascending', String(options.ascending));

  const response = await fetch(`${GAMMA_API}/events?${params}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a single event by ID
 */
export async function getEventById(eventId: string): Promise<PolymarketEvent> {
  const response = await fetch(`${GAMMA_API}/events/${eventId}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch event ${eventId}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a single event by slug
 */
export async function getEventBySlug(slug: string): Promise<PolymarketEvent> {
  const response = await fetch(`${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch event ${slug}: ${response.status} ${response.statusText}`);
  }

  const events = await response.json();
  if (!events || events.length === 0) {
    throw new Error(`Event not found: ${slug}`);
  }

  return events[0];
}

/**
 * Get markets with filtering options
 */
export async function getMarkets(options: {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  sportsMarketType?: SportsMarketType;
  gameId?: string;
} = {}): Promise<PolymarketEvent[]> {
  const params = new URLSearchParams();
  
  if (options.active !== undefined) params.append('active', String(options.active));
  if (options.closed !== undefined) params.append('closed', String(options.closed));
  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.offset !== undefined) params.append('offset', String(options.offset));
  if (options.sportsMarketType) params.append('sportsMarketTypes', options.sportsMarketType);
  if (options.gameId) params.append('gameId', options.gameId);

  const response = await fetch(`${GAMMA_API}/markets?${params}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// NBA_KEYWORDS imported from @/data for optimal tree-shaking

/**
 * Check if an event is NBA-related based on title and tags
 */
function isNBAEvent(event: PolymarketEvent): boolean {
  const title = event.title.toLowerCase();
  
  // Check for NBA keywords in title
  const hasNBAKeyword = NBA_KEYWORDS.some(keyword => title.includes(keyword));
  
  // Check tags
  const hasSportsTag = event.tags?.some(tag => {
    const slug = tag.slug.toLowerCase();
    const label = tag.label.toLowerCase();
    return slug.includes('nba') || slug.includes('basketball') || 
           slug.includes('sports') || label.includes('nba');
  });

  // Also check for typical game patterns like "vs" or "at"
  const hasMatchPattern = (title.includes(' vs ') || title.includes(' vs. ') || 
                          title.includes(' at ') || title.includes('@'));

  return hasNBAKeyword || (hasSportsTag && hasMatchPattern);
}

/**
 * Fetch events by tag slug
 */
export async function getEventsByTagSlug(tagSlug: string, options: {
  active?: boolean;
  closed?: boolean;
  limit?: number;
} = {}): Promise<PolymarketEvent[]> {
  const { active = true, closed = false, limit = 50 } = options;
  
  const params = new URLSearchParams({
    active: String(active),
    closed: String(closed),
    limit: String(limit),
    tag_slug: tagSlug,
  });

  const response = await fetch(`${GAMMA_API}/events?${params}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events for tag ${tagSlug}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch NBA-related events from Polymarket
 * Uses tag_slug for proper filtering - focuses on NBA Championship/Finals markets
 * 
 * @param includeCompleted - If true, also fetches recently completed/closed events
 */
export async function getNBAEvents(includeCompleted: boolean = false): Promise<PolymarketEvent[]> {
  // Check cache first (only for default active-only requests)
  if (!includeCompleted && isCacheValid(cache.nbaEvents, CACHE_TTL.nbaEvents)) {
    return cache.nbaEvents.data;
  }

  const allEvents = new Map<string, PolymarketEvent>();

  // Strategy 1: Use tag_slug for NBA-related tags - ACTIVE events
  const tagSlugs = ['nba-finals', 'sports'];
  const tagPromises = tagSlugs.map(slug => 
    getEventsByTagSlug(slug, { active: true, closed: false, limit: 50 })
      .catch(() => [] as PolymarketEvent[])
  );

  const tagResults = await Promise.all(tagPromises);
  
  for (const events of tagResults) {
    for (const event of events) {
      if (isNBAEvent(event) && !allEvents.has(event.id)) {
        allEvents.set(event.id, event);
      }
    }
  }

  // Strategy 2: Fetch high volume ACTIVE events and filter for NBA
  const activeEventsResponse = await getEvents({
    active: true,
    closed: false,
    limit: 200,
    order: 'volume',
    ascending: false,
  }).catch(() => [] as PolymarketEvent[]);

  for (const event of activeEventsResponse) {
    if (isNBAEvent(event) && !allEvents.has(event.id)) {
      allEvents.set(event.id, event);
    }
  }

  // Strategy 3: Fetch recently CLOSED events if requested
  // This preserves historical data for completed games
  if (includeCompleted) {
    const closedEventsResponse = await getEvents({
      active: false,
      closed: true,
      limit: 100,
      order: 'volume',
      ascending: false,
    }).catch(() => [] as PolymarketEvent[]);

    for (const event of closedEventsResponse) {
      if (isNBAEvent(event) && !allEvents.has(event.id)) {
        allEvents.set(event.id, event);
      }
    }
  }

  const events = Array.from(allEvents.values());
  
  // Only cache if this is the default active-only request
  if (!includeCompleted) {
    cache.nbaEvents = { data: events, timestamp: Date.now() };
  }
  
  return events;
}

/**
 * Transform NBA events to sports market format for display
 */
export async function getNBASportsMarkets(): Promise<PolymarketSportsMarket[]> {
  const events = await getNBAEvents();
  
  const markets: PolymarketSportsMarket[] = [];
  
  for (const event of events) {
    const market = transformToSportsMarket(event);
    if (market) {
      markets.push(market);
    }
  }

  // Sort by volume descending
  markets.sort((a, b) => b.market.volume - a.market.volume);

  return markets;
}

/**
 * Get all market types for NBA events
 * Returns all MONEYLINE, SPREAD, TOTAL, and PROP markets
 */
export async function getAllNBAMarkets(): Promise<PolymarketSportsMarket[]> {
  const events = await getNBAEvents();
  
  const allMarkets: PolymarketSportsMarket[] = [];
  
  for (const event of events) {
    const markets = transformAllMarketsFromEvent(event);
    allMarkets.push(...markets);
  }

  // Sort by volume descending
  allMarkets.sort((a, b) => b.market.volume - a.market.volume);

  return allMarkets;
}

/**
 * Find Polymarket market that matches a specific NBA game
 */
export async function findMarketForGame(
  homeTeam: { name: string; market: string; alias: string },
  awayTeam: { name: string; market: string; alias: string }
): Promise<PolymarketSportsMarket | null> {
  const events = await getNBAEvents();

  for (const event of events) {
    if (matchesGame(event, homeTeam, awayTeam)) {
      const market = transformToSportsMarket(event);
      if (market) {
        return market;
      }
    }
  }

  return null;
}

/**
 * Find all Polymarket markets for a specific NBA game
 */
export async function findAllMarketsForGame(
  homeTeam: { name: string; market: string; alias: string },
  awayTeam: { name: string; market: string; alias: string }
): Promise<PolymarketSportsMarket[]> {
  const events = await getNBAEvents();
  const markets: PolymarketSportsMarket[] = [];

  for (const event of events) {
    if (matchesGame(event, homeTeam, awayTeam)) {
      const eventMarkets = transformAllMarketsFromEvent(event);
      markets.push(...eventMarkets);
    }
  }

  return markets;
}

/**
 * Check if a Polymarket event matches a specific game
 */
function matchesGame(
  event: PolymarketEvent,
  homeTeam: { name: string; market: string; alias: string },
  awayTeam: { name: string; market: string; alias: string }
): boolean {
  // Safety check for required fields
  if (!event.title || !homeTeam?.name || !awayTeam?.name) {
    return false;
  }

  const title = event.title.toLowerCase();

  // Build team identifiers with null safety
  const homeIds = [
    homeTeam.name?.toLowerCase(),
    homeTeam.market?.toLowerCase(),
    homeTeam.alias?.toLowerCase(),
    homeTeam.market && homeTeam.name ? `${homeTeam.market} ${homeTeam.name}`.toLowerCase() : null,
  ].filter((id): id is string => Boolean(id));

  const awayIds = [
    awayTeam.name?.toLowerCase(),
    awayTeam.market?.toLowerCase(),
    awayTeam.alias?.toLowerCase(),
    awayTeam.market && awayTeam.name ? `${awayTeam.market} ${awayTeam.name}`.toLowerCase() : null,
  ].filter((id): id is string => Boolean(id));

  const hasHome = homeIds.some(id => title.includes(id));
  const hasAway = awayIds.some(id => title.includes(id));

  return hasHome && hasAway;
}

export interface TeamChampionshipOdds {
  odds: number;
  volume: string;
  marketId: string;
}

export interface ChampionshipOddsMap {
  [teamName: string]: TeamChampionshipOdds;
}

/**
 * Get NBA Championship odds for all teams
 * Returns a plain object of team name -> championship odds (0-1)
 */
export async function getNBAChampionshipOdds(): Promise<ChampionshipOddsMap> {
  const events = await getNBAEvents();
  
  const teamOdds: ChampionshipOddsMap = {};
  
  // Find the NBA Champion event
  const championEvent = events.find(e => 
    e.title.toLowerCase().includes('nba champion') ||
    e.title.toLowerCase().includes('nba finals')
  );
  
  if (!championEvent || !championEvent.markets) {
    return teamOdds;
  }

  // Parse each market to extract team name and odds
  for (const market of championEvent.markets) {
    const question = market.question.toLowerCase();
    
    // Match patterns like "Will the Oklahoma City Thunder win the 2026 NBA Finals?"
    const teamMatch = question.match(/will (?:the )?(.+?) win/);
    if (!teamMatch) continue;
    
    const teamName = teamMatch[1].trim();
    
    // Parse outcome prices - first element is "Yes" probability
    let yesOdds = 0;
    if (market.outcomePrices && typeof market.outcomePrices === 'string') {
      try {
        const prices = JSON.parse(market.outcomePrices);
        yesOdds = parseFloat(prices[0]) || 0;
      } catch {
        // Invalid JSON, skip this market
        continue;
      }
    }
    
    teamOdds[teamName] = {
      odds: yesOdds,
      volume: market.volume || '0',
      marketId: market.id,
    };
  }

  return teamOdds;
}

/**
 * Find championship odds for teams playing in a specific game
 */
export async function getChampionshipOddsForGame(
  homeTeam: { name: string; market: string; alias: string },
  awayTeam: { name: string; market: string; alias: string }
): Promise<{
  home: { odds: number; volume: string; marketId: string } | null;
  away: { odds: number; volume: string; marketId: string } | null;
}> {
  // Safety check for required fields
  if (!homeTeam?.name || !awayTeam?.name) {
    return { home: null, away: null };
  }

  const allOdds = await getNBAChampionshipOdds();
  
  // Find home team odds with null safety
  const homeFullName = homeTeam.market && homeTeam.name 
    ? `${homeTeam.market} ${homeTeam.name}`.toLowerCase() 
    : homeTeam.name?.toLowerCase() || '';
  const awayFullName = awayTeam.market && awayTeam.name 
    ? `${awayTeam.market} ${awayTeam.name}`.toLowerCase() 
    : awayTeam.name?.toLowerCase() || '';
  
  let homeOdds: { odds: number; volume: string; marketId: string } | null = null;
  let awayOdds: { odds: number; volume: string; marketId: string } | null = null;
  
  const homeNameLower = homeTeam.name?.toLowerCase() || '';
  const homeMarketLower = homeTeam.market?.toLowerCase() || '';
  const awayNameLower = awayTeam.name?.toLowerCase() || '';
  const awayMarketLower = awayTeam.market?.toLowerCase() || '';
  
  for (const [teamName, odds] of Object.entries(allOdds)) {
    const teamNameLower = teamName.toLowerCase();
    
    // Check home team
    if ((homeNameLower && teamNameLower.includes(homeNameLower)) ||
        (homeMarketLower && teamNameLower.includes(homeMarketLower)) ||
        (homeFullName && homeFullName.includes(teamNameLower))) {
      homeOdds = odds;
    }
    
    // Check away team
    if ((awayNameLower && teamNameLower.includes(awayNameLower)) ||
        (awayMarketLower && teamNameLower.includes(awayMarketLower)) ||
        (awayFullName && awayFullName.includes(teamNameLower))) {
      awayOdds = odds;
    }
  }

  return { home: homeOdds, away: awayOdds };
}

/**
 * Invalidate caches (useful for manual refresh)
 */
export function invalidateCache(cacheKey?: keyof typeof cache): void {
  if (cacheKey) {
    cache[cacheKey] = null;
  } else {
    cache.tags = null;
    cache.sportsMetadata = null;
    cache.sportsMarketTypes = null;
    cache.nbaEvents = null;
  }
}

// ============================================================================
// PER-GAME MARKET DATA
// Fetches actual game markets (moneyline, spread, totals) for specific matches
// ============================================================================

/**
 * Parsed market data for a single betting market
 */
export interface ParsedGameMarket {
  type: 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'PROP';
  question: string;
  outcomes: Array<{
    name: string;
    price: number;  // 0-1 probability
    tokenId: string;
  }>;
  volume: number;
  bestBid: number | null;
  bestAsk: number | null;
  line?: number;  // For spread/total
  marketId: string;
}

/**
 * Complete market data for a specific game
 */
export interface GameMarketData {
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  totalVolume: number;
  moneyline: ParsedGameMarket | null;
  spreads: ParsedGameMarket[];
  totals: ParsedGameMarket[];
  props: ParsedGameMarket[];
  lastUpdated: Date;
}

// TEAM_ALIASES imported from @/data for optimal tree-shaking

/**
 * Get all NBA game events (events with team matchups)
 */
async function getNBAGameEvents(): Promise<PolymarketEvent[]> {
  const allEvents = await getNBAEvents();
  
  // Filter to only game events (contain "vs" in title)
  return allEvents.filter(event => {
    const title = event.title.toLowerCase();
    return title.includes(' vs ') || title.includes(' vs. ');
  });
}

/**
 * Parse a market's outcomes from JSON strings
 */
function parseMarketData(market: { 
  id: string;
  question: string; 
  outcomes?: string | string[];
  outcomePrices?: string | (string | number)[];
  clobTokenIds?: string | string[];
  volume?: string;
  bestBid?: number;
  bestAsk?: number;
}): { outcomes: Array<{ name: string; price: number; tokenId: string }> } | null {
  let outcomeNames: string[] = [];
  let prices: number[] = [];
  let tokenIds: string[] = [];

  // Parse outcomes
  if (market.outcomes) {
    if (typeof market.outcomes === 'string') {
      outcomeNames = JSON.parse(market.outcomes);
    } else if (Array.isArray(market.outcomes)) {
      outcomeNames = market.outcomes;
    }
  }

  // Parse prices
  if (market.outcomePrices) {
    if (typeof market.outcomePrices === 'string') {
      const parsed = JSON.parse(market.outcomePrices);
      prices = parsed.map((p: string | number) => parseFloat(String(p)) || 0);
    } else if (Array.isArray(market.outcomePrices)) {
      prices = market.outcomePrices.map(p => parseFloat(String(p)) || 0);
    }
  }

  // Parse token IDs
  if (market.clobTokenIds) {
    if (typeof market.clobTokenIds === 'string') {
      tokenIds = JSON.parse(market.clobTokenIds);
    } else if (Array.isArray(market.clobTokenIds)) {
      tokenIds = market.clobTokenIds;
    }
  }

  if (outcomeNames.length === 0) {
    return null;
  }

  return {
    outcomes: outcomeNames.map((name, i) => ({
      name,
      price: prices[i] || 0,
      tokenId: tokenIds[i] || '',
    })),
  };
}

/**
 * Determine market type from question text
 */
function determineMarketType(question: string): 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'PROP' {
  const q = question.toLowerCase();
  
  if (q.includes('spread:') || q.includes('spread ')) {
    return 'SPREAD';
  }
  if (q.includes('o/u ') || q.includes('over/under')) {
    return 'TOTAL';
  }
  if (q.includes(' vs ') || q.includes(' vs. ')) {
    // Check if it's just the game moneyline (no other qualifiers)
    if (!q.includes(':') && !q.includes('1h ') && !q.includes('first half')) {
      return 'MONEYLINE';
    }
  }
  
  return 'PROP';
}

/**
 * Extract line number from market question (for spread/total)
 */
function extractLine(question: string): number | undefined {
  // Match patterns like "(-6.5)", "O/U 238.5", etc.
  const spreadMatch = question.match(/\(([+-]?\d+\.?\d*)\)/);
  if (spreadMatch) {
    return parseFloat(spreadMatch[1]);
  }
  
  const ouMatch = question.match(/o\/u\s+(\d+\.?\d*)/i);
  if (ouMatch) {
    return parseFloat(ouMatch[1]);
  }
  
  return undefined;
}

/**
 * Parse all markets from a game event into structured data
 */
function parseGameMarkets(event: PolymarketEvent): GameMarketData {
  const result: GameMarketData = {
    eventId: event.id,
    eventTitle: event.title,
    eventSlug: event.slug,
    totalVolume: parseFloat(String(event.volume)) || 0,
    moneyline: null,
    spreads: [],
    totals: [],
    props: [],
    lastUpdated: new Date(),
  };

  if (!event.markets) {
    return result;
  }

  for (const market of event.markets) {
    const parsed = parseMarketData(market);
    if (!parsed) continue;

    const marketType = determineMarketType(market.question);
    const line = extractLine(market.question);

    const gameMarket: ParsedGameMarket = {
      type: marketType,
      question: market.question,
      outcomes: parsed.outcomes,
      volume: parseFloat(market.volume || '0'),
      bestBid: market.bestBid ?? null,
      bestAsk: market.bestAsk ?? null,
      line,
      marketId: market.id,
    };

    switch (marketType) {
      case 'MONEYLINE':
        // Only set if no moneyline yet, or this one has higher volume
        if (!result.moneyline || gameMarket.volume > result.moneyline.volume) {
          result.moneyline = gameMarket;
        }
        break;
      case 'SPREAD':
        result.spreads.push(gameMarket);
        break;
      case 'TOTAL':
        result.totals.push(gameMarket);
        break;
      case 'PROP':
        result.props.push(gameMarket);
        break;
    }
  }

  // Sort spreads and totals by volume (highest first)
  result.spreads.sort((a, b) => b.volume - a.volume);
  result.totals.sort((a, b) => b.volume - a.volume);
  result.props.sort((a, b) => b.volume - a.volume);

  return result;
}

/**
 * Check if a team name matches a Polymarket event title
 */
function teamMatchesEvent(teamName: string, eventTitle: string): boolean {
  const titleLower = eventTitle.toLowerCase();
  const teamLower = teamName.toLowerCase();
  
  // Direct match
  if (titleLower.includes(teamLower)) {
    return true;
  }
  
  // Check aliases
  for (const [polymarketName, aliases] of Object.entries(TEAM_ALIASES)) {
    if (titleLower.includes(polymarketName)) {
      // Check if any alias matches our team
      if (aliases.some(alias => {
        const aliasLower = alias.toLowerCase();
        return teamLower.includes(aliasLower) || aliasLower.includes(teamLower);
      })) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Find the Polymarket game event that matches a Sportradar game
 */
export async function findGameEvent(
  homeTeam: { name: string; market?: string; alias: string },
  awayTeam: { name: string; market?: string; alias: string }
): Promise<PolymarketEvent | null> {
  // Safety check for required fields
  if (!homeTeam?.name || !awayTeam?.name) {
    return null;
  }

  const gameEvents = await getNBAGameEvents();
  
  // Build search terms for each team with null safety
  const homeTerms = [
    homeTeam.name?.toLowerCase(),
    homeTeam.alias?.toLowerCase(),
    homeTeam.market?.toLowerCase(),
  ].filter((term): term is string => Boolean(term));
  
  const awayTerms = [
    awayTeam.name?.toLowerCase(),
    awayTeam.alias?.toLowerCase(),
    awayTeam.market?.toLowerCase(),
  ].filter((term): term is string => Boolean(term));
  
  for (const event of gameEvents) {
    if (!event.title) continue;
    
    const title = event.title.toLowerCase();
    
    // Check if both teams are in the title
    const hasHome = homeTerms.some(term => title.includes(term)) || 
                    teamMatchesEvent(homeTeam.name, event.title);
    const hasAway = awayTerms.some(term => title.includes(term)) || 
                    teamMatchesEvent(awayTeam.name, event.title);
    
    if (hasHome && hasAway) {
      return event;
    }
  }
  
  return null;
}

/**
 * Build the Polymarket slug for an NBA game
 * Format: nba-{away_alias_lowercase}-{home_alias_lowercase}-{YYYY-MM-DD}
 * 
 * IMPORTANT: Polymarket uses Eastern Time (ET) for game dates, not UTC.
 * A game at 7pm ET on Jan 27 should use 2026-01-27, not 2026-01-28 (UTC).
 */
function buildGameSlug(
  homeTeam: { alias: string },
  awayTeam: { alias: string },
  gameDate: Date
): string {
  const awayAlias = awayTeam.alias.toLowerCase();
  const homeAlias = homeTeam.alias.toLowerCase();
  
  // Convert to Eastern Time to get the correct date
  // Polymarket uses ET for their game slugs
  const etDateStr = gameDate.toLocaleDateString('en-CA', { 
    timeZone: 'America/New_York' 
  }); // Returns YYYY-MM-DD format
  
  return `nba-${awayAlias}-${homeAlias}-${etDateStr}`;
}

// Cache for failed slugs to prevent repeated 404s
// Reduced to 1 minute so markets are found faster when they become available
const failedSlugCache = new Set<string>();
const FAILED_SLUG_CACHE_TTL = 1 * 60 * 1000; // 1 minute (reduced from 5 min)
const failedSlugTimestamps = new Map<string, number>();

/**
 * Fetch game event data by slug using the Polymarket events API
 * Game slugs like "nba-por-was-2026-01-27" are EVENT slugs, not market slugs.
 * This is the most reliable way to get per-game markets.
 */
async function fetchGameEventBySlug(slug: string): Promise<PolymarketEvent | null> {
  // Check if this slug recently failed (404)
  const cacheKey = `game:${slug}`;
  const failedTimestamp = failedSlugTimestamps.get(cacheKey);
  if (failedSlugCache.has(cacheKey) && failedTimestamp) {
    // If it failed recently (within TTL), skip the request
    if (Date.now() - failedTimestamp < FAILED_SLUG_CACHE_TTL) {
      return null;
    }
    // Cache expired, remove it
    failedSlugCache.delete(cacheKey);
    failedSlugTimestamps.delete(cacheKey);
  }

  try {
    // Use the events endpoint with slug query parameter
    // This is how Polymarket structures their game URLs: /event/nba-xxx-xxx-date
    const response = await fetch(`${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      // Cache 404s to prevent repeated failed requests
      if (response.status === 404) {
        failedSlugCache.add(cacheKey);
        failedSlugTimestamps.set(cacheKey, Date.now());
      }
      return null;
    }
    
    const events = await response.json();
    const event = events?.[0] || null;
    
    if (!event) {
      // No event found, cache this as a failure
      failedSlugCache.add(cacheKey);
      failedSlugTimestamps.set(cacheKey, Date.now());
      return null;
    }
    
    // Success - remove from failed cache if it was there
    failedSlugCache.delete(cacheKey);
    failedSlugTimestamps.delete(cacheKey);
    
    return event;
  } catch (error) {
    // Network errors - don't cache, just return null
    return null;
  }
}

/**
 * Get complete market data for a specific game using the slug-based API
 * Returns moneyline, spread, and total markets with proper odds percentages
 * 
 * Uses Polymarket's event slug format: nba-{away}-{home}-{YYYY-MM-DD}
 * Example: nba-por-was-2026-01-27 for Trail Blazers @ Wizards on Jan 27, 2026
 */
export async function getGameMarketData(
  homeTeam: { name: string; market?: string; alias: string },
  awayTeam: { name: string; market?: string; alias: string },
  gameDate?: Date
): Promise<GameMarketData | null> {
  // Use provided date or default to today
  const date = gameDate || new Date();
  
  // Build the game event slug (format: nba-{away}-{home}-{date})
  const slug = buildGameSlug(homeTeam, awayTeam, date);
  
  // Try to fetch the game event by slug (primary method)
  // This uses the events endpoint: /events?slug=nba-por-was-2026-01-27
  let event = await fetchGameEventBySlug(slug);
  
  if (!event) {
    // Fallback to title-based search through all NBA events
    event = await findGameEvent(homeTeam, awayTeam);
    if (!event) {
      return null;
    }
  }
  
  // Parse all markets from the event
  return parseGameMarkets(event);
}

/**
 * Get all available NBA game markets
 * Returns parsed market data for all active games
 */
export async function getAllGameMarkets(): Promise<GameMarketData[]> {
  const gameEvents = await getNBAGameEvents();
  return gameEvents.map(parseGameMarkets);
}
