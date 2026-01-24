/**
 * Price Chart Component
 * Lightweight price history visualization without external charting library
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import type { PolymarketPriceHistoryPoint, PolymarketSportsMarket } from '@/types';
import { formatPriceAsPercentage } from '@/types';
import { getPriceHistory } from '@/services/api/polymarket';
import { TrendingUp, TrendingDown, Minus, Clock, AlertCircle } from 'lucide-react';

interface PriceChartProps {
  market: PolymarketSportsMarket;
  tokenId: string;
  outcomeName: string;
  className?: string;
  height?: number;
}

type TimeRange = '1h' | '6h' | '24h' | '7d';

const TIME_RANGE_CONFIG: Record<TimeRange, { label: string; interval: 'minute' | 'hour' | 'day'; fidelity: number }> = {
  '1h': { label: '1H', interval: 'minute', fidelity: 1 },
  '6h': { label: '6H', interval: 'minute', fidelity: 5 },
  '24h': { label: '24H', interval: 'hour', fidelity: 1 },
  '7d': { label: '7D', interval: 'day', fidelity: 1 },
};

/**
 * Price Chart with SVG line graph
 */
export function PriceChart({ 
  tokenId, 
  outcomeName, 
  className, 
  height = 120 
}: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  const config = TIME_RANGE_CONFIG[timeRange];
  
  // Calculate time bounds
  const now = Math.floor(Date.now() / 1000);
  const startTs = useMemo(() => {
    const hourMs = 3600;
    const dayMs = 86400;
    
    switch (timeRange) {
      case '1h': return now - hourMs;
      case '6h': return now - hourMs * 6;
      case '24h': return now - dayMs;
      case '7d': return now - dayMs * 7;
      default: return now - dayMs;
    }
  }, [timeRange, now]);

  // Fetch price history
  const { data: history = [], isLoading, error } = useQuery<PolymarketPriceHistoryPoint[], Error>({
    queryKey: ['polymarket', 'price-history', tokenId, timeRange],
    queryFn: () => getPriceHistory(tokenId, {
      interval: config.interval,
      startTs,
      endTs: now,
      fidelity: config.fidelity,
    }),
    staleTime: 60 * 1000, // 1 minute
    enabled: !!tokenId,
  });

  // Calculate chart data
  const chartData = useMemo(() => {
    if (history.length === 0) return null;

    const prices = history.map(p => p.p);
    const times = history.map(p => p.t);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 0.01; // Prevent division by zero
    
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const priceChange = endPrice - startPrice;
    const priceChangePercent = startPrice > 0 ? (priceChange / startPrice) * 100 : 0;

    return {
      prices,
      times,
      minPrice,
      maxPrice,
      priceRange,
      startPrice,
      endPrice,
      priceChange,
      priceChangePercent,
    };
  }, [history]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          <span>Loading chart...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>Chart unavailable</span>
        </div>
      </div>
    );
  }

  // No data state
  if (!chartData || chartData.prices.length < 2) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-xs text-muted-foreground">
          Not enough price history
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Header with price change */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{outcomeName}</span>
          <PriceChangeIndicator 
            change={chartData.priceChange} 
            changePercent={chartData.priceChangePercent} 
          />
        </div>
        
        {/* Time range selector */}
        <div className="flex gap-1">
          {(Object.keys(TIME_RANGE_CONFIG) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-1.5 py-0.5 text-[10px] rounded',
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {TIME_RANGE_CONFIG[range].label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative" style={{ height }}>
        <SVGLineChart
          prices={chartData.prices}
          minPrice={chartData.minPrice}
          maxPrice={chartData.maxPrice}
          height={height}
          isPositive={chartData.priceChange >= 0}
        />
        
        {/* Price labels */}
        <div className="absolute top-0 right-0 text-[10px] text-muted-foreground">
          {formatPriceAsPercentage(chartData.maxPrice)}
        </div>
        <div className="absolute bottom-0 right-0 text-[10px] text-muted-foreground">
          {formatPriceAsPercentage(chartData.minPrice)}
        </div>
      </div>

      {/* Current price */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Current</span>
        <span className={cn(
          'font-medium',
          chartData.priceChange >= 0 ? 'text-green-400' : 'text-red-400'
        )}>
          {formatPriceAsPercentage(chartData.endPrice)}
        </span>
      </div>
    </div>
  );
}

/**
 * SVG Line Chart component
 */
interface SVGLineChartProps {
  prices: number[];
  minPrice: number;
  maxPrice: number;
  height: number;
  isPositive: boolean;
}

function SVGLineChart({ prices, minPrice, maxPrice, height, isPositive }: SVGLineChartProps) {
  const width = 280; // Fixed width, will scale with viewBox
  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const priceRange = maxPrice - minPrice || 0.01;

  // Generate path points
  const pathPoints = prices.map((price, index) => {
    const x = padding.left + (index / (prices.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
    return { x, y };
  });

  // Generate SVG path
  const linePath = pathPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Generate area path (for gradient fill)
  const areaPath = `
    ${linePath}
    L ${pathPoints[pathPoints.length - 1].x} ${height - padding.bottom}
    L ${pathPoints[0].x} ${height - padding.bottom}
    Z
  `;

  const strokeColor = isPositive ? '#22c55e' : '#ef4444'; // green-500 / red-500
  const gradientId = isPositive ? 'gradientGreen' : 'gradientRed';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="gradientGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gradientRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path
        d={areaPath}
        fill={`url(#${gradientId})`}
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current price dot */}
      <circle
        cx={pathPoints[pathPoints.length - 1].x}
        cy={pathPoints[pathPoints.length - 1].y}
        r="4"
        fill={strokeColor}
      />
    </svg>
  );
}

/**
 * Price change indicator
 */
interface PriceChangeIndicatorProps {
  change: number;
  changePercent: number;
  className?: string;
}

function PriceChangeIndicator({ change, changePercent, className }: PriceChangeIndicatorProps) {
  const isPositive = change >= 0;
  const isNeutral = Math.abs(changePercent) < 0.1;

  if (isNeutral) {
    return (
      <div className={cn('flex items-center gap-0.5 text-muted-foreground', className)}>
        <Minus className="h-3 w-3" />
        <span className="text-[10px]">0%</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-0.5',
      isPositive ? 'text-green-400' : 'text-red-400',
      className
    )}>
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span className="text-[10px] font-medium">
        {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
      </span>
    </div>
  );
}

/**
 * Mini sparkline chart for compact views
 */
interface SparklineProps {
  prices: number[];
  className?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ prices, className, width = 60, height = 20 }: SparklineProps) {
  if (prices.length < 2) return null;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 0.01;

  const points = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width;
    const y = height - ((price - minPrice) / priceRange) * height;
    return `${x},${y}`;
  }).join(' ');

  const isPositive = prices[prices.length - 1] >= prices[0];
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';

  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className={cn('overflow-visible', className)}
      style={{ width, height }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Price chart for all outcomes in a market
 */
interface MarketPriceChartsProps {
  market: PolymarketSportsMarket;
  className?: string;
}

export function MarketPriceCharts({ market, className }: MarketPriceChartsProps) {
  const outcomes = market.market.outcomes;
  
  if (outcomes.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <h4 className="text-xs font-medium text-muted-foreground">Price History</h4>
      
      {outcomes.map((outcome) => (
        <div key={outcome.tokenId} className="border border-border/50 rounded-lg p-3">
          <PriceChart
            market={market}
            tokenId={outcome.tokenId}
            outcomeName={outcome.name}
            height={100}
          />
        </div>
      ))}
    </div>
  );
}

export default PriceChart;
