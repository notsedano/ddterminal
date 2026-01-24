/**
 * Orderbook Depth Component
 * Visualizes bid/ask depth with horizontal bars
 */

import { cn } from '@/utils/cn';
import type { AggregatedLevel, OrderbookDisplayMetrics } from '@/hooks/usePolymarketOrderbook';
import { formatSpreadDisplay, formatDepthDisplay, getImbalanceIndicator } from '@/hooks/usePolymarketOrderbook';

interface OrderbookDepthProps {
  bids: AggregatedLevel[];
  asks: AggregatedLevel[];
  metrics: OrderbookDisplayMetrics | null;
  className?: string;
  compact?: boolean;
}

/**
 * Full orderbook depth visualization
 */
export function OrderbookDepth({ bids, asks, metrics, className, compact = false }: OrderbookDepthProps) {
  if (bids.length === 0 && asks.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-4 text-xs text-muted-foreground', className)}>
        No orderbook data available
      </div>
    );
  }

  if (compact) {
    return <CompactOrderbookDepth bids={bids} asks={asks} metrics={metrics} className={className} />;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Metrics Header */}
      {metrics && <OrderbookMetrics metrics={metrics} />}

      {/* Depth Visualization */}
      <div className="flex flex-col gap-1">
        {/* Ask side (sells) - reversed so lowest ask is at bottom */}
        <div className="flex flex-col-reverse gap-0.5">
          {asks.slice(0, 5).map((level, index) => (
            <DepthLevel
              key={`ask-${index}`}
              price={level.price}
              size={level.size}
              percentage={level.percentage}
              side="ask"
            />
          ))}
        </div>

        {/* Spread indicator */}
        {metrics && metrics.spread !== null && (
          <div className="flex items-center justify-center py-1">
            <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-muted/50">
              <span className="text-[10px] text-muted-foreground">Spread</span>
              <span className="text-xs font-mono font-medium">
                {formatSpreadDisplay(metrics.spread)}
              </span>
            </div>
          </div>
        )}

        {/* Bid side (buys) */}
        <div className="flex flex-col gap-0.5">
          {bids.slice(0, 5).map((level, index) => (
            <DepthLevel
              key={`bid-${index}`}
              price={level.price}
              size={level.size}
              percentage={level.percentage}
              side="bid"
            />
          ))}
        </div>
      </div>

      {/* Imbalance indicator */}
      {metrics && <ImbalanceIndicator imbalance={metrics.imbalance} />}
    </div>
  );
}

/**
 * Single depth level with horizontal bar
 */
interface DepthLevelProps {
  price: number;
  size: number;
  percentage: number;
  side: 'bid' | 'ask';
}

function DepthLevel({ price, size, percentage, side }: DepthLevelProps) {
  const isBid = side === 'bid';
  
  return (
    <div className="relative flex items-center h-6">
      {/* Background bar */}
      <div
        className={cn(
          'absolute inset-y-0 rounded-sm transition-all duration-300',
          isBid ? 'bg-green-500/20 left-0' : 'bg-red-500/20 right-0'
        )}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
      
      {/* Content */}
      <div className="relative flex items-center justify-between w-full px-2 text-[11px]">
        <span className={cn(
          'font-mono font-medium',
          isBid ? 'text-green-400' : 'text-red-400'
        )}>
          ${price.toFixed(2)}
        </span>
        <span className="text-muted-foreground font-mono">
          {formatDepthDisplay(size)}
        </span>
      </div>
    </div>
  );
}

/**
 * Orderbook metrics display
 */
function OrderbookMetrics({ metrics }: { metrics: OrderbookDisplayMetrics }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {/* Best Bid */}
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground uppercase">Best Bid</span>
        <span className="text-sm font-mono font-medium text-green-400">
          {metrics.bestBid !== null ? `$${metrics.bestBid.toFixed(2)}` : '-'}
        </span>
      </div>

      {/* Spread */}
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground uppercase">Spread</span>
        <span className="text-sm font-mono font-medium">
          {formatSpreadDisplay(metrics.spread)}
        </span>
      </div>

      {/* Best Ask */}
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground uppercase">Best Ask</span>
        <span className="text-sm font-mono font-medium text-red-400">
          {metrics.bestAsk !== null ? `$${metrics.bestAsk.toFixed(2)}` : '-'}
        </span>
      </div>
    </div>
  );
}

/**
 * Imbalance indicator bar
 */
function ImbalanceIndicator({ imbalance }: { imbalance: number }) {
  const indicator = getImbalanceIndicator(imbalance);
  const percentage = ((imbalance + 1) / 2) * 100; // Convert -1..1 to 0..100

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>More Sells</span>
        <span>Order Imbalance</span>
        <span>More Buys</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
        
        {/* Imbalance indicator */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-2 rounded-full transition-all duration-300',
            indicator === 'bid' ? 'bg-green-500' : indicator === 'ask' ? 'bg-red-500' : 'bg-muted-foreground'
          )}
          style={{ left: `calc(${percentage}% - 4px)` }}
        />
      </div>
    </div>
  );
}

/**
 * Compact orderbook depth for inline display
 */
function CompactOrderbookDepth({ 
  bids, 
  asks, 
  metrics, 
  className 
}: Omit<OrderbookDepthProps, 'compact'>) {
  const bestBid = bids[0];
  const bestAsk = asks[0];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Bid */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground">Bid:</span>
        <span className="text-xs font-mono font-medium text-green-400">
          {bestBid ? `$${bestBid.price.toFixed(2)}` : '-'}
        </span>
      </div>

      {/* Spread */}
      {metrics && metrics.spread !== null && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Spread:</span>
          <span className="text-xs font-mono">
            {formatSpreadDisplay(metrics.spread)}
          </span>
        </div>
      )}

      {/* Ask */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground">Ask:</span>
        <span className="text-xs font-mono font-medium text-red-400">
          {bestAsk ? `$${bestAsk.price.toFixed(2)}` : '-'}
        </span>
      </div>
    </div>
  );
}

/**
 * Mini spread indicator for cards
 */
interface SpreadIndicatorProps {
  spread: number | null;
  className?: string;
}

export function SpreadIndicator({ spread, className }: SpreadIndicatorProps) {
  if (spread === null) return null;

  const spreadCents = Math.round(spread * 100);
  const isWide = spreadCents > 5;
  const isTight = spreadCents <= 2;

  return (
    <div className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
      isTight ? 'bg-green-500/10 text-green-400' :
      isWide ? 'bg-yellow-500/10 text-yellow-400' :
      'bg-muted text-muted-foreground',
      className
    )}>
      <span>{spreadCents}¢</span>
      <span className="text-muted-foreground/70">spread</span>
    </div>
  );
}

/**
 * Depth summary for compact views
 */
interface DepthSummaryProps {
  bidDepth: number;
  askDepth: number;
  className?: string;
}

export function DepthSummary({ bidDepth, askDepth, className }: DepthSummaryProps) {
  const total = bidDepth + askDepth;
  const bidPercentage = total > 0 ? (bidDepth / total) * 100 : 50;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Bids: {formatDepthDisplay(bidDepth)}</span>
        <span>Asks: {formatDepthDisplay(askDepth)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex">
        <div
          className="bg-green-500 transition-all duration-300"
          style={{ width: `${bidPercentage}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-300"
          style={{ width: `${100 - bidPercentage}%` }}
        />
      </div>
    </div>
  );
}

export default OrderbookDepth;
