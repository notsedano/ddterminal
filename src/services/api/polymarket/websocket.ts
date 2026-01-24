/**
 * Polymarket WebSocket Client
 * Real-time market data via CLOB WebSocket and Sports WebSocket
 */

import type {
  PolymarketWsMarketMessage,
  PolymarketWsBookMessage,
  PolymarketWsPriceChangeMessage,
  PolymarketWsLastTradePriceMessage,
  PolymarketWsBestBidAskMessage,
  PolymarketSportsResultMessage,
  PolymarketOrderbook,
} from '@/types';

// WebSocket endpoints
const CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/';
const SPORTS_WS_URL = 'wss://sports-api.polymarket.com/ws';

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Event types
export interface MarketDataUpdate {
  type: 'price_update' | 'orderbook_update' | 'trade';
  tokenId: string;
  marketId?: string;
  price?: number;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  size?: number;
  side?: 'BUY' | 'SELL';
  timestamp: number;
}

export interface SportsDataUpdate {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  score: string;
  period: string;
  status: string;
  live: boolean;
  ended: boolean;
  elapsed?: string;
}

// Callback types
type MarketDataCallback = (update: MarketDataUpdate) => void;
type OrderbookCallback = (tokenId: string, orderbook: PolymarketOrderbook) => void;
type SportsDataCallback = (update: SportsDataUpdate) => void;
type ConnectionStateCallback = (state: ConnectionState) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Polymarket CLOB WebSocket Client
 * Handles real-time market data subscriptions
 */
export class PolymarketCLOBWebSocket {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private subscribedTokens: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Callbacks
  private onMarketData: MarketDataCallback[] = [];
  private onOrderbook: OrderbookCallback[] = [];
  private onConnectionState: ConnectionStateCallback[] = [];
  private onError: ErrorCallback[] = [];

  // Orderbook cache for quick access
  private orderbookCache: Map<string, PolymarketOrderbook> = new Map();

