/**
 * Team Comparison Chart Component
 * Visualizes team vs team statistics using MUI X Charts
 */

import { BarChart } from '@mui/x-charts/BarChart';
import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { ChartThemeProvider, chartColors } from './ChartThemeProvider';
import { TeamLogo } from '@/components/TeamLogo';
import type { NBABoxscoreTeam, NBATeamStatistics, MatchPanelGame } from '@/types';

/**
 * Team stat configuration for comparison
 */
interface TeamStatConfig {
  key: keyof NBATeamStatistics;
  label: string;
  shortLabel: string;
  format: (value: number) => string;
  higherIsBetter: boolean;
}

const TEAM_STATS: TeamStatConfig[] = [
  { key: 'points', label: 'Points', shortLabel: 'PTS', format: v => v.toString(), higherIsBetter: true },
  { key: 'field_goals_pct', label: 'Field Goal %', shortLabel: 'FG%', format: v => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
  { key: 'three_points_pct', label: '3-Point %', shortLabel: '3P%', format: v => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
  { key: 'free_throws_pct', label: 'Free Throw %', shortLabel: 'FT%', format: v => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
  { key: 'rebounds', label: 'Rebounds', shortLabel: 'REB', format: v => v.toString(), higherIsBetter: true },
  { key: 'assists', label: 'Assists', shortLabel: 'AST', format: v => v.toString(), higherIsBetter: true },
  { key: 'steals', label: 'Steals', shortLabel: 'STL', format: v => v.toString(), higherIsBetter: true },
  { key: 'blocks', label: 'Blocks', shortLabel: 'BLK', format: v => v.toString(), higherIsBetter: true },
  { key: 'turnovers', label: 'Turnovers', shortLabel: 'TO', format: v => v.toString(), higherIsBetter: false },
];

interface TeamComparisonChartProps {
  homeTeam: NBABoxscoreTeam;
  awayTeam: NBABoxscoreTeam;
  className?: string;
  height?: number;
  showTable?: boolean;
}

/**
 * Horizontal bar chart comparing two teams
 */
export function TeamComparisonChart({
  homeTeam,
  awayTeam,
  className,
  height = 350,
  showTable = true,
}: TeamComparisonChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    const homeStats = homeTeam.statistics;
    const awayStats = awayTeam.statistics;

    if (!homeStats || !awayStats) return null;

    const dataset = TEAM_STATS.map(stat => {
      const homeValue = homeStats[stat.key];
      const awayValue = awayStats[stat.key];

      // For percentages, we display as-is (0-1 scale)
      // For counting stats, normalize to 0-100 scale for visual comparison
      const isPercentage = stat.key.includes('pct');
      const maxValue = isPercentage ? 1 : Math.max(
        typeof homeValue === 'number' ? homeValue : 0,
        typeof awayValue === 'number' ? awayValue : 0
      );
      const scale = isPercentage ? 100 : (maxValue > 0 ? 100 / maxValue : 1);

      return {
        stat: stat.shortLabel,
        fullLabel: stat.label,
        home: typeof homeValue === 'number' ? homeValue * scale : 0,
        homeRaw: typeof homeValue === 'number' ? homeValue : 0,
        away: typeof awayValue === 'number' ? awayValue * scale : 0,
        awayRaw: typeof awayValue === 'number' ? awayValue : 0,
        config: stat,
      };
    });

    return { dataset, homeStats, awayStats };
  }, [homeTeam, awayTeam]);

  if (!chartData) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-sm text-muted-foreground', className)}>
        No team statistics available
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-4', className)}>
        {/* Team Headers */}
        <div className="flex items-center justify-between px-2">
          <TeamBadge team={awayTeam} side="away" />
          <span className="text-xs text-muted-foreground font-medium">Team Comparison</span>
          <TeamBadge team={homeTeam} side="home" />
        </div>

        {/* Bar Chart */}
        <div style={{ height }}>
          <BarChart
            dataset={chartData.dataset}
            yAxis={[{
              scaleType: 'band',
              dataKey: 'stat',
              tickLabelStyle: {
                fontSize: 10,
                fontFamily: 'ui-monospace, monospace',
              },
            }]}
            xAxis={[{
              min: 0,
              max: 100,
              tickNumber: 5,
              tickLabelStyle: { fontSize: 9 },
            }]}
            series={[
              {
                dataKey: 'away',
                label: `${awayTeam.market} ${awayTeam.name}`,
                color: chartColors.primary,
                valueFormatter: (_, { dataIndex }) => {
                  const item = chartData.dataset[dataIndex];
                  return item.config.format(item.awayRaw);
                },
              },
              {
                dataKey: 'home',
                label: `${homeTeam.market} ${homeTeam.name}`,
                color: chartColors.danger,
                valueFormatter: (_, { dataIndex }) => {
                  const item = chartData.dataset[dataIndex];
                  return item.config.format(item.homeRaw);
                },
              },
            ]}
            layout="horizontal"
            margin={{ left: 45, right: 10, top: 30, bottom: 20 }}
            slotProps={{
              legend: {
                direction: 'horizontal',
                position: { vertical: 'top', horizontal: 'center' },
              },
            }}
            sx={{
              '& .MuiBarElement-root': {
                rx: 2,
              },
            }}
          />
        </div>

        {/* Stats Table */}
        {showTable && (
          <StatsComparisonTable
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeStats={chartData.homeStats}
            awayStats={chartData.awayStats}
          />
        )}
      </div>
    </ChartThemeProvider>
  );
}

