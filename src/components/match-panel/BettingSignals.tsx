/**
 * Betting Signals Component
 * Displays key betting indicators and signals for decision-making
 */

import { memo } from 'react';
import { cn } from '@/utils/cn';
import type { GameBettingIndicators, BettingSignal } from '@/types';
import { 
  Flame, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Activity,
  Zap,
  Users,
  BarChart2,
  Target,
} from 'lucide-react';

interface BettingSignalsProps {
  indicators: GameBettingIndicators;
  homeAlias: string;
  awayAlias: string;
  className?: string;
}

/**
 * Signal type icon mapping
 */
function getSignalIcon(type: BettingSignal['type']) {
  switch (type) {
    case 'steam_move':
      return <Zap className="h-3.5 w-3.5" />;
    case 'reverse_line':
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'sharp_action':
      return <Target className="h-3.5 w-3.5" />;
    case 'public_money':
      return <Users className="h-3.5 w-3.5" />;
    default:
      return <Activity className="h-3.5 w-3.5" />;
  }
}

/**
 * Signal confidence color
 */
function getConfidenceColor(confidence: BettingSignal['confidence']) {
  switch (confidence) {
    case 'high':
      return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'medium':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'low':
      return 'text-muted-foreground bg-muted/30 border-muted';
    default:
      return 'text-muted-foreground bg-muted/30 border-muted';
  }
}

/**
 * Individual signal badge
 */
const SignalBadge = memo(function SignalBadge({ signal }: { signal: BettingSignal }) {
  const colorClass = getConfidenceColor(signal.confidence);
  
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs',
      colorClass
    )}>
      {getSignalIcon(signal.type)}
      <span className="font-medium">{signal.description}</span>
    </div>
  );
});

/**
 * Rest days indicator
 */
const RestIndicator = memo(function RestIndicator({
  homeRestDays,
  awayRestDays,
  homeIsB2B,
  awayIsB2B,
  homeAlias,
  awayAlias,
}: {
  homeRestDays: number;
  awayRestDays: number;
  homeIsB2B: boolean;
  awayIsB2B: boolean;
  homeAlias: string;
  awayAlias: string;
}) {
  const hasAdvantage = Math.abs(homeRestDays - awayRestDays) >= 2;
  const homeAdvantage = homeRestDays > awayRestDays;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Rest</span>
      </div>
      <div className="flex items-center gap-3">
        {/* Away team rest */}
        <div className={cn(
          'flex items-center gap-1 text-xs',
          awayIsB2B ? 'text-red-400' : 'text-muted-foreground',
          hasAdvantage && !homeAdvantage && 'text-green-400 font-medium'
        )}>
          <span>{awayAlias}</span>
          <span className={cn(
            'px-1.5 py-0.5 rounded',
            awayIsB2B ? 'bg-red-500/20' : 'bg-muted/50'
          )}>
            {awayIsB2B ? 'B2B' : `${awayRestDays}d`}
          </span>
        </div>

        {/* Separator */}
        <span className="text-muted-foreground/50">vs</span>

        {/* Home team rest */}
        <div className={cn(
          'flex items-center gap-1 text-xs',
          homeIsB2B ? 'text-red-400' : 'text-muted-foreground',
          hasAdvantage && homeAdvantage && 'text-green-400 font-medium'
        )}>
          <span>{homeAlias}</span>
          <span className={cn(
            'px-1.5 py-0.5 rounded',
            homeIsB2B ? 'bg-red-500/20' : 'bg-muted/50'
          )}>
            {homeIsB2B ? 'B2B' : `${homeRestDays}d`}
          </span>
        </div>
      </div>
    </div>
  );
});

/**
 * Last 10 record display
 */
