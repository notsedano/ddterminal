/**
 * Price Line Chart Component
 * Visualizes price history using MUI X Charts line/area chart
 */

import { LineChart } from '@mui/x-charts/LineChart';
import { useMemo, useState, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
import { ChartThemeProvider, chartColors } from './ChartThemeProvider';
import type { PolymarketPriceHistoryPoint, PolymarketSportsMarket } from '@/types';
import { formatPriceAsPercentage } from '@/types';
import { getPriceHistory } from '@/services/api/polymarket';
import { TrendingUp, TrendingDown, Minus, Clock, AlertCircle } from 'lucide-react';

type TimeRange = '1h' | '6h' | '24h' | '7d';

interface TimeRangeConfig {
  label: string;
  interval: '1m' | '1h' | '6h' | '1d' | '1w' | 'max';
  fidelity: number;
  tickFormat: string;
}

const TIME_RANGE_CONFIG: Record<TimeRange, TimeRangeConfig> = {
  '1h': { label: '1H', interval: '1h', fidelity: 1, tickFormat: 'HH:mm' },
  '6h': { label: '6H', interval: '6h', fidelity: 5, tickFormat: 'HH:mm' },
  '24h': { label: '1D', interval: '1d', fidelity: 1, tickFormat: 'HH:mm' },
  '7d': { label: '7D', interval: '1d', fidelity: 60, tickFormat: 'MMM d' },  // Use daily interval for 7 days
};

interface PriceLineChartProps {
  market?: PolymarketSportsMarket;
  tokenId: string;
  outcomeName: string;
  className?: string;
  height?: number;
  showControls?: boolean;
  showTimeSelector?: boolean; // Alias for showControls
  defaultTimeRange?: TimeRange;
}

/**
 * MUI X Charts price line chart with area fill - memoized for stable token data
 */
export const PriceLineChart = memo(function PriceLineChart({
  tokenId,
  outcomeName,
  className,
  height = 180,
  showControls = true,
  showTimeSelector,
  defaultTimeRange = '24h',
}: PriceLineChartProps) {
  // showTimeSelector is an alias for showControls
  const shouldShowControls = showTimeSelector ?? showControls;
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange);
  const config = TIME_RANGE_CONFIG[timeRange];

  // Calculate time bounds
  const now = Math.floor(Date.now() / 1000);
  const startTs = useMemo(() => {
    const hourSeconds = 3600;
    const daySeconds = 86400;
    
    switch (timeRange) {
      case '1h': return now - hourSeconds;
      case '6h': return now - hourSeconds * 6;
      case '24h': return now - daySeconds;
      case '7d': return now - daySeconds * 7;
      default: return now - daySeconds;
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
    staleTime: 60 * 1000,
    enabled: !!tokenId,
  });

  // Process chart data
  const chartData = useMemo(() => {
    if (history.length < 2) return null;

    const prices = history.map(p => p.p);
    const timestamps = history.map(p => new Date(p.t * 1000));
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const priceChange = endPrice - startPrice;
    const priceChangePercent = startPrice > 0 ? (priceChange / startPrice) * 100 : 0;

    return {
      prices,
      timestamps,
      minPrice,
      maxPrice,
      startPrice,
      endPrice,
      priceChange,
      priceChangePercent,
      isPositive: priceChange >= 0,
    };
  }, [history]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          <span>Loading price history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load price data</span>
        </div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-sm text-muted-foreground">
          Not enough price history available
        </div>
      </div>
    );
  }

  const lineColor = chartData.isPositive ? chartColors.success : chartColors.danger;

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-2', className)}>
        {/* Header with price info and time range selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{outcomeName}</span>
            <PriceChangeIndicator
              change={chartData.priceChange}
              changePercent={chartData.priceChangePercent}
            />
          </div>
          
          {shouldShowControls && (
            <div className="flex gap-1">
              {(Object.keys(TIME_RANGE_CONFIG) as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-md transition-colors',
                    timeRange === range
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {TIME_RANGE_CONFIG[range].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Line Chart */}
        <div style={{ height }}>
          <LineChart
            xAxis={[{
              data: chartData.timestamps,
              scaleType: 'time',
              tickLabelStyle: {
                fontSize: 10,
              },
              valueFormatter: (value: Date) => format(value, config.tickFormat),
              tickNumber: 5,
            }]}
            yAxis={[{
              min: Math.max(0, chartData.minPrice - 0.05),
              max: Math.min(1, chartData.maxPrice + 0.05),
              tickLabelStyle: {
                fontSize: 10,
                fontFamily: 'ui-monospace, monospace',
              },
              valueFormatter: (value: number) => formatPriceAsPercentage(value),
              tickNumber: 4,
            }]}
            series={[{
              data: chartData.prices,
              color: lineColor,
              area: true,
              showMark: false,
              valueFormatter: (value: number | null) => 
                value !== null ? formatPriceAsPercentage(value) : '',
            }]}
            margin={{ left: 50, right: 10, top: 10, bottom: 25 }}
            hideLegend
            sx={{
              '& .MuiAreaElement-root': {
                fill: `url(#gradient-${chartData.isPositive ? 'up' : 'down'})`,
              },
              '& .MuiLineElement-root': {
                strokeWidth: 2,
              },
            }}
          >
            {/* Custom gradient definitions */}
            <defs>
              <linearGradient id="gradient-up" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.success} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColors.success} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradient-down" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.danger} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColors.danger} stopOpacity={0} />
              </linearGradient>
            </defs>
          </LineChart>
        </div>

        {/* Current price display */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Current:</span>
            <span className={cn(
              'font-mono font-medium',
              chartData.isPositive ? 'text-green-400' : 'text-red-400'
            )}>
              {formatPriceAsPercentage(chartData.endPrice)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>Low: {formatPriceAsPercentage(chartData.minPrice)}</span>
            <span>High: {formatPriceAsPercentage(chartData.maxPrice)}</span>
          </div>
        </div>
      </div>
    </ChartThemeProvider>
  );
});

