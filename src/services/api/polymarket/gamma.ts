/**
 * Polymarket Gamma API Service
 * Market discovery, metadata, events, and sports-specific endpoints
 */

import type {
  PolymarketEvent,
  PolymarketMarket,
  PolymarketSportsMarket,
  PolymarketSportsMetadata,
  PolymarketTag,
  SportsMarketType,
} from '@/types';
import { transformToSportsMarket, transformAllMarketsFromEvent } from '@/types';

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

// NBA Team names and keywords for matching
const NBA_KEYWORDS = [
  // Team names (mascots)
  'lakers', 'celtics', 'warriors', 'bulls', 'heat', 'knicks', 'nets',
  'bucks', 'suns', 'mavericks', 'mavs', 'nuggets', 'clippers', 'sixers', '76ers',
  'raptors', 'spurs', 'hawks', 'timberwolves', 'wolves', 'grizzlies', 'pelicans',
  'pels', 'thunder', 'trail blazers', 'blazers', 'jazz', 'kings', 'pistons',
  'pacers', 'hornets', 'magic', 'wizards', 'cavaliers', 'cavs', 'rockets',
  // Cities
  'los angeles', 'boston', 'golden state', 'chicago', 'miami', 'new york',
  'brooklyn', 'milwaukee', 'phoenix', 'dallas', 'denver', 'philadelphia',
  'toronto', 'san antonio', 'atlanta', 'minnesota', 'memphis', 'new orleans',
  'oklahoma city', 'portland', 'utah', 'sacramento', 'detroit', 'indiana',
  'charlotte', 'orlando', 'washington', 'cleveland', 'houston',
  // Keywords
  'nba',
];

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
 */