function TeamBadge({ team, side }: { team: NBABoxscoreTeam; side: 'home' | 'away' }) {
  return (
    <div className={cn(
      'flex items-center gap-2',
      side === 'home' ? 'flex-row-reverse' : ''
    )}>
      <TeamLogo alias={team.alias} size={40} className="w-10 h-10" />
      <div className={cn('flex flex-col', side === 'home' ? 'items-end' : '')}>
        <span className="text-sm font-medium">{team.market}</span>
        <span className="text-xs text-muted-foreground">{team.name}</span>
      </div>
    </div>
  );
}

function StatsComparisonTable({
  homeTeam,
  awayTeam,
  homeStats,
  awayStats,
}: {
  homeTeam: NBABoxscoreTeam;
  awayTeam: NBABoxscoreTeam;
  homeStats: NBATeamStatistics;
  awayStats: NBATeamStatistics;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 px-3 text-right font-medium text-blue-400">{awayTeam.alias}</th>
            <th className="py-2 px-3 text-center font-medium text-muted-foreground">Stat</th>
            <th className="py-2 px-3 text-left font-medium text-red-400">{homeTeam.alias}</th>
          </tr>
        </thead>
        <tbody>
          {TEAM_STATS.map(stat => {
            const homeValue = homeStats[stat.key];
            const awayValue = awayStats[stat.key];
            const homeNum = typeof homeValue === 'number' ? homeValue : 0;
            const awayNum = typeof awayValue === 'number' ? awayValue : 0;
            
            const homeWins = stat.higherIsBetter ? homeNum > awayNum : homeNum < awayNum;
            const awayWins = stat.higherIsBetter ? awayNum > homeNum : awayNum < homeNum;

            return (
              <tr key={stat.key} className="border-b border-border/50">
                <td className={cn(
                  'py-2 px-3 text-right font-mono',
                  awayWins && 'font-bold text-blue-400'
                )}>
                  {typeof awayValue === 'number' ? stat.format(awayValue) : '-'}
                </td>
                <td className="py-2 px-3 text-center text-muted-foreground">
                  {stat.label}
                </td>
                <td className={cn(
                  'py-2 px-3 text-left font-mono',
                  homeWins && 'font-bold text-red-400'
                )}>
                  {typeof homeValue === 'number' ? stat.format(homeValue) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Quarter-by-quarter scoring chart
 */
interface QuarterScoringChartProps {
  homeTeam: NBABoxscoreTeam;
  awayTeam: NBABoxscoreTeam;
  className?: string;
  height?: number;
}

export function QuarterScoringChart({
  homeTeam,
  awayTeam,
  className,
  height = 200,
}: QuarterScoringChartProps) {
  const chartData = useMemo(() => {
    const homeScoring = homeTeam.scoring ?? [];
    const awayScoring = awayTeam.scoring ?? [];

    if (homeScoring.length === 0 && awayScoring.length === 0) return null;

    // Combine quarters
    const maxQuarters = Math.max(homeScoring.length, awayScoring.length);
    const dataset = [];

    for (let i = 0; i < maxQuarters; i++) {
      const homeQ = homeScoring.find(q => q.number === i + 1);
      const awayQ = awayScoring.find(q => q.number === i + 1);
      
      dataset.push({
        quarter: i < 4 ? `Q${i + 1}` : `OT${i - 3}`,
        home: homeQ?.points ?? 0,
        away: awayQ?.points ?? 0,
      });
    }

    // Calculate running totals
    let homeTotal = 0;
    let awayTotal = 0;
    const runningTotals = dataset.map(q => {
      homeTotal += q.home;
      awayTotal += q.away;
      return { ...q, homeTotal, awayTotal };
    });

    return { dataset, runningTotals };
  }, [homeTeam, awayTeam]);

  if (!chartData) {
    return (
      <div className={cn('flex items-center justify-center py-4 text-sm text-muted-foreground', className)}>
        No scoring data available
      </div>
    );
  }

  return (
    <ChartThemeProvider>
      <div className={cn('flex flex-col gap-3', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Quarter-by-Quarter</h4>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: chartColors.primary }} />
              <span className="text-muted-foreground">{awayTeam.alias}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: chartColors.danger }} />
              <span className="text-muted-foreground">{homeTeam.alias}</span>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div style={{ height }}>
          <BarChart
            dataset={chartData.dataset}
            xAxis={[{
              scaleType: 'band',
              dataKey: 'quarter',
              tickLabelStyle: { fontSize: 11 },
            }]}
            yAxis={[{
              tickLabelStyle: { fontSize: 10 },
              tickNumber: 4,
            }]}
            series={[
              {
                dataKey: 'away',
                label: awayTeam.alias,
                color: chartColors.primary,
                valueFormatter: (value: number | null) => value?.toString() ?? '',
              },
              {
                dataKey: 'home',
                label: homeTeam.alias,
                color: chartColors.danger,
                valueFormatter: (value: number | null) => value?.toString() ?? '',
              },
            ]}
            margin={{ left: 35, right: 10, top: 10, bottom: 25 }}
            hideLegend
            sx={{
              '& .MuiBarElement-root': {
                rx: 3,
              },
            }}
          />
        </div>

        {/* Score progression */}
        <div className="flex items-center justify-center gap-6 text-xs">
          {chartData.runningTotals.map((q) => (
            <div key={q.quarter} className="flex flex-col items-center">
              <span className="text-muted-foreground">{q.quarter}</span>
              <div className="flex items-center gap-1 font-mono">
                <span className="text-blue-400">{q.awayTotal}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-red-400">{q.homeTotal}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartThemeProvider>
  );
}

/**
 * Simple game score summary card
 */
interface GameScoreSummaryProps {
  game: MatchPanelGame;
  className?: string;
}

export function GameScoreSummary({ game, className }: GameScoreSummaryProps) {
  const scoreDiff = Math.abs(game.home.score - game.away.score);
  const homeWinning = game.home.score > game.away.score;
  const awayWinning = game.away.score > game.home.score;

  return (
    <div className={cn('flex items-center justify-between p-4 rounded-lg bg-card border border-border', className)}>
      {/* Away Team */}
      <div className={cn(
        'flex flex-col items-center',
        awayWinning && 'text-green-400'
      )}>
        <span className="text-sm font-medium">{game.away.team.alias}</span>
        <span className="text-3xl font-bold tabular-nums">{game.away.score}</span>
        {game.away.record && (
          <span className="text-[10px] text-muted-foreground">
            {game.away.record.wins}-{game.away.record.losses}
          </span>
        )}
      </div>

      {/* Center - Status */}
      <div className="flex flex-col items-center gap-1">
        {game.clock && (
          <span className="text-xs font-mono text-muted-foreground">
            Q{game.clock.quarter} {game.clock.time}
          </span>
        )}
        {scoreDiff > 0 && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded',
            homeWinning ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
          )}>
            {homeWinning ? game.home.team.alias : game.away.team.alias} +{scoreDiff}
          </span>
        )}
      </div>

      {/* Home Team */}
      <div className={cn(
        'flex flex-col items-center',
        homeWinning && 'text-green-400'
      )}>
        <span className="text-sm font-medium">{game.home.team.alias}</span>
        <span className="text-3xl font-bold tabular-nums">{game.home.score}</span>
        {game.home.record && (
          <span className="text-[10px] text-muted-foreground">
            {game.home.record.wins}-{game.home.record.losses}
          </span>
        )}
      </div>
    </div>
  );
}

export default TeamComparisonChart;
