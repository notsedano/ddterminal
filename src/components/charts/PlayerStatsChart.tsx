/**
 * Player Stats Chart Component
 * Visualizes NBA player statistics using MUI X Charts
 */

import { BarChart } from '@mui/x-charts/BarChart';
import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { ChartThemeProvider, chartColors } from './ChartThemeProvider';
import type { NBAPlayerStats, NBAPlayerStatistics } from '@/types';

/**
 * Stat category configuration
 */
interface StatCategory {
  key: keyof NBAPlayerStatistics;
  label: string;
  shortLabel: string;
  color: string;
  format: (value: number) => string;
}

const STAT_CATEGORIES: StatCategory[] = [
  { key: 'points', label: 'Points', shortLabel: 'PTS', color: chartColors.primary, format: v => v.toString() },
  { key: 'rebounds', label: 'Rebounds', shortLabel: 'REB', color: chartColors.secondary, format: v => v.toString() },
  { key: 'assists', label: 'Assists', shortLabel: 'AST', color: chartColors.tertiary, format: v => v.toString() },
  { key: 'steals', label: 'Steals', shortLabel: 'STL', color: chartColors.quaternary, format: v => v.toString() },
  { key: 'blocks', label: 'Blocks', shortLabel: 'BLK', color: chartColors.quinary, format: v => v.toString() },
  { key: 'turnovers', label: 'Turnovers', shortLabel: 'TO', color: chartColors.danger, format: v => v.toString() },
];

const SHOOTING_CATEGORIES: StatCategory[] = [
  { key: 'field_goals_pct', label: 'Field Goal %', shortLabel: 'FG%', color: chartColors.primary, format: v => `${(v * 100).toFixed(1)}%` },
  { key: 'three_points_pct', label: '3-Point %', shortLabel: '3P%', color: chartColors.secondary, format: v => `${(v * 100).toFixed(1)}%` },
  { key: 'free_throws_pct', label: 'Free Throw %', shortLabel: 'FT%', color: chartColors.tertiary, format: v => `${(v * 100).toFixed(1)}%` },
];

interface PlayerStatsChartProps {
  players: NBAPlayerStats[];
  className?: string;
  height?: number;
  maxPlayers?: number;
  statType?: 'counting' | 'shooting';
}

/**
 * Bar chart comparing player statistics
 */
