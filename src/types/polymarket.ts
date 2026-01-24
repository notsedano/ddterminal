/**
 * Polymarket API Types
 * Comprehensive types for Gamma API, CLOB API, Data API, and WebSocket
 */

// =============================================================================
// SPORTS MARKET TYPES
// =============================================================================

/**
 * Sports market type - determines the bet type
 */
export type SportsMarketType = 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'PROP';

/**
 * Sports metadata from /sports endpoint
 */
export interface PolymarketSportsMetadata {
  sport: string;
  image: string;
  resolution: string;
  ordering: 'home' | 'away';
  tags: string;
  series: string;
}

/**
 * Team information from /sports/teams endpoint
 */
export interface PolymarketTeam {
  id: string;
  name: string;
  abbreviation: string;
  league: string;
  logoUrl?: string;
}

// =============================================================================
// TAG/CATEGORY TYPES
// =============================================================================

export interface PolymarketTag {
  id: string;
  label: string;
  slug: string;
  forceShow?: boolean;
}

// =============================================================================
// MARKET TYPES (Gamma API)
// =============================================================================

/**
 * Individual Market within an Event (from Gamma API)
 * This is the raw structure from the API
 */
export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource?: string;
  endDate?: string;
  liquidity?: string;
  startDate?: string;
  createdAt?: string;
  updatedAt?: string;
  fee?: string;
  
  // Volume metrics
  volume?: string;
  volume24hr?: string;
  volumeNum?: number;
  volume24hrNum?: number;
  
  // Liquidity metrics
  liquidityNum?: number;
  
  // Open interest
  openInterest?: number;
  
  // Outcome data (JSON stringified arrays)
  outcomes: string; // JSON stringified: '["Yes", "No"]' or '["Lakers", "Celtics"]'
  outcomePrices: string; // JSON stringified: '["0.65", "0.35"]'
  clobTokenIds: string; // JSON stringified: '["token1", "token2"]'
  
  // Market status
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  acceptingOrders?: boolean;
  enableOrderBook?: boolean;
  
  // Pricing data from CLOB
  bestBid?: number;
  bestAsk?: number;
  lastTradePrice?: number;
  spread?: number;
  
  // Sports-specific fields
  gameId?: string;
  sportsMarketType?: SportsMarketType;
  line?: number; // For spreads and totals (e.g., -5.5 or 220.5)
  
  // Grouping
  groupItemTitle?: string;
  groupItemThreshold?: string;
}

/**
 * Event (Top-level container for markets)
 * An event can contain multiple markets (e.g., MONEYLINE, SPREAD, TOTAL for same game)
 */
export interface PolymarketEvent {
  id: string;
  ticker?: string;
  slug: string;
  title: string;
  description?: string;
  
  // Timestamps
  startDate?: string;
  creationDate?: string;
  endDate?: string;
  
  // Visual assets
  image?: string;
  icon?: string;
  
  // Status flags
  active: boolean;
  closed: boolean;
  archived?: boolean;
  new?: boolean;
  featured?: boolean;
  restricted?: boolean;
  cyom?: boolean; // Create your own market
  
  // Aggregated metrics (across all markets in event)
  liquidity?: number;
  volume?: number;
  volume24hr?: number;
  openInterest?: number;
  
  // Engagement
  commentCount?: number;
  
  // Categorization
  tags: PolymarketTag[];
  
  // Child markets
  markets: PolymarketMarket[];
  
  // Sports-specific
  gameId?: string;
  competitorNames?: string[];
  seriesSlug?: string;
}

// =============================================================================
// CLOB API TYPES
// =============================================================================

/**
 * Price response from CLOB /price endpoint
 */
export interface PolymarketPrice {
  price: string;
}

/**
 * Batch prices response from CLOB /prices endpoint
 */
export interface PolymarketPricesResponse {
  [tokenId: string]: number;
}

/**
 * Midpoint response from CLOB /midpoint endpoint
 */
