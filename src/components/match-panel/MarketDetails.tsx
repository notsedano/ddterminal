/**
 * Market Details Component
 * Comprehensive market view with all data points for betting decisions
 */

import { useState, memo } from 'react';
import { cn } from '@/utils/cn';
import type { PolymarketSportsMarket, SportsMarketType, ParsedOutcome } from '@/types';
import { 
  formatPriceAsPercentage, 
  formatPriceAsAmericanOdds, 
  formatVolume, 
  formatLiquidity,
  formatLine,
  calculateOverround,
} from '@/types';
import { useMarketOrderbooks, useOrderbook } from '@/hooks/usePolymarketOrderbook';
import { useSubscribeMarket } from '@/hooks/usePolymarketSocket';
import { SpreadIndicator, DepthSummary } from './OrderbookDepth';
import { MarketTypeBadge } from './MarketTypeSelector';
import { 
  OrderbookDepthChart, 
  PriceLineChart, 
  OutcomeDistributionChart,
  MarketMetricsCard,
} from '@/components/charts';
import { HudChartWrapper } from '@/components/ui/HudChartWrapper';
import { 
  TrendingUp, 
  DollarSign, 
  Droplets, 
  Activity, 
  BarChart3,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  LineChart,
  PieChart,
} from 'lucide-react';

type DetailTab = 'orderbook' | 'chart' | 'distribution' | 'metrics';

interface MarketDetailsProps {
  market: PolymarketSportsMarket;
  showOrderbook?: boolean;
  showFullDetails?: boolean;
  className?: string;
}

/**
 * Full market details view - memoized to prevent re-renders during polling
 */
