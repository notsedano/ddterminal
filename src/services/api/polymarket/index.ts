/**
 * Polymarket API Module
 * Re-exports all Polymarket services
 */

// Gamma API (Market Discovery)
export {
  getTags,
  getSportsMetadata,
  getSportsMarketTypes,
  findNBATagIds,
  searchEvents,
  getEvents,
  getEventById,
  getEventBySlug,
  getEventsByTagSlug,
  getMarkets,
  getNBAEvents,
  getNBASportsMarkets,
  getAllNBAMarkets,
  findMarketForGame,
  findAllMarketsForGame,
  getNBAChampionshipOdds,
  getChampionshipOddsForGame,
  invalidateCache,
  // New game market functions
  findGameEvent,
  getGameMarketData,
  getAllGameMarkets,
  type ParsedGameMarket,
  type GameMarketData,
} from './gamma';

// CLOB API (Pricing & Orderbooks)
export {
  getTokenPrice,
  getTokenMidpoint,
  getTokenPrices,
  getOrderbook,
  getOrderbooks,
  getTickSize,
  getTrades,
  getPriceHistory,
  calculateSpread,
  getBestBidAsk,
  calculateOrderbookMetrics,
  aggregateOrderbook,
  refreshMarketPrices,
  enrichMarketWithOrderbook,
  getMarketOrderbooks,
  clearPriceCache,
} from './clob';

// WebSocket Clients
export {
  PolymarketCLOBWebSocket,
  PolymarketSportsWebSocket,
  getCLOBWebSocket,
  getSportsWebSocket,
  disconnectAllWebSockets,
  type ConnectionState,
  type MarketDataUpdate,
  type SportsDataUpdate,
} from './websocket';