export interface PolymarketMidpoint {
  mid: string;
}

/**
 * Individual orderbook entry (bid or ask)
 */
export interface PolymarketOrderbookEntry {
  price: string;
  size: string;
}

/**
 * Full orderbook response from CLOB /book endpoint
 */
export interface PolymarketOrderbook {
  market: string;
  asset_id: string;
  hash?: string;
  timestamp?: number;
  bids: PolymarketOrderbookEntry[];
  asks: PolymarketOrderbookEntry[];
}

/**
 * Tick size information
 */
export interface PolymarketTickSize {
  minimum_tick_size: string;
}

/**
 * Trade record from CLOB /trades endpoint
 */
export interface PolymarketTrade {
  id: string;
  taker_order_id: string;
  market: string;
  asset_id: string;
  side: 'BUY' | 'SELL';
  size: string;
  fee_rate_bps: string;
  price: string;
  status: string;
  match_time: string;
  last_update: string;
  outcome: string;
  bucket_index: number;
  owner: string;
  maker_address: string;
  transaction_hash: string;
  trader_side?: 'TAKER' | 'MAKER';
}

/**
 * Price history point from CLOB timeseries
 */
export interface PolymarketPriceHistoryPoint {
  t: number; // Unix timestamp in seconds
  p: number; // Price
}

/**
 * Price history response
 */
export interface PolymarketPriceHistory {
  history: PolymarketPriceHistoryPoint[];
}

// =============================================================================
// WEBSOCKET TYPES
// =============================================================================

/**
 * Base WebSocket message
 */
export interface PolymarketWsMessage {
  event_type: string;
  timestamp?: string;
}

/**
 * Book message - full orderbook snapshot
 */
export interface PolymarketWsBookMessage extends PolymarketWsMessage {
  event_type: 'book';
  asset_id: string;
  market: string;
  bids: PolymarketOrderbookEntry[];
  asks: PolymarketOrderbookEntry[];
  hash: string;
}

/**
 * Price change in a price_change message
 */
export interface PolymarketWsPriceChange {
  asset_id: string;
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
  hash: string;
  best_bid: string;
  best_ask: string;
}

/**
 * Price change message - orderbook update
 */
export interface PolymarketWsPriceChangeMessage extends PolymarketWsMessage {
  event_type: 'price_change';
  market: string;
  price_changes: PolymarketWsPriceChange[];
}

/**
 * Last trade price message
 */
export interface PolymarketWsLastTradePriceMessage extends PolymarketWsMessage {
  event_type: 'last_trade_price';
  asset_id: string;
  market: string;
  price: string;
  side: 'BUY' | 'SELL';
  size: string;
  fee_rate_bps: string;
}

/**
 * Best bid/ask message
 */
export interface PolymarketWsBestBidAskMessage extends PolymarketWsMessage {
  event_type: 'best_bid_ask';
  market: string;
  asset_id: string;
  best_bid: string;
  best_ask: string;
  spread: string;
}

/**
 * Tick size change message
 */
export interface PolymarketWsTickSizeChangeMessage extends PolymarketWsMessage {
  event_type: 'tick_size_change';
  asset_id: string;
  market: string;
  old_tick_size: string;
  new_tick_size: string;
  side: string;
}

/**
 * Union type for all market channel messages
 */
export type PolymarketWsMarketMessage =
  | PolymarketWsBookMessage
  | PolymarketWsPriceChangeMessage
  | PolymarketWsLastTradePriceMessage
  | PolymarketWsBestBidAskMessage
  | PolymarketWsTickSizeChangeMessage;

// =============================================================================
// SPORTS WEBSOCKET TYPES
// =============================================================================

/**
 * Sports result message from Sports WebSocket
 */