const Last10Display = memo(function Last10Display({
  homeLast10,
  awayLast10,
  homeAlias,
  awayAlias,
}: {
  homeLast10: { wins: number; losses: number };
  awayLast10: { wins: number; losses: number };
  homeAlias: string;
  awayAlias: string;
}) {
  const homeStrong = homeLast10.wins >= 7;
  const awayStrong = awayLast10.wins >= 7;
  const homeWeak = homeLast10.wins <= 3;
  const awayWeak = awayLast10.wins <= 3;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BarChart2 className="h-3.5 w-3.5" />
        <span>Last 10</span>
      </div>
      <div className="flex items-center gap-3">
        {/* Away L10 */}
        <span className={cn(
          'text-xs font-medium px-1.5 py-0.5 rounded',
          awayStrong && 'text-green-400 bg-green-500/20',
          awayWeak && 'text-red-400 bg-red-500/20',
          !awayStrong && !awayWeak && 'text-muted-foreground bg-muted/50'
        )}>
          {awayAlias} {awayLast10.wins}-{awayLast10.losses}
        </span>

        <span className="text-muted-foreground/50">vs</span>

        {/* Home L10 */}
        <span className={cn(
          'text-xs font-medium px-1.5 py-0.5 rounded',
          homeStrong && 'text-green-400 bg-green-500/20',
          homeWeak && 'text-red-400 bg-red-500/20',
          !homeStrong && !homeWeak && 'text-muted-foreground bg-muted/50'
        )}>
          {homeAlias} {homeLast10.wins}-{homeLast10.losses}
        </span>
      </div>
    </div>
  );
});

/**
 * Streak comparison display
 */
const StreakComparison = memo(function StreakComparison({
  homeStreak,
  awayStreak,
  homeAlias,
  awayAlias,
}: {
  homeStreak: { type: 'W' | 'L'; count: number };
  awayStreak: { type: 'W' | 'L'; count: number };
  homeAlias: string;
  awayAlias: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Flame className="h-3.5 w-3.5" />
        <span>Streak</span>
      </div>
      <div className="flex items-center gap-3">
        {/* Away streak */}
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
          awayStreak.type === 'W' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'
        )}>
          <span>{awayAlias}</span>
          {awayStreak.type === 'W' ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>{awayStreak.type}{awayStreak.count}</span>
        </div>

        <span className="text-muted-foreground/50">vs</span>

        {/* Home streak */}
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
          homeStreak.type === 'W' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'
        )}>
          <span>{homeAlias}</span>
          {homeStreak.type === 'W' ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>{homeStreak.type}{homeStreak.count}</span>
        </div>
      </div>
    </div>
  );
});

/**
 * H2H record display
 */
