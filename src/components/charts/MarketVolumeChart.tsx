/**
 * Market Volume Chart Component
 * Visualizes Polymarket volume, liquidity, and market analytics
 */

import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { ChartThemeProvider, chartColors } from './ChartThemeProvider';
import type { PolymarketSportsMarket } from '@/types';
import { formatPriceAsPercentage } from '@/types';
import { TrendingUp, DollarSign, Droplets, Activity } from 'lucide-react';

/**
 * Format large numbers for display
 */
function formatVolume(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

interface MarketVolumeChartProps {
  markets: PolymarketSportsMarket[];
  className?: string;
  height?: number;
  maxMarkets?: number;
}

/**
 * Bar chart showing volume comparison across markets
 */
export function MarketVolumeChart({
  markets,
  className,
  height = 250,
  maxMarkets = 8,
}: MarketVolumeChartProps) {
  const chartData = useMemo(() => {
    // Sort by volume and take top markets
    const sorted = [...markets]
      .filter(m => m.market.volume > 0)
      .sort((a, b) => b.market.volume - a.market.volume)
      .slice(0, maxMarkets);

    if (sorted.length === 0) return null;

    const dataset = sorted.map(m => ({
      label: m.eventTitle.slice(0, 25) || m.market.question.slice(0, 25),
      volume: m.market.volume,
      volume24h: m.market.volume24h,
      liquidity: m.market.liquidity,
      market: m,
    }));

    return { dataset };
  }, [markets, maxMarkets]);

  if (!chartData || chartData.dataset.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-sm text-muted-foreground', className)}>
        No market volume data available
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-3', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Market Volume Comparison</h4>
          <span className="text-xs text-muted-foreground">
            Top {chartData.dataset.length} markets
          </span>
        </div>

        {/* Bar Chart */}
        <div style={{ height }}>
          <BarChart
            dataset={chartData.dataset}
            yAxis={[{
              scaleType: 'band',
              dataKey: 'label',
              tickLabelStyle: {
                fontSize: 10,
              },
            }]}
            xAxis={[{
              tickLabelStyle: { fontSize: 9 },
              valueFormatter: (value: number) => formatVolume(value),
            }]}
            series={[
              {
                dataKey: 'volume',
                label: 'Total Volume',
                color: chartColors.primary,
                valueFormatter: (value: number | null) => 
                  value !== null ? formatVolume(value) : '-',
              },
              {
                dataKey: 'volume24h',
                label: '24h Volume',
                color: chartColors.secondary,
                valueFormatter: (value: number | null) => 
                  value !== null ? formatVolume(value) : '-',
              },
            ]}
            layout="horizontal"
            margin={{ left: 100, right: 10, top: 30, bottom: 20 }}
            slotProps={{
              legend: {
                direction: 'vertical',
                position: { vertical: 'top', horizontal: 'end' },
              },
            }}
            sx={{
              '& .MuiBarElement-root': {
                rx: 2,
              },
            }}
          />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Total Volume"
            value={formatVolume(chartData.dataset.reduce((sum, d) => sum + d.volume, 0))}
          />
          <SummaryCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="24h Volume"
            value={formatVolume(chartData.dataset.reduce((sum, d) => sum + d.volume24h, 0))}
          />
          <SummaryCard
            icon={<Droplets className="h-4 w-4" />}
            label="Total Liquidity"
            value={formatVolume(chartData.dataset.reduce((sum, d) => sum + d.liquidity, 0))}
          />
        </div>
      </div>
    </ChartThemeProvider>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
      <div className="text-primary">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-sm font-mono font-medium">{value}</span>
      </div>
    </div>
  );
}

/**
 * Market outcome distribution pie chart
 */
interface OutcomeDistributionChartProps {
  market: PolymarketSportsMarket;
  className?: string;
  size?: number;
}

export function OutcomeDistributionChart({
  market,
  className,
  size = 180,
}: OutcomeDistributionChartProps) {
  const chartData = useMemo(() => {
    const outcomes = market.market.outcomes;
    if (outcomes.length === 0) return null;

    const data = outcomes.map((outcome, index) => ({
      id: index,
      value: outcome.price * 100,
      label: outcome.name,
      color: chartColors.series[index % chartColors.series.length],
    }));

    return data;
  }, [market]);

  if (!chartData) {
    return (
      <div className={cn('flex items-center justify-center py-4 text-sm text-muted-foreground', className)}>
        No outcome data
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-2', className)}>
        <h4 className="text-xs font-medium text-muted-foreground">Outcome Probabilities</h4>
        
        <div className="flex items-center gap-4">
          {/* Pie Chart */}
          <div style={{ width: size, height: size }}>
            <PieChart
              series={[{
                data: chartData,
                innerRadius: 30,
                outerRadius: size / 2 - 10,
                paddingAngle: 2,
                cornerRadius: 3,
                highlightScope: { fade: 'global', highlight: 'item' },
                valueFormatter: (value) => `${value.value.toFixed(1)}%`,
              }]}
              width={size}
              height={size}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              slotProps={{
                legend: { 
                  direction: 'vertical',
                  position: { vertical: 'middle', horizontal: 'end' },
                },
              }}
            />
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2">
            {chartData.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {item.value.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ChartThemeProvider>
  );
}

/**
 * Market metrics summary card
 */
interface MarketMetricsCardProps {
  market: PolymarketSportsMarket;
  className?: string;
}

export function MarketMetricsCard({ market, className }: MarketMetricsCardProps) {
  const metrics = useMemo(() => {
    const m = market.market;
    return {
      volume: m.volume,
      volume24h: m.volume24h,
      liquidity: m.liquidity,
      openInterest: m.openInterest,
      spread: m.spread ?? null,
      bestBid: m.bestBid ?? null,
      bestAsk: m.bestAsk ?? null,
    };
  }, [market]);

  const volumeChange = metrics.volume > 0 
    ? ((metrics.volume24h / metrics.volume) * 100).toFixed(1)
    : '0';

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-3 p-3 rounded-lg bg-card border border-border', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Market Metrics</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
            Active
          </span>
        </div>

        {/* Main metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricItem
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Total Volume"
            value={formatVolume(metrics.volume)}
          />
          <MetricItem
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="24h Volume"
            value={formatVolume(metrics.volume24h)}
            subValue={`${volumeChange}% of total`}
          />
          <MetricItem
            icon={<Droplets className="h-3.5 w-3.5" />}
            label="Liquidity"
            value={formatVolume(metrics.liquidity)}
          />
          <MetricItem
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Open Interest"
            value={formatNumber(metrics.openInterest)}
          />
        </div>

        {/* Pricing info */}
        {(metrics.bestBid !== null || metrics.bestAsk !== null) && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-4 text-xs">
              {metrics.bestBid !== null && (
                <span>
                  <span className="text-muted-foreground">Bid:</span>{' '}
                  <span className="text-green-400 font-mono">
                    {formatPriceAsPercentage(metrics.bestBid)}
                  </span>
                </span>
              )}
              {metrics.bestAsk !== null && (
                <span>
                  <span className="text-muted-foreground">Ask:</span>{' '}
                  <span className="text-red-400 font-mono">
                    {formatPriceAsPercentage(metrics.bestAsk)}
                  </span>
                </span>
              )}
            </div>
            {metrics.spread !== null && (
              <span className="text-xs">
                <span className="text-muted-foreground">Spread:</span>{' '}
                <span className="font-mono">{(metrics.spread * 100).toFixed(1)}¢</span>
              </span>
            )}
          </div>
        )}
      </div>
    </ChartThemeProvider>
  );
}

function MetricItem({ 
  icon, 
  label, 
  value, 
  subValue 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  subValue?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-primary mt-0.5">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-sm font-mono font-medium">{value}</span>
        {subValue && (
          <span className="text-[10px] text-muted-foreground">{subValue}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Multi-market liquidity comparison
 */
interface LiquidityComparisonProps {
  markets: PolymarketSportsMarket[];
  className?: string;
  maxMarkets?: number;
}

export function LiquidityComparison({
  markets,
  className,
  maxMarkets = 6,
}: LiquidityComparisonProps) {
  const data = useMemo(() => {
    const sorted = [...markets]
      .filter(m => m.market.liquidity > 0)
      .sort((a, b) => b.market.liquidity - a.market.liquidity)
      .slice(0, maxMarkets);

    if (sorted.length === 0) return null;

    const totalLiquidity = sorted.reduce((sum, m) => sum + m.market.liquidity, 0);

    return sorted.map((m, index) => {
      const liquidity = m.market.liquidity;
      return {
        market: m,
        liquidity,
        percentage: totalLiquidity > 0 ? (liquidity / totalLiquidity) * 100 : 0,
        label: m.eventTitle.slice(0, 25) || m.market.question.slice(0, 25),
        color: chartColors.series[index % chartColors.series.length],
      };
    });
  }, [markets, maxMarkets]);

  if (!data) {
    return (
      <div className={cn('flex items-center justify-center py-4 text-sm text-muted-foreground', className)}>
        No liquidity data available
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-3', className)}>
        <h4 className="text-sm font-medium">Liquidity Distribution</h4>
        
        <div className="flex flex-col gap-2">
          {data.map((item) => (
            <div key={item.market.market.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[180px]">{item.label}</span>
                <span className="font-mono text-muted-foreground">
                  {formatVolume(item.liquidity)}
                </span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
          <span className="text-muted-foreground">Total Liquidity</span>
          <span className="font-mono font-medium">
            {formatVolume(data.reduce((sum, d) => sum + d.liquidity, 0))}
          </span>
        </div>
      </div>
    </ChartThemeProvider>
  );
}

export default MarketVolumeChart;