export const MarketDetails = memo(function MarketDetails({ 
  market, 
  showOrderbook = true,
  showFullDetails = true,
  className 
}: MarketDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [oddsFormat, setOddsFormat] = useState<'percentage' | 'american' | 'decimal'>('percentage');
  const [activeTab, setActiveTab] = useState<DetailTab>('orderbook');

  // Subscribe to real-time updates
  useSubscribeMarket(market);

  // Fetch orderbook data
  const { 
    outcomeMetrics, 
    marketSpread, 
    isLoading: orderbookLoading,
  } = useMarketOrderbooks(market, { enabled: showOrderbook });

  const outcomes = market.market.outcomes;
  const overround = calculateOverround(outcomes);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">Polymarket</span>
            <MarketTypeBadge 
              type={market.market.sportsMarketType} 
              line={market.market.line}
            />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2" title={market.market.question}>
            {market.market.question}
          </p>
        </div>

        {/* Odds format toggle */}
        <button
          onClick={() => setOddsFormat(prev => 
            prev === 'percentage' ? 'american' : 
            prev === 'american' ? 'decimal' : 'percentage'
          )}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/50"
        >
          {oddsFormat === 'percentage' ? '%' : oddsFormat === 'american' ? 'US' : 'DEC'}
        </button>
      </div>

      {/* Outcomes Grid */}
      <div className="grid grid-cols-2 gap-3">
        {outcomes.map((outcome, index) => (
          <OutcomeCard
            key={outcome.tokenId || index}
            outcome={outcome}
            index={index}
            oddsFormat={oddsFormat}
            metrics={outcomeMetrics.get(outcome.tokenId)}
            marketType={market.market.sportsMarketType}
            line={market.market.line}
          />
        ))}
      </div>

      {/* Odds Bar Visualization */}
      {outcomes.length >= 2 && (
        <OddsVisualization outcomes={outcomes} />
      )}

      {/* Market Metrics Grid */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard 
          icon={DollarSign} 
          label="Volume" 
          value={formatVolume(market.market.volume)}
          subValue={market.market.volume24h > 0 ? `${formatVolume(market.market.volume24h)} 24h` : undefined}
        />
        <MetricCard 
          icon={Droplets} 
          label="Liquidity" 
          value={formatLiquidity(market.market.liquidity)}
        />
        <MetricCard 
          icon={Activity} 
          label="Open Int." 
          value={market.market.openInterest > 0 ? formatVolume(market.market.openInterest) : '-'}
        />
        <MetricCard 
          icon={BarChart3} 
          label="Spread" 
          value={marketSpread !== null ? `${Math.round(marketSpread * 100)}¢` : '-'}
          highlight={marketSpread !== null && marketSpread <= 0.02}
        />
      </div>

      {/* Overround indicator */}
      <OverroundIndicator overround={overround} />

      {/* Expandable sections */}
      {showFullDetails && (
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground"
          >
            <span>Charts & Analytics</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-3">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
                <TabButton
                  active={activeTab === 'orderbook'}
                  onClick={() => setActiveTab('orderbook')}
                  icon={<BarChart3 className="h-3 w-3" />}
                  label="Depth"
                />
                <TabButton
                  active={activeTab === 'chart'}
                  onClick={() => setActiveTab('chart')}
                  icon={<LineChart className="h-3 w-3" />}
                  label="Price"
                />
                <TabButton
                  active={activeTab === 'distribution'}
                  onClick={() => setActiveTab('distribution')}
                  icon={<PieChart className="h-3 w-3" />}
                  label="Odds"
                />
                <TabButton
                  active={activeTab === 'metrics'}
                  onClick={() => setActiveTab('metrics')}
                  icon={<Activity className="h-3 w-3" />}
                  label="Metrics"
                />
              </div>

              {/* Tab Content */}
              <div className="min-h-[200px]">
                {activeTab === 'orderbook' && showOrderbook && (
                  <OrderbookTabContent
                    market={market}
                    outcomes={outcomes}
                    outcomeMetrics={outcomeMetrics}
                    isLoading={orderbookLoading}
                  />
                )}

                {activeTab === 'chart' && outcomes[0] && (
                  <HudChartWrapper showScanlines={true} variant="default">
                    <PriceLineChart
                      market={market}
                      tokenId={outcomes[0].tokenId}
                      outcomeName={outcomes[0].name}
                      height={180}
                      showControls={true}
                    />
                  </HudChartWrapper>
                )}

                {activeTab === 'distribution' && (
                  <HudChartWrapper showScanlines={true} variant="default">
                    <OutcomeDistributionChart
                      market={market}
                      size={160}
                    />
                  </HudChartWrapper>
                )}

                {activeTab === 'metrics' && (
                  <HudChartWrapper variant="minimal">
                    <MarketMetricsCard market={market} />
                  </HudChartWrapper>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Last updated & link */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            {market.lastUpdated 
              ? `Updated ${formatTimeAgo(market.lastUpdated)}`
              : 'Live'
            }
          </span>
        </div>
        <a
          href={`https://polymarket.com/event/${market.eventSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <span>View on Polymarket</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
});

/**
 * Outcome card with price and metrics
 */
interface OutcomeCardProps {
  outcome: ParsedOutcome;
  index: number;
  oddsFormat: 'percentage' | 'american' | 'decimal';
  metrics?: {
    bestBid: number | null;
    bestAsk: number | null;
    spread: number | null;
  };
  marketType: SportsMarketType;
  line?: number;
}

/**
 * OutcomeCard - memoized to prevent re-renders when odds haven't changed
 */
const OutcomeCard = memo(function OutcomeCard({ outcome, index, oddsFormat, metrics, marketType, line }: OutcomeCardProps) {
  const isFirst = index === 0;
  const colorClass = isFirst ? 'text-green-400' : 'text-red-400';
  const bgColorClass = isFirst ? 'bg-green-500/10' : 'bg-red-500/10';

  const formatOdds = (price: number): string => {
    switch (oddsFormat) {
      case 'american':
        return formatPriceAsAmericanOdds(price);
      case 'decimal':
        return price > 0 ? (1 / price).toFixed(2) : '-';
      default:
        return formatPriceAsPercentage(price);
    }
  };

  // Format outcome name with line for spreads/totals
  const displayName = (() => {
    if (marketType === 'SPREAD' && line !== undefined) {
      if (isFirst) {
        return `${outcome.name} ${formatLine(line, 'SPREAD')}`;
      } else {
        return `${outcome.name} ${formatLine(-line, 'SPREAD')}`;
      }
    }
    if (marketType === 'TOTAL') {
      return outcome.name; // Already includes Over/Under
    }
    return outcome.name;
  })();

  return (
    <div className={cn('flex flex-col p-3 rounded-lg', bgColorClass)}>
      {/* Outcome name */}
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 truncate">
        {displayName}
      </span>

      {/* Price */}
      <span className={cn('text-2xl font-bold hud-data', colorClass)}>
        {formatOdds(outcome.price)}
      </span>

      {/* Bid/Ask if available */}
      {metrics && (metrics.bestBid !== null || metrics.bestAsk !== null) && (
        <div className="flex items-center gap-2 mt-2 text-[10px]">
          {metrics.bestBid !== null && (
            <span className="text-muted-foreground">
              Bid: <span className="text-green-400 hud-data">${metrics.bestBid.toFixed(2)}</span>
            </span>
          )}
          {metrics.bestAsk !== null && (
            <span className="text-muted-foreground">
              Ask: <span className="text-red-400 hud-data">${metrics.bestAsk.toFixed(2)}</span>
            </span>
          )}
        </div>
      )}

      {/* Spread indicator */}
      {metrics && metrics.spread !== null && (
        <div className="mt-1">
          <SpreadIndicator spread={metrics.spread} />
        </div>
      )}
    </div>
  );
});

/**
 * Odds visualization bar - memoized for stable outcome data
 * Always shows higher percentage (favorite) on the left in green
 */
const OddsVisualization = memo(function OddsVisualization({ outcomes }: { outcomes: ParsedOutcome[] }) {
  if (outcomes.length < 2) return null;
  
  // Sort to ensure favorite (higher %) is always on the left
  const sorted = [...outcomes].sort((a, b) => b.price - a.price);
  const favoritePrice = sorted[0]?.price ?? 0.5;
  const underdogPrice = sorted[1]?.price ?? 0.5;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{sorted[0]?.name}</span>
        <span>{sorted[1]?.name}</span>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${favoritePrice * 100}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-500"
          style={{ width: `${underdogPrice * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-xs font-medium">
        <span className="text-green-400">{formatPriceAsPercentage(favoritePrice)}</span>
        <span className="text-red-400">{formatPriceAsPercentage(underdogPrice)}</span>
      </div>
    </div>
  );
});

/**
 * Metric card
 */
interface MetricCardProps {
  icon: typeof DollarSign;
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}

/**
 * MetricCard - memoized for stable metrics display
 */
const MetricCard = memo(function MetricCard({ icon: Icon, label, value, subValue, highlight }: MetricCardProps) {
  return (
    <div className={cn(
      'flex flex-col items-center p-2 rounded-lg',
      highlight ? 'bg-green-500/10' : 'bg-muted/30'
    )}>
      <Icon className={cn(
        'h-3.5 w-3.5 mb-1',
        highlight ? 'text-green-400' : 'text-muted-foreground'
      )} />
      <span className="text-xs font-medium hud-data">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {subValue && (
        <span className="text-[9px] text-muted-foreground/70">{subValue}</span>
      )}
    </div>
  );
});

/**
 * Overround indicator
 */
function OverroundIndicator({ overround }: { overround: number }) {
  const isGood = overround < 3;
  const isFair = overround >= 3 && overround < 8;

  return (
    <div className={cn(
      'flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-[10px]',
      isGood ? 'bg-green-500/10 text-green-400' :
      isFair ? 'bg-yellow-500/10 text-yellow-400' :
      'bg-red-500/10 text-red-400'
    )}>
      <span>Market Edge:</span>
      <span className="font-medium hud-data">{overround.toFixed(1)}%</span>
      <span className="text-muted-foreground">
        {isGood ? '(Low vig)' : isFair ? '(Standard)' : '(High vig)'}
      </span>
    </div>
  );
}


/**
 * Compact market details for list views - memoized
 */
interface CompactMarketDetailsProps {
  market: PolymarketSportsMarket;
  className?: string;
}

export const CompactMarketDetails = memo(function CompactMarketDetails({ market, className }: CompactMarketDetailsProps) {
  const outcomes = market.market.outcomes;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Quick odds */}
      <div className="flex items-center justify-between">
        {outcomes.slice(0, 2).map((outcome, index) => (
          <div key={outcome.tokenId || index} className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
              {outcome.name}:
            </span>
            <span className={cn(
              'text-sm font-semibold hud-data',
              index === 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {formatPriceAsPercentage(outcome.price)}
            </span>
          </div>
        ))}
      </div>

      {/* Quick metrics */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="hud-data">Vol: {formatVolume(market.market.volume)}</span>
        <span>•</span>
        <span className="hud-data">Liq: {formatLiquidity(market.market.liquidity)}</span>
        {market.market.spread !== undefined && (
          <>
            <span>•</span>
            <span className="hud-data">Spread: {Math.round(market.market.spread * 100)}¢</span>
          </>
        )}
      </div>
    </div>
  );
});

/**
 * Connection status indicator
 */
interface ConnectionStatusProps {
  isConnected: boolean;
  className?: string;
}

export function ConnectionStatus({ isConnected, className }: ConnectionStatusProps) {
  return (
    <div className={cn(
      'flex items-center gap-1 text-[10px]',
      isConnected ? 'text-green-400' : 'text-muted-foreground',
      className
    )}>
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Polling</span>
        </>
      )}
    </div>
  );
}

/**
 * Tab Button Component
 */
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors flex-1 justify-center',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * Orderbook Tab Content with MUI X Charts
 */
interface OrderbookTabContentProps {
  market: PolymarketSportsMarket;
  outcomes: ParsedOutcome[];
  outcomeMetrics: Map<string, {
    bestBid: number | null;
    bestAsk: number | null;
    spread: number | null;
    bidDepth: number;
    askDepth: number;
    imbalance: number;
    imbalancePercentage: number;
  }>;
  isLoading: boolean;
}

function OrderbookTabContent({ outcomes, outcomeMetrics, isLoading }: OrderbookTabContentProps) {
  // Get orderbook data for the primary outcome
  const primaryOutcome = outcomes[0];
  const { aggregatedLevels, metrics } = useOrderbook(primaryOutcome?.tokenId ?? null, {
    enabled: !!primaryOutcome?.tokenId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Activity className="h-4 w-4 animate-pulse mr-2" />
        Loading orderbook...
      </div>
    );
  }

  if (!primaryOutcome || aggregatedLevels.bids.length === 0 && aggregatedLevels.asks.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {/* Fallback to simple depth summary */}
        {outcomeMetrics.size > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {outcomes.map((outcome, index) => {
              const m = outcomeMetrics.get(outcome.tokenId);
              if (!m) return null;
              
              return (
                <div key={outcome.tokenId || index} className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs font-medium mb-2">{outcome.name}</div>
                  <DepthSummary 
                    bidDepth={m.bidDepth} 
                    askDepth={m.askDepth} 
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-muted-foreground">Bid: </span>
                      <span className="text-green-400 font-mono hud-data">
                        {m.bestBid !== null ? `$${m.bestBid.toFixed(2)}` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ask: </span>
                      <span className="text-red-400 font-mono hud-data">
                        {m.bestAsk !== null ? `$${m.bestAsk.toFixed(2)}` : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <HudChartWrapper showScanlines={true} variant="default">
      <OrderbookDepthChart
        bids={aggregatedLevels.bids}
        asks={aggregatedLevels.asks}
        metrics={metrics}
        height={220}
        showMetrics={true}
        showImbalance={true}
      />
    </HudChartWrapper>
  );
}

// Helper function
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default MarketDetails;