const H2HDisplay = memo(function H2HDisplay({
  h2hRecord,
  h2hAvgTotal,
  homeAlias,
  awayAlias,
}: {
  h2hRecord: { homeWins: number; awayWins: number; total: number };
  h2hAvgTotal: number;
  homeAlias: string;
  awayAlias: string;
}) {
  if (h2hRecord.total === 0) return null;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        <span>H2H ({h2hRecord.total}g)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          'text-xs font-medium',
          h2hRecord.homeWins > h2hRecord.awayWins ? 'text-green-400' : 'text-red-400'
        )}>
          {homeAlias} {h2hRecord.homeWins}
        </span>
        <span className="text-muted-foreground">-</span>
        <span className={cn(
          'text-xs font-medium',
          h2hRecord.awayWins > h2hRecord.homeWins ? 'text-green-400' : 'text-red-400'
        )}>
          {h2hRecord.awayWins} {awayAlias}
        </span>
        {h2hAvgTotal > 0 && (
          <span className="text-[10px] text-muted-foreground ml-2">
            (Avg: {h2hAvgTotal.toFixed(1)} pts)
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * Market efficiency indicator
 */
const MarketEfficiencyDisplay = memo(function MarketEfficiencyDisplay({
  overround,
  efficiency,
}: {
  overround: number;
  efficiency: 'low' | 'medium' | 'high';
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        <span>Market Vig</span>
      </div>
      <div className={cn(
        'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
        efficiency === 'high' && 'text-green-400 bg-green-500/20',
        efficiency === 'medium' && 'text-yellow-400 bg-yellow-500/20',
        efficiency === 'low' && 'text-red-400 bg-red-500/20'
      )}>
        <span>{overround.toFixed(1)}%</span>
        <span className="text-[10px] opacity-70">
          ({efficiency === 'high' ? 'efficient' : efficiency === 'low' ? 'high vig' : 'normal'})
        </span>
      </div>
    </div>
  );
});

/**
 * Main Betting Signals Panel
 */
export const BettingSignalsPanel = memo(function BettingSignalsPanel({
  indicators,
  homeAlias,
  awayAlias,
  className,
}: BettingSignalsProps) {
  const hasSignals = indicators.signals.length > 0;

  return (
    <div className={cn('flex flex-col gap-2 p-3 rounded-lg bg-muted/30', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">BETTING SIGNALS</span>
        {hasSignals && (
          <span className="text-[10px] text-yellow-400 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {indicators.signals.length} signal{indicators.signals.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Key Indicators */}
      <div className="flex flex-col divide-y divide-border/50">
        <StreakComparison
          homeStreak={indicators.homeStreak}
          awayStreak={indicators.awayStreak}
          homeAlias={homeAlias}
          awayAlias={awayAlias}
        />

        <Last10Display
          homeLast10={indicators.homeLast10}
          awayLast10={indicators.awayLast10}
          homeAlias={homeAlias}
          awayAlias={awayAlias}
        />

        <RestIndicator
          homeRestDays={indicators.homeRestDays}
          awayRestDays={indicators.awayRestDays}
          homeIsB2B={indicators.homeIsBackToBack}
          awayIsB2B={indicators.awayIsBackToBack}
          homeAlias={homeAlias}
          awayAlias={awayAlias}
        />

        <H2HDisplay
          h2hRecord={indicators.h2hRecord}
          h2hAvgTotal={indicators.h2hAverageTotal}
          homeAlias={homeAlias}
          awayAlias={awayAlias}
        />

        {indicators.overround > 0 && (
          <MarketEfficiencyDisplay
            overround={indicators.overround}
            efficiency={indicators.marketEfficiency}
          />
        )}
      </div>

      {/* Signal Badges */}
      {hasSignals && (
        <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-border/50">
          {indicators.signals.slice(0, 4).map((signal, idx) => (
            <SignalBadge key={idx} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * Compact version for tight spaces
 */
export const CompactBettingSignals = memo(function CompactBettingSignals({
  indicators,
  homeAlias,
  awayAlias,
  className,
}: BettingSignalsProps) {
  const topSignal = indicators.signals.find(s => s.confidence === 'high') ?? indicators.signals[0];

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Streaks */}
      <div className={cn(
        'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
        indicators.homeStreak.type === 'W' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'
      )}>
        {homeAlias} {indicators.homeStreak.type}{indicators.homeStreak.count}
      </div>

      <div className={cn(
        'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
        indicators.awayStreak.type === 'W' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'
      )}>
        {awayAlias} {indicators.awayStreak.type}{indicators.awayStreak.count}
      </div>

      {/* B2B Warning */}
      {(indicators.homeIsBackToBack || indicators.awayIsBackToBack) && (
        <div className="flex items-center gap-1 text-xs text-red-400 px-1.5 py-0.5 rounded bg-red-500/20">
          <Clock className="h-3 w-3" />
          {indicators.homeIsBackToBack && indicators.awayIsBackToBack 
            ? 'Both B2B' 
            : `${indicators.homeIsBackToBack ? homeAlias : awayAlias} B2B`}
        </div>
      )}

      {/* Top Signal */}
      {topSignal && (
        <div className={cn(
          'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
          getConfidenceColor(topSignal.confidence)
        )}>
          {getSignalIcon(topSignal.type)}
          <span>{topSignal.team}</span>
        </div>
      )}
    </div>
  );
});

export default BettingSignalsPanel;