export async function getNBAEvents(): Promise<PolymarketEvent[]> {
  // Check cache first
  if (isCacheValid(cache.nbaEvents, CACHE_TTL.nbaEvents)) {
    return cache.nbaEvents.data;
  }

  const allEvents = new Map<string, PolymarketEvent>();

  // Strategy 1: Use tag_slug for NBA-related tags
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

  // Strategy 2: Fetch high volume events and filter for NBA
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

  const events = Array.from(allEvents.values());
  cache.nbaEvents = { data: events, timestamp: Date.now() };
  
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
  const title = event.title.toLowerCase();

  // Build team identifiers
  const homeIds = [
    homeTeam.name.toLowerCase(),
    homeTeam.market.toLowerCase(),
    homeTeam.alias.toLowerCase(),
    `${homeTeam.market} ${homeTeam.name}`.toLowerCase(),
  ];

  const awayIds = [
    awayTeam.name.toLowerCase(),
    awayTeam.market.toLowerCase(),
    awayTeam.alias.toLowerCase(),
    `${awayTeam.market} ${awayTeam.name}`.toLowerCase(),
  ];

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
  const allOdds = await getNBAChampionshipOdds();
  
  // Find home team odds
  const homeFullName = `${homeTeam.market} ${homeTeam.name}`.toLowerCase();
  const awayFullName = `${awayTeam.market} ${awayTeam.name}`.toLowerCase();
  
  let homeOdds: { odds: number; volume: string; marketId: string } | null = null;
  let awayOdds: { odds: number; volume: string; marketId: string } | null = null;
  
  for (const [teamName, odds] of Object.entries(allOdds)) {
    const teamNameLower = teamName.toLowerCase();
    
    // Check home team
    if (teamNameLower.includes(homeTeam.name.toLowerCase()) ||
        teamNameLower.includes(homeTeam.market.toLowerCase()) ||
        homeFullName.includes(teamNameLower)) {
      homeOdds = odds;
    }
    
    // Check away team
    if (teamNameLower.includes(awayTeam.name.toLowerCase()) ||
        teamNameLower.includes(awayTeam.market.toLowerCase()) ||
        awayFullName.includes(teamNameLower)) {
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

/**
 * Team abbreviation mappings for matching Sportradar to Polymarket
 */
const TEAM_ALIASES: Record<string, string[]> = {
  // Format: Polymarket name variants -> common identifiers
  'lakers': ['lal', 'los angeles lakers', 'la lakers'],
  'celtics': ['bos', 'boston celtics'],
  'warriors': ['gsw', 'golden state warriors', 'gs warriors'],
  'bulls': ['chi', 'chicago bulls'],
  'heat': ['mia', 'miami heat'],
  'knicks': ['nyk', 'new york knicks', 'ny knicks'],
  'nets': ['bkn', 'brooklyn nets'],
  'bucks': ['mil', 'milwaukee bucks'],
  'suns': ['phx', 'phoenix suns'],
  'mavericks': ['dal', 'dallas mavericks', 'mavs'],
  'nuggets': ['den', 'denver nuggets'],
  'clippers': ['lac', 'la clippers', 'los angeles clippers'],
  'sixers': ['phi', 'philadelphia 76ers', '76ers'],
  'raptors': ['tor', 'toronto raptors'],
  'spurs': ['sas', 'san antonio spurs'],
  'hawks': ['atl', 'atlanta hawks'],
  'timberwolves': ['min', 'minnesota timberwolves', 'wolves'],
  'grizzlies': ['mem', 'memphis grizzlies'],
  'pelicans': ['nop', 'new orleans pelicans', 'pels'],
  'thunder': ['okc', 'oklahoma city thunder'],
  'trail blazers': ['por', 'portland trail blazers', 'blazers'],
  'jazz': ['uta', 'utah jazz'],
  'kings': ['sac', 'sacramento kings'],
  'pistons': ['det', 'detroit pistons'],
  'pacers': ['ind', 'indiana pacers'],
  'hornets': ['cha', 'charlotte hornets'],
  'magic': ['orl', 'orlando magic'],
  'wizards': ['was', 'washington wizards'],
  'cavaliers': ['cle', 'cleveland cavaliers', 'cavs'],
  'rockets': ['hou', 'houston rockets'],
};

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
  const gameEvents = await getNBAGameEvents();
  
  // Build search terms for each team
  const homeTerms = [
    homeTeam.name.toLowerCase(),
    homeTeam.alias.toLowerCase(),
    homeTeam.market?.toLowerCase() || '',
  ].filter(Boolean);
  
  const awayTerms = [
    awayTeam.name.toLowerCase(),
    awayTeam.alias.toLowerCase(),
    awayTeam.market?.toLowerCase() || '',
  ].filter(Boolean);
  
  for (const event of gameEvents) {
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
 */
function buildGameSlug(
  homeTeam: { alias: string },
  awayTeam: { alias: string },
  gameDate: Date
): string {
  const awayAlias = awayTeam.alias.toLowerCase();
  const homeAlias = homeTeam.alias.toLowerCase();
  const dateStr = gameDate.toISOString().split('T')[0]; // YYYY-MM-DD
  return `nba-${awayAlias}-${homeAlias}-${dateStr}`;
}

// Cache for failed slugs to prevent repeated 404s
const failedSlugCache = new Set<string>();
const FAILED_SLUG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const failedSlugTimestamps = new Map<string, number>();

/**
 * Fetch market data by slug using the Polymarket slug API
 * This is the most reliable way to get per-game markets
 */
async function fetchMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
  // Check if this slug recently failed (404)
  const failedTimestamp = failedSlugTimestamps.get(slug);
  if (failedSlugCache.has(slug) && failedTimestamp) {
    // If it failed recently (within TTL), skip the request
    if (Date.now() - failedTimestamp < FAILED_SLUG_CACHE_TTL) {
      return null;
    }
    // Cache expired, remove it
    failedSlugCache.delete(slug);
    failedSlugTimestamps.delete(slug);
  }

  try {
    const response = await fetch(`${GAMMA_API}/markets/slug/${slug}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      // Cache 404s to prevent repeated failed requests
      if (response.status === 404) {
        failedSlugCache.add(slug);
        failedSlugTimestamps.set(slug, Date.now());
      }
      return null;
    }
    
    // Success - remove from failed cache if it was there
    failedSlugCache.delete(slug);
    failedSlugTimestamps.delete(slug);
    
    return response.json();
  } catch (error) {
    // Network errors - don't cache, just return null
    return null;
  }
}

/**
 * Fetch event data by slug for spread/total markets
 */
async function fetchEventBySlug(slug: string): Promise<PolymarketEvent | null> {
  // Check if this slug recently failed (reuse the same cache)
  const failedTimestamp = failedSlugTimestamps.get(`event:${slug}`);
  if (failedSlugCache.has(`event:${slug}`) && failedTimestamp) {
    if (Date.now() - failedTimestamp < FAILED_SLUG_CACHE_TTL) {
      return null;
    }
    failedSlugCache.delete(`event:${slug}`);
    failedSlugTimestamps.delete(`event:${slug}`);
  }

  try {
    const response = await fetch(`${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      // Cache failures to prevent repeated requests
      failedSlugCache.add(`event:${slug}`);
      failedSlugTimestamps.set(`event:${slug}`, Date.now());
      return null;
    }
    
    const events = await response.json();
    const event = events?.[0] || null;
    
    // If no event found, cache this as a "failure" too
    if (!event) {
      failedSlugCache.add(`event:${slug}`);
      failedSlugTimestamps.set(`event:${slug}`, Date.now());
    }
    
    return event;
  } catch {
    // Network errors - cache temporarily to avoid rapid retries
    failedSlugCache.add(`event:${slug}`);
    failedSlugTimestamps.set(`event:${slug}`, Date.now());
    return null;
  }
}

/**
 * Get complete market data for a specific game using the slug-based API
 * Returns moneyline, spread, and total markets with proper odds percentages
 */
export async function getGameMarketData(
  homeTeam: { name: string; market?: string; alias: string },
  awayTeam: { name: string; market?: string; alias: string },
  gameDate?: Date
): Promise<GameMarketData | null> {
  // Use provided date or default to today
  const date = gameDate || new Date();
  
  // Build the slug
  const slug = buildGameSlug(homeTeam, awayTeam, date);
  
  // Try to fetch the moneyline market first (fastest)
  const moneylineMarket = await fetchMarketBySlug(slug);
  
  if (!moneylineMarket) {
    // Fallback to event-based search
    const event = await findGameEvent(homeTeam, awayTeam);
    if (!event) {
      return null;
    }
    return parseGameMarkets(event);
  }
  
  // Parse the moneyline market data
  const parsedMoneyline = parseMarketData(moneylineMarket);
  
  // Build the result with moneyline data
  const result: GameMarketData = {
    eventId: moneylineMarket.id,
    eventTitle: moneylineMarket.question || `${awayTeam.alias} @ ${homeTeam.alias}`,
    eventSlug: slug,
    totalVolume: parseFloat(String(moneylineMarket.volume)) || 0,
    moneyline: parsedMoneyline ? {
      type: 'MONEYLINE',
      question: moneylineMarket.question || '',
      outcomes: parsedMoneyline.outcomes,
      volume: parseFloat(String(moneylineMarket.volume)) || 0,
      bestBid: moneylineMarket.bestBid ?? null,
      bestAsk: moneylineMarket.bestAsk ?? null,
      marketId: moneylineMarket.id,
    } : null,
    spreads: [],
    totals: [],
    props: [],
    lastUpdated: new Date(),
  };
  
  // Try to fetch the full event to get spread/total markets
  const eventSlug = `nba-series-${awayTeam.alias.toLowerCase()}-${homeTeam.alias.toLowerCase()}-${date.toISOString().split('T')[0]}`;
  const event = await fetchEventBySlug(eventSlug);
  
  if (event?.markets) {
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
    
    // Sort by volume
    result.spreads.sort((a, b) => b.volume - a.volume);
    result.totals.sort((a, b) => b.volume - a.volume);
    result.props.sort((a, b) => b.volume - a.volume);
    
    // Update total volume
    result.totalVolume = parseFloat(String(event.volume)) || result.totalVolume;
  }
  
  return result;
}

/**
 * Get all available NBA game markets
 * Returns parsed market data for all active games
 */
export async function getAllGameMarkets(): Promise<GameMarketData[]> {
  const gameEvents = await getNBAGameEvents();
  return gameEvents.map(parseGameMarkets);
}
