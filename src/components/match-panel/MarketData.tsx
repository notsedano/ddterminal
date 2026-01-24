/**
 * Market Data Component
 * Displays Polymarket odds and market information
 * Enhanced version with comprehensive data display
 */

import { useState } from 'react';
import { TrendingUp, DollarSign, BarChart3, Droplets, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { PolymarketSportsMarket, SportsMarketType } from '@/types';
import { 
  formatPriceAsPercentage, 
  formatPriceAsAmericanOdds,
  formatVolume,
  formatLiquidity,
  formatLine,
  calculateOverround,
} from '@/types';
import { useMarketOrderbooks } from '@/hooks/usePolymarketOrderbook';
import { useSubscribeMarket } from '@/hooks/usePolymarketSocket';
import { MarketTypeBadge } from './MarketTypeSelector';
import { SpreadIndicator } from './OrderbookDepth';

interface MarketDataProps {
  market: PolymarketSportsMarket | null;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
}

/**
 * Enhanced Market Data Component
 */
export function MarketData({ market, className, variant = 'default' }: MarketDataProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [oddsFormat, setOddsFormat] = useState<'percentage' | 'american'>('percentage');

  // Subscribe to real-time updates
  useSubscribeMarket(market);

  // Fetch orderbook data for spread information
  const { outcomeMetrics, marketSpread } = useMarketOrderbooks(market, { 
    enabled: variant !== 'compact',
    refetchInterval: false, // Only fetch on mount, WebSocket handles updates
  });

  if (!market) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center p-4 rounded-lg bg-muted/30',
        className
      )}>
        <BarChart3 className="h-5 w-5 text-muted-foreground/50 mb-2" />
        <span className="text-xs text-muted-foreground">No market data available</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return <CompactMarketData market={market} className={className} />;
  }

  const outcomes = market.market.outcomes;
  const volume = market.market.volume;
  const volume24h = market.market.volume24h;
  const liquidity = market.market.liquidity;
  const overround = calculateOverround(outcomes);

  const formatOdds = (price: number): string => {
    return oddsFormat === 'american' 
      ? formatPriceAsAmericanOdds(price) 
      : formatPriceAsPercentage(price);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Polymarket</span>
          <MarketTypeBadge 
            type={market.market.sportsMarketType} 
            line={market.market.line}
          />
        </div>
        
        {/* Odds format toggle */}
        <button
          onClick={() => setOddsFormat(prev => prev === 'percentage' ? 'american' : 'percentage')}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/50 transition-colors"
        >
          {oddsFormat === 'percentage' ? '%' : 'US'}
        </button>
      </div>

      {/* Market Question (truncated) */}
      <p className="text-xs text-muted-foreground line-clamp-2" title={market.market.question}>
        {market.market.question}
      </p>

      {/* Outcomes/Odds */}
      <div className="grid grid-cols-2 gap-2">
        {outcomes.map((outcome, index) => {
          const metrics = outcomeMetrics.get(outcome.tokenId);
          const isFirst = index === 0;
          
          return (
            <div
              key={outcome.tokenId || index}
              className={cn(
                'flex flex-col items-center p-3 rounded-lg',
                isFirst ? 'bg-green-500/10' : 'bg-red-500/10'
              )}
            >
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 text-center">
                {formatOutcomeName(outcome.name, market.market.sportsMarketType, market.market.line, index)}
              </span>
              <span className={cn(
                'text-xl font-bold',
                isFirst ? 'text-green-400' : 'text-red-400'
              )}>
                {formatOdds(outcome.price)}
              </span>
              
              {/* Bid/Ask spread */}
              {metrics && metrics.spread !== null && metrics.spread !== undefined && (
                <div className="mt-1">
                  <SpreadIndicator spread={metrics.spread} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Odds Bar Visualization */}
      {outcomes.length >= 2 && (
        <OddsBar outcomes={outcomes} />
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <MetricItem 
          icon={DollarSign} 
          label="Volume" 
          value={formatVolume(volume)} 
        />
        <MetricItem 
          icon={Droplets} 
          label="Liquidity" 
          value={formatLiquidity(liquidity)} 
        />
        <MetricItem 
          icon={BarChart3} 
          label="Spread" 
          value={marketSpread !== null ? `${Math.round(marketSpread * 100)}¢` : '-'}
          highlight={marketSpread !== null && marketSpread <= 0.02}
        />
        <MetricItem 
          label="Edge" 
          value={`${overround.toFixed(1)}%`}
          highlight={overround < 3}
        />
      </div>

      {/* 24h Volume if available */}
      {volume24h > 0 && (
        <div className="text-[10px] text-muted-foreground/70 text-center">
          24h Volume: {formatVolume(volume24h)}
        </div>
      )}

      {/* Expandable Details */}
      {variant === 'detailed' && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{showDetails ? 'Less' : 'More'} Details</span>
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showDetails && (
            <div className="border-t border-border pt-3 mt-1">
              <DetailedMetrics market={market} outcomeMetrics={outcomeMetrics} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Metric Item Component
 */
interface MetricItemProps {
  icon?: typeof DollarSign;
  label: string;
  value: string;
  highlight?: boolean;
}

function MetricItem({ icon: Icon, label, value, highlight }: MetricItemProps) {
  return (
    <div className={cn(
      'flex flex-col items-center py-1.5 rounded',
      highlight ? 'bg-green-500/10' : 'bg-muted/20'
    )}>
      {Icon && <Icon className={cn('h-3 w-3 mb-0.5', highlight ? 'text-green-400' : 'text-muted-foreground')} />}
      <span className={cn('text-xs font-medium', highlight && 'text-green-400')}>{value}</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Detailed Metrics Section
 */
interface DetailedMetricsProps {
  market: PolymarketSportsMarket;
  outcomeMetrics: Map<string, {
    bestBid: number | null;
    bestAsk: number | null;
    spread: number | null;
    bidDepth: number;
    askDepth: number;
  }>;
}

function DetailedMetrics({ market, outcomeMetrics }: DetailedMetricsProps) {
  return (
    <div className="space-y-3">
      {market.market.outcomes.map((outcome, index) => {
        const metrics = outcomeMetrics.get(outcome.tokenId);
        
        return (
          <div key={outcome.tokenId || index} className="p-2 rounded-lg bg-muted/20">
            <div className="text-[10px] font-medium mb-2">{outcome.name}</div>
            <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
              <div>
                <div className="text-muted-foreground">Price</div>
                <div className="font-mono">{formatPriceAsPercentage(outcome.price)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Bid</div>
                <div className="font-mono text-green-400">
                  {metrics && metrics.bestBid !== null ? `$${metrics.bestBid.toFixed(2)}` : '-'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Ask</div>
                <div className="font-mono text-red-400">
                  {metrics && metrics.bestAsk !== null ? `$${metrics.bestAsk.toFixed(2)}` : '-'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Spread</div>
                <div className="font-mono">
                  {metrics && metrics.spread !== null ? `${Math.round(metrics.spread * 100)}¢` : '-'}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Format outcome name with line for spreads/totals
 */
function formatOutcomeName(
  name: string, 
  marketType: SportsMarketType, 
  line: number | undefined,
  index: number
): string {
  if (marketType === 'SPREAD' && line !== undefined) {
    const displayLine = index === 0 ? line : -line;
    return `${name} ${formatLine(displayLine, 'SPREAD')}`;
  }
  return name;
}

/**
 * Compact version of MarketData for inline display
 */
interface CompactMarketDataProps {
  market: PolymarketSportsMarket | null;
  className?: string;
}

export function CompactMarketData({ market, className }: CompactMarketDataProps) {
  if (!market) {
    return (
      <div className={cn('flex items-center gap-1 text-xs text-muted-foreground/50', className)}>
        <span>No odds</span>
      </div>
    );
  }

  const outcomes = market.market.outcomes;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {outcomes.slice(0, 2).map((outcome, index) => (
        <div key={outcome.tokenId || index} className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">
            {outcome.name}:
          </span>
          <span className={cn(
            'text-xs font-semibold',
            index === 0 ? 'text-green-400' : 'text-red-400'
          )}>
            {formatPriceAsPercentage(outcome.price)}
          </span>
        </div>
      ))}
      
      {/* Volume indicator */}
      <span className="text-[10px] text-muted-foreground/70">
        {formatVolume(market.market.volume)}
      </span>
    </div>
  );
}

/**
 * Odds Bar visualization
 */
interface OddsBarProps {
  outcomes: Array<{ name: string; price: number }>;
  className?: string;
  showLabels?: boolean;
}

export function OddsBar({ outcomes, className, showLabels = false }: OddsBarProps) {
  if (outcomes.length < 2) return null;

  const yesPrice = outcomes[0]?.price ?? 0.5;
  const noPrice = outcomes[1]?.price ?? 0.5;

  return (
    <div className={cn('space-y-1', className)}>
      {showLabels && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{outcomes[0]?.name}</span>
          <span>{outcomes[1]?.name}</span>
        </div>
      )}
      <div className="w-full h-2 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${yesPrice * 100}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${noPrice * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Enhanced Odds Bar with price labels
 */
interface EnhancedOddsBarProps {
  outcomes: Array<{ name: string; price: number }>;
  className?: string;
}

export function EnhancedOddsBar({ outcomes, className }: EnhancedOddsBarProps) {
  if (outcomes.length < 2) return null;

  const yesPrice = outcomes[0]?.price ?? 0.5;
  const noPrice = outcomes[1]?.price ?? 0.5;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-[10px]">
        <span className="text-green-400 font-medium">
          {outcomes[0]?.name}: {formatPriceAsPercentage(yesPrice)}
        </span>
        <span className="text-red-400 font-medium">
          {outcomes[1]?.name}: {formatPriceAsPercentage(noPrice)}
        </span>
      </div>
      <div className="relative w-full h-3 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-500 ease-out"
          style={{ width: `${yesPrice * 100}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-500 ease-out"
          style={{ width: `${noPrice * 100}%` }}
        />
        {/* Center marker */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-background/50" />
      </div>
    </div>
  );
}

export default MarketData;
