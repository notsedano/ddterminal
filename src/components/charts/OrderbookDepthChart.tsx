/**
 * Orderbook Depth Chart Component
 * Visualizes bid/ask depth using MUI X Charts horizontal bar chart
 */

import { BarChart } from '@mui/x-charts/BarChart';
import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { ChartThemeProvider, chartColors } from './ChartThemeProvider';
import type { AggregatedLevel, OrderbookDisplayMetrics } from '@/hooks/usePolymarketOrderbook';
import { formatSpreadDisplay, formatDepthDisplay, getImbalanceIndicator } from '@/hooks/usePolymarketOrderbook';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface OrderbookDepthChartProps {
  bids: AggregatedLevel[];
  asks: AggregatedLevel[];
  metrics: OrderbookDisplayMetrics | null;
  className?: string;
  height?: number;
  showMetrics?: boolean;
  showImbalance?: boolean;
}

/**
 * MUI X Charts orderbook depth visualization
 * Displays bid/ask levels as horizontal stacked bars
 */
export function OrderbookDepthChart({
  bids,
  asks,
  metrics,
  className,
  height = 200,
  showMetrics = true,
  showImbalance = true,
}: OrderbookDepthChartProps) {
  // Transform data for the chart - we show bids going left, asks going right
  const chartData = useMemo(() => {
    if (bids.length === 0 && asks.length === 0) return null;

    // Get top 8 levels from each side
    const topBids = bids.slice(0, 8);
    const topAsks = asks.slice(0, 8);
    
    // Find max depth for normalization
    const maxBidTotal = topBids.length > 0 ? Math.max(...topBids.map(b => b.total)) : 0;
    const maxAskTotal = topAsks.length > 0 ? Math.max(...topAsks.map(a => a.total)) : 0;
    const maxTotal = Math.max(maxBidTotal, maxAskTotal);

    // Create price levels combining both sides
    // We show the spread in the middle
    const levels: Array<{
      price: string;
      priceNum: number;
      bidDepth: number;
      askDepth: number;
      bidSize: number;
      askSize: number;
    }> = [];

    // Add ask levels (reversed so highest is at top)
    for (let i = topAsks.length - 1; i >= 0; i--) {
      const ask = topAsks[i];
      levels.push({
        price: `$${ask.price.toFixed(2)}`,
        priceNum: ask.price,
        bidDepth: 0,
        askDepth: maxTotal > 0 ? (ask.total / maxTotal) * 100 : 0,
        bidSize: 0,
        askSize: ask.size,
      });
    }

      // Add spread marker if we have both sides
      if (topBids.length > 0 && topAsks.length > 0 && metrics && metrics.spread !== null) {
        levels.push({
          price: `Spread: ${formatSpreadDisplay(metrics.spread)}`,
          priceNum: (topBids[0].price + topAsks[0].price) / 2,
          bidDepth: 0,
          askDepth: 0,
          bidSize: 0,
          askSize: 0,
        });
      }

    // Add bid levels
    for (const bid of topBids) {
      levels.push({
        price: `$${bid.price.toFixed(2)}`,
        priceNum: bid.price,
        bidDepth: maxTotal > 0 ? (bid.total / maxTotal) * 100 : 0,
        askDepth: 0,
        bidSize: bid.size,
        askSize: 0,
      });
    }

    return { levels, maxTotal };
  }, [bids, asks, metrics]);

  if (!chartData || chartData.levels.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-sm text-muted-foreground', className)}>
        No orderbook data available
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-3', className)}>
        {/* Metrics Header */}
        {showMetrics && metrics && <OrderbookMetricsHeader metrics={metrics} />}

        {/* Depth Chart */}
        <div style={{ height }}>
          <BarChart
            dataset={chartData.levels}
            yAxis={[{
              scaleType: 'band',
              dataKey: 'price',
              tickLabelStyle: {
                fontSize: 10,
                fontFamily: 'ui-monospace, monospace',
              },
            }]}
            xAxis={[{
              min: 0,
              max: 100,
              tickNumber: 5,
              tickLabelStyle: {
                fontSize: 9,
              },
              valueFormatter: (value: number) => `${value.toFixed(0)}%`,
            }]}
            series={[
              {
                dataKey: 'bidDepth',
                label: 'Bids',
                color: chartColors.bid,
                valueFormatter: (value: number | null, { dataIndex }) => {
                  if (value === null || value === 0) return '';
                  const level = chartData.levels[dataIndex];
                  return `${formatDepthDisplay(level.bidSize)} @ ${level.price}`;
                },
              },
              {
                dataKey: 'askDepth',
                label: 'Asks',
                color: chartColors.ask,
                valueFormatter: (value: number | null, { dataIndex }) => {
                  if (value === null || value === 0) return '';
                  const level = chartData.levels[dataIndex];
                  return `${formatDepthDisplay(level.askSize)} @ ${level.price}`;
                },
              },
            ]}
            layout="horizontal"
            margin={{ left: 65, right: 10, top: 10, bottom: 25 }}
            hideLegend
            sx={{
              '& .MuiBarElement-root': {
                rx: 2,
              },
            }}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.bid }} />
            <span className="text-muted-foreground">Bids (Buy)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.ask }} />
            <span className="text-muted-foreground">Asks (Sell)</span>
          </div>
        </div>

        {/* Imbalance Indicator */}
        {showImbalance && metrics && <ImbalanceBar imbalance={metrics.imbalance} />}
      </div>
    </ChartThemeProvider>
  );
}