export interface PolymarketSportsResultMessage {
  gameId: number;
  leagueAbbreviation: string;
  homeTeam: string;
  awayTeam: string;
  status: 'scheduled' | 'InProgress' | 'finished' | string;
  score: string; // Format: "3-16" or "000-000|2-0|Bo3" for esports
  period: string; // "Q4", "2H", "HT", "FT", etc.
  elapsed?: string; // "05:09" time in current period
  live: boolean;
  ended: boolean;
  finishedTimestamp?: string;
  turn?: string; // For NFL/CFB - team with possession
}

// =============================================================================
// TRANSFORMED/DISPLAY TYPES
// =============================================================================

/**
 * Parsed outcome with extracted token ID and price
 */
export interface ParsedOutcome {
  name: string;
  price: number;
  tokenId: string;
  
  // Additional pricing data (from CLOB)
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  lastTradePrice?: number;
  
  // Change metrics
  priceChange24h?: number;
  priceChangePercent24h?: number;
}

/**
 * Sports-specific market data for display
 * This is the main type used by UI components
 */
export interface PolymarketSportsMarket {
  // Event identification
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventImage?: string;
  
  // Market data
  market: {
    id: string;
    question: string;
    conditionId: string;
    outcomes: ParsedOutcome[];
    
    // Volume metrics
    volume: number;
    volume24h: number;
    
    // Liquidity metrics
    liquidity: number;
    openInterest: number;
    
    // Pricing aggregates
    bestBid?: number;
    bestAsk?: number;
    spread?: number;
    lastTradePrice?: number;
    
    // Sports-specific
    sportsMarketType: SportsMarketType;
    line?: number;
    gameId?: string;
  };
  
  // Linked game ID for matching to NBA schedule
  matchedGameId?: string;
  
  // Last update timestamp
  lastUpdated?: Date;
}

/**
 * Extended market with orderbook data
 */
export interface PolymarketSportsMarketWithOrderbook extends PolymarketSportsMarket {
  orderbooks: Map<string, PolymarketOrderbook>; // tokenId -> orderbook
}

/**
 * Grouped markets for a single game (all bet types)
 */
export interface PolymarketGameMarkets {
  gameId: string;
  eventTitle: string;
  moneyline?: PolymarketSportsMarket;
  spread?: PolymarketSportsMarket;
  total?: PolymarketSportsMarket;
  props: PolymarketSportsMarket[];
}

/**
 * Comprehensive market details for detail view
 */