  constructor() {
    // Auto-reconnect on page visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.connectionState === 'disconnected') {
          this.connect();
        }
      });
    }
  }

  /**
   * Connect to the WebSocket
   */
  connect(): void {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.setConnectionState('connecting');

    this.ws = new WebSocket(CLOB_WS_URL);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
      
      // Resubscribe to all tokens
      if (this.subscribedTokens.size > 0) {
        this.sendSubscribe(Array.from(this.subscribedTokens));
      }

      // Start ping interval
      this.startPingInterval();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this.stopPingInterval();
      this.setConnectionState('disconnected');
      
      // Attempt reconnect if not a clean close
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      const error = new Error('WebSocket error');
      this.emitError(error);
    };
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * Subscribe to market updates for specific tokens
   */
  subscribe(tokenIds: string[]): void {
    const newTokens = tokenIds.filter(id => !this.subscribedTokens.has(id));
    
    if (newTokens.length === 0) {
      return;
    }

    for (const id of newTokens) {
      this.subscribedTokens.add(id);
    }

    if (this.connectionState === 'connected') {
      this.sendSubscribe(newTokens);
    } else if (this.connectionState === 'disconnected') {
      this.connect();
    }
  }

  /**
   * Unsubscribe from market updates for specific tokens
   */
  unsubscribe(tokenIds: string[]): void {
    const tokensToRemove = tokenIds.filter(id => this.subscribedTokens.has(id));
    
    if (tokensToRemove.length === 0) {
      return;
    }

    for (const id of tokensToRemove) {
      this.subscribedTokens.delete(id);
      this.orderbookCache.delete(id);
    }

    if (this.connectionState === 'connected') {
      this.sendUnsubscribe(tokensToRemove);
    }
  }

  /**
   * Unsubscribe from all tokens
   */
  unsubscribeAll(): void {
    if (this.connectionState === 'connected') {
      this.sendUnsubscribe(Array.from(this.subscribedTokens));
    }
    this.subscribedTokens.clear();
    this.orderbookCache.clear();
  }

  /**
   * Get cached orderbook for a token
   */
  getCachedOrderbook(tokenId: string): PolymarketOrderbook | undefined {
    return this.orderbookCache.get(tokenId);
  }

  /**
   * Register callback for market data updates
   */
  onMarketDataUpdate(callback: MarketDataCallback): () => void {
    this.onMarketData.push(callback);
    return () => {
      const index = this.onMarketData.indexOf(callback);
      if (index > -1) {
        this.onMarketData.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for orderbook updates
   */
  onOrderbookUpdate(callback: OrderbookCallback): () => void {
    this.onOrderbook.push(callback);
    return () => {
      const index = this.onOrderbook.indexOf(callback);
      if (index > -1) {
        this.onOrderbook.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for connection state changes
   */
  onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.onConnectionState.push(callback);
    // Immediately call with current state
    callback(this.connectionState);
    return () => {
      const index = this.onConnectionState.indexOf(callback);
      if (index > -1) {
        this.onConnectionState.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for errors
   */
  onErrorEvent(callback: ErrorCallback): () => void {
    this.onError.push(callback);
    return () => {
      const index = this.onError.indexOf(callback);
      if (index > -1) {
        this.onError.splice(index, 1);
      }
    };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get subscribed token IDs
   */
  getSubscribedTokens(): string[] {
    return Array.from(this.subscribedTokens);
  }

  // Private methods

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    for (const callback of this.onConnectionState) {
      callback(state);
    }
  }

  private sendSubscribe(tokenIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Subscribe to market channel for each token
    const message = JSON.stringify({
      type: 'subscribe',
      channel: 'market',
      assets_ids: tokenIds,
    });

    this.ws.send(message);
  }

  private sendUnsubscribe(tokenIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = JSON.stringify({
      type: 'unsubscribe',
      channel: 'market',
      assets_ids: tokenIds,
    });

    this.ws.send(message);
  }

  private handleMessage(data: string): void {
    // Handle pong
    if (data === 'PONG') {
      // Pong received, connection is alive
      return;
    }

    let message: PolymarketWsMarketMessage;
    
    try {
      message = JSON.parse(data);
    } catch {
      // Not JSON, might be a ping/pong or other control message
      return;
    }

    const timestamp = message.timestamp ? parseInt(message.timestamp, 10) : Date.now();

    switch (message.event_type) {
      case 'book':
        this.handleBookMessage(message as PolymarketWsBookMessage, timestamp);
        break;
      case 'price_change':
        this.handlePriceChangeMessage(message as PolymarketWsPriceChangeMessage, timestamp);
        break;
      case 'last_trade_price':
        this.handleLastTradePriceMessage(message as PolymarketWsLastTradePriceMessage, timestamp);
        break;
      case 'best_bid_ask':
        this.handleBestBidAskMessage(message as PolymarketWsBestBidAskMessage, timestamp);
        break;
    }
  }

  private handleBookMessage(message: PolymarketWsBookMessage, timestamp: number): void {
    const orderbook: PolymarketOrderbook = {
      market: message.market,
      asset_id: message.asset_id,
      hash: message.hash,
      timestamp,
      bids: message.bids,
      asks: message.asks,
    };

    // Update cache
    this.orderbookCache.set(message.asset_id, orderbook);

    // Emit orderbook update
    for (const callback of this.onOrderbook) {
      callback(message.asset_id, orderbook);
    }

    // Also emit market data update with best prices
    const bestBid = message.bids.length > 0 ? parseFloat(message.bids[0].price) : undefined;
    const bestAsk = message.asks.length > 0 ? parseFloat(message.asks[0].price) : undefined;

    const update: MarketDataUpdate = {
      type: 'orderbook_update',
      tokenId: message.asset_id,
      marketId: message.market,
      bestBid,
      bestAsk,
      spread: bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined,
      timestamp,
    };

    for (const callback of this.onMarketData) {
      callback(update);
    }
  }

  private handlePriceChangeMessage(message: PolymarketWsPriceChangeMessage, timestamp: number): void {
    for (const change of message.price_changes) {
      const update: MarketDataUpdate = {
        type: 'price_update',
        tokenId: change.asset_id,
        marketId: message.market,
        price: parseFloat(change.price),
        bestBid: parseFloat(change.best_bid),
        bestAsk: parseFloat(change.best_ask),
        spread: parseFloat(change.best_ask) - parseFloat(change.best_bid),
        size: parseFloat(change.size),
        side: change.side,
        timestamp,
      };

      for (const callback of this.onMarketData) {
        callback(update);
      }
    }
  }

  private handleLastTradePriceMessage(message: PolymarketWsLastTradePriceMessage, timestamp: number): void {
    const update: MarketDataUpdate = {
      type: 'trade',
      tokenId: message.asset_id,
      marketId: message.market,
      price: parseFloat(message.price),
      size: parseFloat(message.size),
      side: message.side,
      timestamp,
    };

    for (const callback of this.onMarketData) {
      callback(update);
    }
  }

  private handleBestBidAskMessage(message: PolymarketWsBestBidAskMessage, timestamp: number): void {
    const update: MarketDataUpdate = {
      type: 'price_update',
      tokenId: message.asset_id,
      marketId: message.market,
      bestBid: parseFloat(message.best_bid),
      bestAsk: parseFloat(message.best_ask),
      spread: parseFloat(message.spread),
      timestamp,
    };

    for (const callback of this.onMarketData) {
      callback(update);
    }
  }

  private scheduleReconnect(): void {
    this.setConnectionState('reconnecting');
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('PING');
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private emitError(error: Error): void {
    for (const callback of this.onError) {
      callback(error);
    }
  }
}

/**
 * Polymarket Sports WebSocket Client
 * Handles real-time sports scores and results
 */
export class PolymarketSportsWebSocket {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Callbacks
  private onSportsData: SportsDataCallback[] = [];
  private onConnectionState: ConnectionStateCallback[] = [];
  private onError: ErrorCallback[] = [];

  // Latest game data cache
  private gamesCache: Map<number, SportsDataUpdate> = new Map();

  constructor() {
    // Auto-reconnect on page visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.connectionState === 'disconnected') {
          this.connect();
        }
      });
    }
  }

  /**
   * Connect to the WebSocket
   */
  connect(): void {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.setConnectionState('connecting');

    this.ws = new WebSocket(SPORTS_WS_URL);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
      this.startPingInterval();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this.stopPingInterval();
      this.setConnectionState('disconnected');
      
      // Attempt reconnect if not a clean close
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      const error = new Error('Sports WebSocket error');
      this.emitError(error);
    };
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * Get cached game data
   */
  getGameData(gameId: number): SportsDataUpdate | undefined {
    return this.gamesCache.get(gameId);
  }

  /**
   * Get all cached game data
   */
  getAllGameData(): SportsDataUpdate[] {
    return Array.from(this.gamesCache.values());
  }

  /**
   * Register callback for sports data updates
   */
  onSportsDataUpdate(callback: SportsDataCallback): () => void {
    this.onSportsData.push(callback);
    return () => {
      const index = this.onSportsData.indexOf(callback);
      if (index > -1) {
        this.onSportsData.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for connection state changes
   */
  onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.onConnectionState.push(callback);
    callback(this.connectionState);
    return () => {
      const index = this.onConnectionState.indexOf(callback);
      if (index > -1) {
        this.onConnectionState.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for errors
   */
  onErrorEvent(callback: ErrorCallback): () => void {
    this.onError.push(callback);
    return () => {
      const index = this.onError.indexOf(callback);
      if (index > -1) {
        this.onError.splice(index, 1);
      }
    };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Private methods

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    for (const callback of this.onConnectionState) {
      callback(state);
    }
  }

  private handleMessage(data: string): void {
    // Handle ping/pong
    if (data === 'PING') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('PONG');
      }
      return;
    }

    let message: PolymarketSportsResultMessage;
    
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }

    // Filter for NBA games only
    if (message.leagueAbbreviation?.toLowerCase() !== 'nba') {
      return;
    }

    const update: SportsDataUpdate = {
      gameId: message.gameId,
      homeTeam: message.homeTeam,
      awayTeam: message.awayTeam,
      score: message.score,
      period: message.period,
      status: message.status,
      live: message.live,
      ended: message.ended,
      elapsed: message.elapsed,
    };

    // Update cache
    this.gamesCache.set(message.gameId, update);

    // Emit update
    for (const callback of this.onSportsData) {
      callback(update);
    }
  }

  private scheduleReconnect(): void {
    this.setConnectionState('reconnecting');
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    
    // Sports WS expects PONG response to server PING
    // We also send our own ping to detect dead connections
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // The server sends PING and expects PONG
        // This interval is just for connection health check
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private emitError(error: Error): void {
    for (const callback of this.onError) {
      callback(error);
    }
  }
}

// Singleton instances
let clobSocketInstance: PolymarketCLOBWebSocket | null = null;
let sportsSocketInstance: PolymarketSportsWebSocket | null = null;

/**
 * Get the singleton CLOB WebSocket client
 */
export function getCLOBWebSocket(): PolymarketCLOBWebSocket {
  if (!clobSocketInstance) {
    clobSocketInstance = new PolymarketCLOBWebSocket();
  }
  return clobSocketInstance;
}

/**
 * Get the singleton Sports WebSocket client
 */
export function getSportsWebSocket(): PolymarketSportsWebSocket {
  if (!sportsSocketInstance) {
    sportsSocketInstance = new PolymarketSportsWebSocket();
  }
  return sportsSocketInstance;
}

/**
 * Disconnect all WebSocket clients
 */
export function disconnectAllWebSockets(): void {
  if (clobSocketInstance) {
    clobSocketInstance.disconnect();
  }
  if (sportsSocketInstance) {
    sportsSocketInstance.disconnect();
  }
}