/**
 * Orderbook metrics header display
 */
function OrderbookMetricsHeader({ metrics }: { metrics: OrderbookDisplayMetrics }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      <MetricCell
        label="Best Bid"
        value={metrics.bestBid !== null ? `$${metrics.bestBid.toFixed(2)}` : '-'}
        valueClassName="text-green-400"
      />
      <MetricCell
        label="Spread"
        value={formatSpreadDisplay(metrics.spread)}
      />
      <MetricCell
        label="Best Ask"
        value={metrics.bestAsk !== null ? `$${metrics.bestAsk.toFixed(2)}` : '-'}
        valueClassName="text-red-400"
      />
      <MetricCell
        label="Midpoint"
        value={metrics.midpoint !== null ? `$${metrics.midpoint.toFixed(2)}` : '-'}
        valueClassName="text-blue-400"
      />
    </div>
  );
}

function MetricCell({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn('text-sm font-mono font-medium', valueClassName)}>{value}</span>
    </div>
  );
}

/**
 * Imbalance indicator bar
 */
function ImbalanceBar({ imbalance }: { imbalance: number }) {
  const indicator = getImbalanceIndicator(imbalance);
  const percentage = ((imbalance + 1) / 2) * 100; // Convert -1..1 to 0..100
  
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-red-400" />
          <span>Selling Pressure</span>
        </div>
        <span className="font-medium">Order Flow Imbalance</span>
        <div className="flex items-center gap-1">
          <span>Buying Pressure</span>
          <TrendingUp className="h-3 w-3 text-green-400" />
        </div>
      </div>
      <div className="relative h-2.5 rounded-full bg-muted/50 overflow-hidden">
        {/* Gradient background */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'linear-gradient(to right, #ef4444, #6b7280, #22c55e)',
          }}
        />
        
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
        
        {/* Imbalance indicator */}
        <div
          className={cn(
            'absolute top-0.5 bottom-0.5 w-3 rounded-full transition-all duration-300 shadow-sm',
            indicator === 'bid' ? 'bg-green-500' : indicator === 'ask' ? 'bg-red-500' : 'bg-muted-foreground'
          )}
          style={{ left: `calc(${percentage}% - 6px)` }}
        />
      </div>
      
      {/* Imbalance percentage */}
      <div className="flex justify-center">
        <span className={cn(
          'text-[10px] font-medium px-2 py-0.5 rounded',
          indicator === 'bid' 
            ? 'bg-green-500/10 text-green-400' 
            : indicator === 'ask' 
              ? 'bg-red-500/10 text-red-400' 
              : 'bg-muted text-muted-foreground'
        )}>
          {imbalance > 0 ? '+' : ''}{(imbalance * 100).toFixed(1)}% 
          {indicator === 'bid' ? ' Buy' : indicator === 'ask' ? ' Sell' : ' Neutral'}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact orderbook depth summary
 */
interface CompactOrderbookSummaryProps {
  bidDepth: number;
  askDepth: number;
  spread: number | null;
  className?: string;
}

export function CompactOrderbookSummary({ bidDepth, askDepth, spread, className }: CompactOrderbookSummaryProps) {
  const total = bidDepth + askDepth;
  const bidPercentage = total > 0 ? (bidDepth / total) * 100 : 50;

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-2', className)}>
        {/* Depth bar */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="text-green-400">Bids: {formatDepthDisplay(bidDepth)}</span>
            {spread !== null && (
              <span>Spread: {formatSpreadDisplay(spread)}</span>
            )}
            <span className="text-red-400">Asks: {formatDepthDisplay(askDepth)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-muted/30">
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
      </div>
    </ChartThemeProvider>
  );
}

export default OrderbookDepthChart;