export function PlayerStatsChart({
  players,
  className,
  height = 300,
  maxPlayers = 6,
  statType = 'counting',
}: PlayerStatsChartProps) {
  const categories = statType === 'shooting' ? SHOOTING_CATEGORIES : STAT_CATEGORIES;

  // Filter and prepare player data
  const chartData = useMemo(() => {
    // Filter players with statistics who played
    const playersWithStats = players
      .filter(p => p.played && p.statistics)
      .sort((a, b) => (b.statistics?.points ?? 0) - (a.statistics?.points ?? 0))
      .slice(0, maxPlayers);

    if (playersWithStats.length === 0) return null;

    // Create dataset for bar chart
    const dataset = playersWithStats.map(player => {
      const stats = player.statistics!;
      const dataPoint: Record<string, string | number> = {
        player: player.full_name.split(' ').pop() ?? player.full_name, // Last name only
        fullName: player.full_name,
      };

      for (const cat of categories) {
        const value = stats[cat.key];
        dataPoint[cat.key] = typeof value === 'number' ? value : 0;
      }

      return dataPoint;
    });

    return { dataset, players: playersWithStats };
  }, [players, maxPlayers, categories]);

  if (!chartData || chartData.dataset.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-sm text-muted-foreground', className)}>
        No player statistics available
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-3', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">
            {statType === 'shooting' ? 'Shooting Percentages' : 'Player Statistics'}
          </h4>
          <span className="text-xs text-muted-foreground">
            Top {chartData.players.length} players by points
          </span>
        </div>

        {/* Bar Chart */}
        <div style={{ height }}>
          <BarChart
            dataset={chartData.dataset}
            xAxis={[{
              scaleType: 'band',
              dataKey: 'player',
              tickLabelStyle: {
                fontSize: 10,
                angle: -45,
                textAnchor: 'end',
              },
            }]}
            yAxis={[{
              tickLabelStyle: {
                fontSize: 10,
              },
              valueFormatter: statType === 'shooting' 
                ? (value: number) => `${(value * 100).toFixed(0)}%`
                : (value: number) => value.toString(),
            }]}
            series={categories.map(cat => ({
              dataKey: cat.key,
              label: cat.shortLabel,
              color: cat.color,
              valueFormatter: (value: number | null) => 
                value !== null ? cat.format(value) : '-',
            }))}
            margin={{ left: 40, right: 10, top: 20, bottom: 50 }}
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

        {/* Stats Table (compact) */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 px-2 text-left text-muted-foreground font-medium">Player</th>
                {categories.map(cat => (
                  <th key={cat.key} className="py-1 px-2 text-center text-muted-foreground font-medium">
                    {cat.shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartData.players.map((player, index) => (
                <tr 
                  key={player.id} 
                  className={cn(
                    'border-b border-border/50',
                    index === 0 && 'bg-primary/5'
                  )}
                >
                  <td className="py-1.5 px-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      {player.jersey_number && (
                        <span className="text-muted-foreground">#{player.jersey_number}</span>
                      )}
                      <span>{player.full_name}</span>
                      {player.starter && (
                        <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">S</span>
                      )}
                    </div>
                  </td>
                  {categories.map(cat => {
                    const value = player.statistics?.[cat.key];
                    return (
                      <td key={cat.key} className="py-1.5 px-2 text-center font-mono">
                        {typeof value === 'number' ? cat.format(value) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartThemeProvider>
  );
}

/**
 * Single player radar/profile chart
 */
interface PlayerProfileChartProps {
  player: NBAPlayerStats;
  className?: string;
}

export function PlayerProfileCard({ player, className }: PlayerProfileChartProps) {
  const stats = player.statistics;

  if (!stats) {
    return (
      <div className={cn('flex items-center justify-center py-4 text-sm text-muted-foreground', className)}>
        No statistics available
      </div>
    );
  }

  // Calculate normalized values for visualization (0-100 scale based on typical max values)
  const normalizedStats = [
    { label: 'PTS', value: stats.points, max: 50, normalized: Math.min(100, (stats.points / 50) * 100) },
    { label: 'REB', value: stats.rebounds, max: 20, normalized: Math.min(100, (stats.rebounds / 20) * 100) },
    { label: 'AST', value: stats.assists, max: 15, normalized: Math.min(100, (stats.assists / 15) * 100) },
    { label: 'STL', value: stats.steals, max: 5, normalized: Math.min(100, (stats.steals / 5) * 100) },
    { label: 'BLK', value: stats.blocks, max: 5, normalized: Math.min(100, (stats.blocks / 5) * 100) },
  ];

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-3 p-3 rounded-lg bg-card border border-border', className)}>
        {/* Player header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
            {player.jersey_number ?? '#'}
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{player.full_name}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{player.position}</span>
              {player.starter && <span className="text-primary">• Starter</span>}
              {player.on_court && <span className="text-green-400">• On Court</span>}
            </div>
          </div>
        </div>

        {/* Stats visualization */}
        <div className="flex flex-col gap-2">
          {normalizedStats.map(stat => (
            <div key={stat.label} className="flex items-center gap-2">
              <span className="w-8 text-xs text-muted-foreground font-medium">{stat.label}</span>
              <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${stat.normalized}%` }}
                />
              </div>
              <span className="w-8 text-xs font-mono font-medium text-right">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Shooting stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <ShootingStat
            label="FG%"
            made={stats.field_goals_made}
            attempted={stats.field_goals_att}
            percentage={stats.field_goals_pct}
          />
          <ShootingStat
            label="3P%"
            made={stats.three_points_made}
            attempted={stats.three_points_att}
            percentage={stats.three_points_pct}
          />
          <ShootingStat
            label="FT%"
            made={stats.free_throws_made}
            attempted={stats.free_throws_att}
            percentage={stats.free_throws_pct}
          />
        </div>

        {/* Minutes and +/- */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <span>Minutes: <span className="font-mono font-medium text-foreground">{stats.minutes}</span></span>
          {stats.plus_minus !== undefined && (
            <span>
              +/-: <span className={cn(
                'font-mono font-medium',
                stats.plus_minus > 0 ? 'text-green-400' : stats.plus_minus < 0 ? 'text-red-400' : 'text-foreground'
              )}>
                {stats.plus_minus > 0 ? '+' : ''}{stats.plus_minus}
              </span>
            </span>
          )}
        </div>
      </div>
    </ChartThemeProvider>
  );
}

function ShootingStat({ 
  label, 
  made, 
  attempted, 
  percentage 
}: { 
  label: string; 
  made: number; 
  attempted: number; 
  percentage: number;
}) {
  const pctDisplay = (percentage * 100).toFixed(1);
  const isGood = percentage >= 0.5;
  const isPoor = percentage < 0.35 && attempted > 0;

  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn(
        'text-sm font-mono font-medium',
        isGood ? 'text-green-400' : isPoor ? 'text-red-400' : 'text-foreground'
      )}>
        {pctDisplay}%
      </span>
      <span className="text-[10px] text-muted-foreground">
        {made}/{attempted}
      </span>
    </div>
  );
}

/**
 * Compact player stats row for lists
 */
interface PlayerStatsRowProps {
  player: NBAPlayerStats;
  rank?: number;
  className?: string;
}

export function PlayerStatsRow({ player, rank, className }: PlayerStatsRowProps) {
  const stats = player.statistics;

  return (
    <div className={cn(
      'flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors',
      className
    )}>
      {rank !== undefined && (
        <span className="w-5 text-sm font-medium text-muted-foreground">{rank}</span>
      )}
      
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-xs text-muted-foreground">#{player.jersey_number ?? '-'}</span>
        <span className="font-medium truncate">{player.full_name}</span>
        {player.starter && (
          <span className="text-[9px] bg-primary/20 text-primary px-1 rounded shrink-0">S</span>
        )}
      </div>

      {stats && (
        <div className="flex items-center gap-4 text-xs">
          <StatBadge label="PTS" value={stats.points} highlight />
          <StatBadge label="REB" value={stats.rebounds} />
          <StatBadge label="AST" value={stats.assists} />
          <span className="text-muted-foreground font-mono">{stats.minutes}</span>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1',
      highlight && 'text-primary'
    )}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

export default PlayerStatsChart;