/**
 * Price change indicator with icon
 */
function PriceChangeIndicator({ change, changePercent }: { change: number; changePercent: number }) {
  const isPositive = change >= 0;
  const isNeutral = Math.abs(changePercent) < 0.1;

  if (isNeutral) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">0.0%</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-1',
      isPositive ? 'text-green-400' : 'text-red-400'
    )}>
      {isPositive ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      <span className="text-xs font-medium">
        {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
      </span>
    </div>
  );
}

/**
 * Multi-outcome price comparison chart
 * Shows all outcomes for a market on the same chart
 */
interface MultiOutcomePriceChartProps {
  market: PolymarketSportsMarket;
  height?: number;
  className?: string;
}

/**
 * Multi-outcome price comparison chart - memoized
 */
/**
 * Outcome Comparison Chart
 * Compares price history for multiple outcomes (e.g., both teams in a game)
 * Takes outcomes directly with tokenIds - works with ParsedGameMarket
 */
interface OutcomeComparisonChartProps {
  outcomes: Array<{
    tokenId: string;
    name: string;
    price?: number;
  }>;
  height?: number;
  className?: string;
  showTimeSelector?: boolean;
  defaultTimeRange?: TimeRange;
}

export const OutcomeComparisonChart = memo(function OutcomeComparisonChart({
  outcomes,
  height = 200,
  className,
  showTimeSelector = true,
  defaultTimeRange = '24h',
}: OutcomeComparisonChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange);
  const config = TIME_RANGE_CONFIG[timeRange];

  const now = Math.floor(Date.now() / 1000);
  const startTs = useMemo(() => {
    const hourSeconds = 3600;
    const daySeconds = 86400;
    
    switch (timeRange) {
      case '1h': return now - hourSeconds;
      case '6h': return now - hourSeconds * 6;
      case '24h': return now - daySeconds;
      case '7d': return now - daySeconds * 7;
      default: return now - daySeconds;
    }
  }, [timeRange, now]);

  // Only use first two outcomes for comparison (team A vs team B)
  const comparisonOutcomes = outcomes.slice(0, 2).filter(o => o.tokenId);

  // Fetch price history for first outcome
  const outcome1Query = useQuery<PolymarketPriceHistoryPoint[], Error>({
    queryKey: ['polymarket', 'price-history', comparisonOutcomes[0]?.tokenId, timeRange],
    queryFn: () => getPriceHistory(comparisonOutcomes[0].tokenId, {
      interval: config.interval,
      startTs,
      endTs: now,
      fidelity: config.fidelity,
    }),
    staleTime: 60 * 1000,
    enabled: !!comparisonOutcomes[0]?.tokenId,
  });

  // Fetch price history for second outcome
  const outcome2Query = useQuery<PolymarketPriceHistoryPoint[], Error>({
    queryKey: ['polymarket', 'price-history', comparisonOutcomes[1]?.tokenId, timeRange],
    queryFn: () => getPriceHistory(comparisonOutcomes[1].tokenId, {
      interval: config.interval,
      startTs,
      endTs: now,
      fidelity: config.fidelity,
    }),
    staleTime: 60 * 1000,
    enabled: !!comparisonOutcomes[1]?.tokenId,
  });

  const isLoading = outcome1Query.isLoading || outcome2Query.isLoading;

  // Prepare chart data
  const chartConfig = useMemo(() => {
    const data1 = outcome1Query.data;
    const data2 = outcome2Query.data;

    // Need at least one series with data
    if ((!data1 || data1.length < 2) && (!data2 || data2.length < 2)) {
      return null;
    }

    // Use the longer dataset for timestamps
    const timestamps = (data1 && data1.length >= (data2?.length || 0))
      ? data1.map(p => new Date(p.t * 1000))
      : data2?.map(p => new Date(p.t * 1000)) || [];

    const seriesData: Array<{
      name: string;
      data: (number | null)[];
      color: string;
    }> = [];

    if (data1 && data1.length >= 2) {
      seriesData.push({
        name: comparisonOutcomes[0]?.name || 'Team 1',
        data: data1.map(p => p.p),
        color: chartColors.success, // Green for first team
      });
    }

    if (data2 && data2.length >= 2) {
      // Align data2 to the same timestamp length as data1
      const alignedData = data2.map(p => p.p);
      seriesData.push({
        name: comparisonOutcomes[1]?.name || 'Team 2',
        data: alignedData,
        color: chartColors.danger, // Red for second team
      });
    }

    if (timestamps.length === 0 || seriesData.length === 0) return null;

    return { timestamps, seriesData };
  }, [outcome1Query.data, outcome2Query.data, comparisonOutcomes]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          <span>Loading comparison...</span>
        </div>
      </div>
    );
  }

  if (!chartConfig) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-sm text-muted-foreground">
          No price history available for comparison
        </div>
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-2', className)}>
        {/* Header with legend and time selector */}
        <div className="flex items-center justify-between">
          {/* Legend */}
          <div className="flex items-center gap-3">
            {chartConfig.seriesData.map((series) => (
              <div key={series.name} className="flex items-center gap-1.5 text-xs">
                <div 
                  className="w-2.5 h-2.5 rounded-sm" 
                  style={{ backgroundColor: series.color }}
                />
                <span className="text-muted-foreground truncate max-w-[80px]">{series.name}</span>
              </div>
            ))}
          </div>

          {/* Time range selector */}
          {showTimeSelector && (
            <div className="flex gap-1">
              {(Object.keys(TIME_RANGE_CONFIG) as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-md transition-colors',
                    timeRange === range
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {TIME_RANGE_CONFIG[range].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ height }}>
          <LineChart
            xAxis={[{
              data: chartConfig.timestamps,
              scaleType: 'time',
              tickLabelStyle: { fontSize: 10 },
              valueFormatter: (value: Date) => format(value, config.tickFormat),
              tickNumber: 5,
            }]}
            yAxis={[{
              min: 0,
              max: 1,
              tickLabelStyle: {
                fontSize: 10,
                fontFamily: 'ui-monospace, monospace',
              },
              valueFormatter: (value: number) => formatPriceAsPercentage(value),
              tickNumber: 5,
            }]}
            series={chartConfig.seriesData.map(s => ({
              data: s.data,
              label: s.name,
              color: s.color,
              showMark: false,
              valueFormatter: (value: number | null) => 
                value !== null ? formatPriceAsPercentage(value) : '',
            }))}
            margin={{ left: 50, right: 10, top: 10, bottom: 25 }}
            hideLegend
            sx={{
              '& .MuiLineElement-root': {
                strokeWidth: 2,
              },
            }}
          />
        </div>

        {/* Current prices */}
        <div className="flex justify-between px-1 text-xs">
          {chartConfig.seriesData.map((series) => {
            const currentPrice = series.data[series.data.length - 1];
            return (
              <div key={series.name} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{series.name}:</span>
                <span 
                  className="font-mono font-medium"
                  style={{ color: series.color }}
                >
                  {currentPrice !== null ? formatPriceAsPercentage(currentPrice) : '-'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ChartThemeProvider>
  );
});

export const MultiOutcomePriceChart = memo(function MultiOutcomePriceChart({ market, height = 220, className }: MultiOutcomePriceChartProps) {
  const outcomes = market.market.outcomes;
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const config = TIME_RANGE_CONFIG[timeRange];

  const now = Math.floor(Date.now() / 1000);
  const startTs = useMemo(() => {
    const hourSeconds = 3600;
    const daySeconds = 86400;
    
    switch (timeRange) {
      case '1h': return now - hourSeconds;
      case '6h': return now - hourSeconds * 6;
      case '24h': return now - daySeconds;
      case '7d': return now - daySeconds * 7;
      default: return now - daySeconds;
    }
  }, [timeRange, now]);

  // Fetch price history for all outcomes
  const outcomeQueries = outcomes.map(outcome => 
    useQuery<PolymarketPriceHistoryPoint[], Error>({
      queryKey: ['polymarket', 'price-history', outcome.tokenId, timeRange],
      queryFn: () => getPriceHistory(outcome.tokenId, {
        interval: config.interval,
        startTs,
        endTs: now,
        fidelity: config.fidelity,
      }),
      staleTime: 60 * 1000,
      enabled: !!outcome.tokenId,
    })
  );

  const isLoading = outcomeQueries.some(q => q.isLoading);
  const hasData = outcomeQueries.some(q => q.data && q.data.length >= 2);

  // Prepare chart data
  const chartConfig = useMemo(() => {
    if (!hasData) return null;

    // Find the common timestamp range
    let allTimestamps: Date[] = [];
    const seriesData: Array<{
      name: string;
      data: (number | null)[];
      color: string;
    }> = [];

    outcomeQueries.forEach((query, index) => {
      const data = query.data;
      if (!data || data.length < 2) return;

      const timestamps = data.map(p => new Date(p.t * 1000));
      if (timestamps.length > allTimestamps.length) {
        allTimestamps = timestamps;
      }

      seriesData.push({
        name: outcomes[index].name,
        data: data.map(p => p.p),
        color: chartColors.series[index % chartColors.series.length],
      });
    });

    if (allTimestamps.length === 0 || seriesData.length === 0) return null;

    return { allTimestamps, seriesData };
  }, [outcomeQueries, outcomes, hasData]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          <span>Loading price comparison...</span>
        </div>
      </div>
    );
  }

  if (!chartConfig) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-sm text-muted-foreground">
          No price history available for comparison
        </div>
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-2', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Price Comparison</span>
          <div className="flex gap-1">
            {(Object.keys(TIME_RANGE_CONFIG) as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
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

        {/* Chart */}
        <div style={{ height }}>
          <LineChart
            xAxis={[{
              data: chartConfig.allTimestamps,
              scaleType: 'time',
              tickLabelStyle: { fontSize: 10 },
              valueFormatter: (value: Date) => format(value, config.tickFormat),
              tickNumber: 5,
            }]}
            yAxis={[{
              min: 0,
              max: 1,
              tickLabelStyle: {
                fontSize: 10,
                fontFamily: 'ui-monospace, monospace',
              },
              valueFormatter: (value: number) => formatPriceAsPercentage(value),
              tickNumber: 5,
            }]}
            series={chartConfig.seriesData.map(s => ({
              data: s.data,
              label: s.name,
              color: s.color,
              showMark: false,
              valueFormatter: (value: number | null) => 
                value !== null ? formatPriceAsPercentage(value) : '',
            }))}
            margin={{ left: 50, right: 10, top: 10, bottom: 25 }}
            slotProps={{
              legend: {
                direction: 'horizontal',
                position: { vertical: 'bottom', horizontal: 'center' },
              },
            }}
            sx={{
              '& .MuiLineElement-root': {
                strokeWidth: 2,
              },
            }}
          />
        </div>

        {/* Current prices */}
        <div className="flex flex-wrap gap-3 justify-center">
          {chartConfig.seriesData.map((series) => {
            const currentPrice = series.data[series.data.length - 1];
            return (
              <div key={series.name} className="flex items-center gap-1.5 text-xs">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: series.color }}
                />
                <span className="text-muted-foreground">{series.name}:</span>
                <span className="font-mono font-medium">
                  {currentPrice !== null ? formatPriceAsPercentage(currentPrice) : '-'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ChartThemeProvider>
  );
});

export default PriceLineChart;