export interface PolymarketMarketDetails {
  market: PolymarketSportsMarket;
  orderbook: PolymarketOrderbook | null;
  recentTrades: PolymarketTrade[];
  priceHistory: PolymarketPriceHistoryPoint[];
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface PolymarketAPIResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Well-known sports tag IDs
 */
export const POLYMARKET_SPORTS_TAGS = {
  SPORTS: '2',
  NBA: 'nba',
  BASKETBALL: 'basketball',
} as const;

/**
 * NBA team aliases for matching
 */
export const NBA_TEAM_ALIASES: Record<string, string[]> = {
  'hawks': ['atlanta', 'atl', 'hawks'],
  'celtics': ['boston', 'bos', 'celtics'],
  'nets': ['brooklyn', 'bkn', 'nets'],
  'hornets': ['charlotte', 'cha', 'hornets'],
  'bulls': ['chicago', 'chi', 'bulls'],
  'cavaliers': ['cleveland', 'cle', 'cavaliers', 'cavs'],
  'mavericks': ['dallas', 'dal', 'mavericks', 'mavs'],
  'nuggets': ['denver', 'den', 'nuggets'],
  'pistons': ['detroit', 'det', 'pistons'],
  'warriors': ['golden state', 'gsw', 'warriors', 'gs'],
  'rockets': ['houston', 'hou', 'rockets'],
  'pacers': ['indiana', 'ind', 'pacers'],
  'clippers': ['la clippers', 'lac', 'clippers'],
  'lakers': ['los angeles lakers', 'la lakers', 'lal', 'lakers'],
  'grizzlies': ['memphis', 'mem', 'grizzlies'],
  'heat': ['miami', 'mia', 'heat'],
  'bucks': ['milwaukee', 'mil', 'bucks'],
  'timberwolves': ['minnesota', 'min', 'timberwolves', 'wolves'],
  'pelicans': ['new orleans', 'nop', 'pelicans', 'pels'],
  'knicks': ['new york', 'nyk', 'knicks'],
  'thunder': ['oklahoma city', 'okc', 'thunder'],
  'magic': ['orlando', 'orl', 'magic'],
  '76ers': ['philadelphia', 'phi', '76ers', 'sixers'],
  'suns': ['phoenix', 'phx', 'suns'],
  'trail blazers': ['portland', 'por', 'trail blazers', 'blazers'],
  'kings': ['sacramento', 'sac', 'kings'],
  'spurs': ['san antonio', 'sas', 'spurs'],
  'raptors': ['toronto', 'tor', 'raptors'],
  'jazz': ['utah', 'uta', 'jazz'],
  'wizards': ['washington', 'was', 'wizards'],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse outcomes from stringified JSON in Gamma API response
 */
export function parseMarketOutcomes(market: PolymarketMarket): ParsedOutcome[] {
  // Safely parse JSON fields, handling undefined/null values
  let outcomes: string[] = [];
  let prices: string[] = [];
  let tokenIds: string[] = [];

  if (market.outcomes && typeof market.outcomes === 'string') {
    outcomes = JSON.parse(market.outcomes);
  } else if (Array.isArray(market.outcomes)) {
    outcomes = market.outcomes;
  }

  if (market.outcomePrices && typeof market.outcomePrices === 'string') {
    prices = JSON.parse(market.outcomePrices);
  } else if (Array.isArray(market.outcomePrices)) {
    prices = market.outcomePrices.map(String);
  }

  if (market.clobTokenIds && typeof market.clobTokenIds === 'string') {
    tokenIds = JSON.parse(market.clobTokenIds);
  } else if (Array.isArray(market.clobTokenIds)) {
    tokenIds = market.clobTokenIds;
  }

  return outcomes.map((name, index) => ({
    name,
    price: parseFloat(prices[index]) || 0,
    tokenId: tokenIds[index] || '',
    bestBid: market.bestBid,
    bestAsk: market.bestAsk,
    spread: market.spread,
    lastTradePrice: market.lastTradePrice,
  }));
}

/**
 * Format price as percentage (0.652 -> "65.2%")
 */
export function formatPriceAsPercentage(price: number): string {
  return `${(price * 100).toFixed(1)}%`;
}

/**
 * Format price as American odds
 * Prices >= 0.5 are favorites (negative odds)
 * Prices < 0.5 are underdogs (positive odds)
 */
export function formatPriceAsAmericanOdds(price: number): string {
  if (price <= 0 || price >= 1) return '-';
  
  if (price >= 0.5) {
    // Favorite: -100 * (price / (1 - price))
    const americanOdds = Math.round(-100 * price / (1 - price));
    return americanOdds.toString();
  } else {
    // Underdog: +100 * ((1 - price) / price)
    const americanOdds = Math.round(100 * (1 - price) / price);
    return `+${americanOdds}`;
  }
}

/**
 * Format price as decimal odds (European format)
 */
export function formatPriceAsDecimalOdds(price: number): string {
  if (price <= 0 || price >= 1) return '-';
  const decimalOdds = 1 / price;
  return decimalOdds.toFixed(2);
}

/**
 * Format volume with appropriate suffix ($1.2M, $45.2K, etc.)
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

/**
 * Format liquidity (same as volume formatting)
 */
export function formatLiquidity(liquidity: number): string {
  return formatVolume(liquidity);
}

/**
 * Format spread in cents (0.03 -> "3¢")
 */
export function formatSpread(spread: number): string {
  const cents = Math.round(spread * 100);
  return `${cents}¢`;
}

/**
 * Format spread/total line for display
 */
export function formatLine(line: number, marketType: SportsMarketType): string {
  if (marketType === 'SPREAD') {
    // Spread: show + for positive, keep - for negative
    return line > 0 ? `+${line}` : line.toString();
  }
  if (marketType === 'TOTAL') {
    // Total: just show the number
    return line.toString();
  }
  return '';
}

/**
 * Calculate implied probability from American odds
 */
export function americanOddsToPrice(americanOdds: number): number {
  if (americanOdds < 0) {
    // Favorite: probability = |odds| / (|odds| + 100)
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  } else {
    // Underdog: probability = 100 / (odds + 100)
    return 100 / (americanOdds + 100);
  }
}

/**
 * Determine sports market type from market question
 */
export function inferSportsMarketType(question: string): SportsMarketType {
  const q = question.toLowerCase();
  
  if (q.includes('spread') || q.includes('cover') || /[+-]\d+\.?\d*\s*(points?)?/.test(q)) {
    return 'SPREAD';
  }
  if (q.includes('total') || q.includes('over') || q.includes('under') || q.includes('o/u')) {
    return 'TOTAL';
  }
  if (q.includes('points') || q.includes('rebounds') || q.includes('assists') || 
      q.includes('player') || q.includes('first') || q.includes('most')) {
    return 'PROP';
  }
  
  // Default to moneyline (who will win)
  return 'MONEYLINE';
}

/**
 * Extract line value from market question
 */
export function extractLineFromQuestion(question: string): number | undefined {
  // Match patterns like "+5.5", "-5.5", "220.5", "over 220.5", etc.
  const spreadMatch = question.match(/([+-]?\d+\.?\d*)\s*(points?)?/i);
  if (spreadMatch) {
    return parseFloat(spreadMatch[1]);
  }
  
  const totalMatch = question.match(/(over|under|o\/u)\s*(\d+\.?\d*)/i);
  if (totalMatch) {
    return parseFloat(totalMatch[2]);
  }
  
  return undefined;
}

/**
 * Transform raw Polymarket event to sports market format
 */
export function transformToSportsMarket(event: PolymarketEvent): PolymarketSportsMarket | null {
  if (!event.markets || event.markets.length === 0) {
    return null;
  }

  const primaryMarket = event.markets[0];
  const outcomes = parseMarketOutcomes(primaryMarket);
  
  const sportsMarketType = primaryMarket.sportsMarketType || inferSportsMarketType(primaryMarket.question);
  const line = primaryMarket.line || extractLineFromQuestion(primaryMarket.question);

  return {
    eventId: event.id,
    eventTitle: event.title,
    eventSlug: event.slug,
    eventImage: event.image,
    market: {
      id: primaryMarket.id,
      question: primaryMarket.question,
      conditionId: primaryMarket.conditionId,
      outcomes,
      volume: event.volume ?? parseFloat(primaryMarket.volume ?? '0'),
      volume24h: event.volume24hr ?? parseFloat(primaryMarket.volume24hr ?? '0'),
      liquidity: event.liquidity ?? parseFloat(primaryMarket.liquidity ?? '0'),
      openInterest: event.openInterest ?? primaryMarket.openInterest ?? 0,
      bestBid: primaryMarket.bestBid,
      bestAsk: primaryMarket.bestAsk,
      spread: primaryMarket.spread,
      lastTradePrice: primaryMarket.lastTradePrice,
      sportsMarketType,
      line,
      gameId: primaryMarket.gameId || event.gameId,
    },
    lastUpdated: new Date(),
  };
}

/**
 * Transform all markets from an event (for multi-market games)
 */
export function transformAllMarketsFromEvent(event: PolymarketEvent): PolymarketSportsMarket[] {
  return event.markets
    .map(market => {
      const outcomes = parseMarketOutcomes(market);
      const sportsMarketType = market.sportsMarketType || inferSportsMarketType(market.question);
      const line = market.line || extractLineFromQuestion(market.question);

      return {
        eventId: event.id,
        eventTitle: event.title,
        eventSlug: event.slug,
        eventImage: event.image,
        market: {
          id: market.id,
          question: market.question,
          conditionId: market.conditionId,
          outcomes,
          volume: parseFloat(market.volume ?? '0'),
          volume24h: parseFloat(market.volume24hr ?? '0'),
          liquidity: parseFloat(market.liquidity ?? '0'),
          openInterest: market.openInterest ?? 0,
          bestBid: market.bestBid,
          bestAsk: market.bestAsk,
          spread: market.spread,
          lastTradePrice: market.lastTradePrice,
          sportsMarketType,
          line,
          gameId: market.gameId || event.gameId,
        },
        lastUpdated: new Date(),
      };
    });
}

/**
 * Group markets by game for display
 */
export function groupMarketsByGame(markets: PolymarketSportsMarket[]): PolymarketGameMarkets[] {
  const gameMap = new Map<string, PolymarketGameMarkets>();

  for (const market of markets) {
    const gameId = market.market.gameId || market.eventId;
    
    if (!gameMap.has(gameId)) {
      gameMap.set(gameId, {
        gameId,
        eventTitle: market.eventTitle,
        props: [],
      });
    }

    const game = gameMap.get(gameId)!;
    
    switch (market.market.sportsMarketType) {
      case 'MONEYLINE':
        game.moneyline = market;
        break;
      case 'SPREAD':
        game.spread = market;
        break;
      case 'TOTAL':
        game.total = market;
        break;
      case 'PROP':
        game.props.push(market);
        break;
    }
  }

  return Array.from(gameMap.values());
}

/**
 * Check if team name matches any of the known aliases
 */
export function matchesTeamName(text: string, teamName: string): boolean {
  const textLower = text.toLowerCase();
  const teamLower = teamName.toLowerCase();
  
  // Direct match
  if (textLower.includes(teamLower)) {
    return true;
  }
  
  // Check aliases
  for (const [_, aliases] of Object.entries(NBA_TEAM_ALIASES)) {
    if (aliases.some(alias => teamLower.includes(alias))) {
      // This is the team we're looking for, check if text mentions any alias
      if (aliases.some(alias => textLower.includes(alias))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if a Polymarket event matches a specific NBA game
 */
export function matchPolymarketToGame(
  event: PolymarketEvent,
  homeTeam: { name: string; market: string; alias: string },
  awayTeam: { name: string; market: string; alias: string }
): boolean {
  const title = event.title.toLowerCase();
  
  const homeIdentifiers = [
    homeTeam.name.toLowerCase(),
    homeTeam.market.toLowerCase(),
    homeTeam.alias.toLowerCase(),
    `${homeTeam.market} ${homeTeam.name}`.toLowerCase(),
  ];
  
  const awayIdentifiers = [
    awayTeam.name.toLowerCase(),
    awayTeam.market.toLowerCase(),
    awayTeam.alias.toLowerCase(),
    `${awayTeam.market} ${awayTeam.name}`.toLowerCase(),
  ];

  const hasHome = homeIdentifiers.some(id => title.includes(id));
  const hasAway = awayIdentifiers.some(id => title.includes(id));

  return hasHome && hasAway;
}

/**
 * Extract team win probability from market outcomes
 */
export function extractWinProbability(
  market: PolymarketSportsMarket,
  teamName: string
): number | null {
  const teamLower = teamName.toLowerCase();
  
  for (const outcome of market.market.outcomes) {
    const outcomeLower = outcome.name.toLowerCase();
    if (outcomeLower.includes(teamLower) || outcomeLower === 'yes') {
      return outcome.price;
    }
  }
  
  return null;
}

/**
 * Calculate total book percentage (vig) from outcomes
 * A fair market sums to 100%, overround indicates vig
 */
export function calculateOverround(outcomes: ParsedOutcome[]): number {
  const total = outcomes.reduce((sum, o) => sum + o.price, 0);
  return (total - 1) * 100; // Return as percentage over 100%
}
