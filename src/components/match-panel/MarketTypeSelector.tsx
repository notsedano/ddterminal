/**
 * Market Type Selector Component
 * Tabs for switching between MONEYLINE, SPREAD, TOTAL, and PROPS
 */

import { cn } from '@/utils/cn';
import type { SportsMarketType, PolymarketSportsMarket } from '@/types';
import { formatLine, formatVolume } from '@/types';
import { TrendingUp, ArrowLeftRight, Target, Sparkles } from 'lucide-react';

interface MarketTypeSelectorProps {
  selectedType: SportsMarketType;
  onSelectType: (type: SportsMarketType) => void;
  availableTypes: {
    moneyline: PolymarketSportsMarket | null;
    spread: PolymarketSportsMarket | null;
    total: PolymarketSportsMarket | null;
    props: PolymarketSportsMarket[];
  };
  className?: string;
}

const MARKET_TYPE_CONFIG: Record<SportsMarketType, {
  label: string;
  shortLabel: string;
  icon: typeof TrendingUp;
  description: string;
}> = {
  MONEYLINE: {
    label: 'Moneyline',
    shortLabel: 'ML',
    icon: TrendingUp,
    description: 'Who will win?',
  },
  SPREAD: {
    label: 'Spread',
    shortLabel: 'SPR',
    icon: ArrowLeftRight,
    description: 'Win by margin',
  },
  TOTAL: {
    label: 'Total',
    shortLabel: 'O/U',
    icon: Target,
    description: 'Over/Under points',
  },
  PROP: {
    label: 'Props',
    shortLabel: 'PROP',
    icon: Sparkles,
    description: 'Player props',
  },
};

export function MarketTypeSelector({
  selectedType,
  onSelectType,
  availableTypes,
  className,
}: MarketTypeSelectorProps) {
  const types: Array<{ type: SportsMarketType; market: PolymarketSportsMarket | null; count?: number }> = [
    { type: 'MONEYLINE', market: availableTypes.moneyline },
    { type: 'SPREAD', market: availableTypes.spread },
    { type: 'TOTAL', market: availableTypes.total },
    { type: 'PROP', market: availableTypes.props[0] ?? null, count: availableTypes.props.length },
  ];

  // Filter to only available types
  const availableMarketTypes = types.filter(t => t.market !== null || (t.type === 'PROP' && t.count && t.count > 0));

  if (availableMarketTypes.length <= 1) {
    // No need for selector if only one type available
    return null;
  }

  return (
    <div className={cn('flex gap-1', className)}>
      {availableMarketTypes.map(({ type, market, count }) => {
        const config = MARKET_TYPE_CONFIG[type];
        const Icon = config.icon;
        const isSelected = selectedType === type;
        const hasMarket = market !== null || (count && count > 0);

        return (
          <button
            key={type}
            onClick={() => onSelectType(type)}
            disabled={!hasMarket}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs',
              'transition-colors duration-200',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : hasMarket
                  ? 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  : 'bg-muted/20 text-muted-foreground/50 cursor-not-allowed',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="font-medium">{config.shortLabel}</span>
            {type === 'PROP' && count && count > 1 && (
              <span className="text-[10px] opacity-70">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact market type tabs (horizontal)
 */
interface CompactMarketTypeTabsProps {
  selectedType: SportsMarketType;
  onSelectType: (type: SportsMarketType) => void;
  availableTypes: {
    moneyline: PolymarketSportsMarket | null;
    spread: PolymarketSportsMarket | null;
    total: PolymarketSportsMarket | null;
    props: PolymarketSportsMarket[];
  };
  className?: string;
}

export function CompactMarketTypeTabs({
  selectedType,
  onSelectType,
  availableTypes,
  className,
}: CompactMarketTypeTabsProps) {
  const types: Array<{ type: SportsMarketType; available: boolean; line?: number }> = [
    { 
      type: 'MONEYLINE', 
      available: availableTypes.moneyline !== null,
    },
    { 
      type: 'SPREAD', 
      available: availableTypes.spread !== null,
      line: availableTypes.spread?.market.line,
    },
    { 
      type: 'TOTAL', 
      available: availableTypes.total !== null,
      line: availableTypes.total?.market.line,
    },
  ];

  return (
    <div className={cn('flex border-b border-border', className)}>
      {types.map(({ type, available, line }) => {
        const config = MARKET_TYPE_CONFIG[type];
        const isSelected = selectedType === type;

        if (!available) return null;

        return (
          <button
            key={type}
            onClick={() => onSelectType(type)}
            className={cn(
              'relative flex-1 py-2 px-3 text-xs font-medium',
              'transition-colors duration-200',
              isSelected
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span>{config.label}</span>
              {line !== undefined && (
                <span className="text-[10px] opacity-70">
                  {formatLine(line, type)}
                </span>
              )}
            </div>
            
            {/* Active indicator */}
            {isSelected && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Market type badge
 */
interface MarketTypeBadgeProps {
  type: SportsMarketType;
  line?: number;
  className?: string;
}

export function MarketTypeBadge({ type, line, className }: MarketTypeBadgeProps) {
  const config = MARKET_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md',
      'bg-muted/50 text-muted-foreground text-[10px]',
      className
    )}>
      <Icon className="h-3 w-3" />
      <span className="font-medium">{config.label}</span>
      {line !== undefined && (
        <span className="opacity-70">{formatLine(line, type)}</span>
      )}
    </div>
  );
}

/**
 * Market summary cards showing all types at a glance
 */
interface MarketSummaryCardsProps {
  availableTypes: {
    moneyline: PolymarketSportsMarket | null;
    spread: PolymarketSportsMarket | null;
    total: PolymarketSportsMarket | null;
    props: PolymarketSportsMarket[];
  };
  onSelectType: (type: SportsMarketType) => void;
  className?: string;
}

export function MarketSummaryCards({
  availableTypes,
  onSelectType,
  className,
}: MarketSummaryCardsProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      {/* Moneyline */}
      {availableTypes.moneyline && (
        <MarketSummaryCard
          type="MONEYLINE"
          market={availableTypes.moneyline}
          onClick={() => onSelectType('MONEYLINE')}
        />
      )}

      {/* Spread */}
      {availableTypes.spread && (
        <MarketSummaryCard
          type="SPREAD"
          market={availableTypes.spread}
          onClick={() => onSelectType('SPREAD')}
        />
      )}

      {/* Total */}
      {availableTypes.total && (
        <MarketSummaryCard
          type="TOTAL"
          market={availableTypes.total}
          onClick={() => onSelectType('TOTAL')}
        />
      )}

      {/* Props summary */}
      {availableTypes.props.length > 0 && (
        <button
          onClick={() => onSelectType('PROP')}
          className={cn(
            'flex flex-col items-center justify-center p-3 rounded-lg',
            'bg-muted/30 hover:bg-muted/50 transition-colors',
            'text-center'
          )}
        >
          <Sparkles className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-xs font-medium">Props</span>
          <span className="text-[10px] text-muted-foreground">
            {availableTypes.props.length} available
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * Individual market summary card
 */
interface MarketSummaryCardProps {
  type: SportsMarketType;
  market: PolymarketSportsMarket;
  onClick: () => void;
}

function MarketSummaryCard({ type, market, onClick }: MarketSummaryCardProps) {
  const config = MARKET_TYPE_CONFIG[type];
  const Icon = config.icon;
  const outcomes = market.market.outcomes;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col p-3 rounded-lg',
        'bg-muted/30 hover:bg-muted/50 transition-colors',
        'text-left'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{config.label}</span>
        {market.market.line !== undefined && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatLine(market.market.line, type)}
          </span>
        )}
      </div>

      {/* Outcomes */}
      <div className="flex flex-col gap-1">
        {outcomes.slice(0, 2).map((outcome, index) => (
          <div key={outcome.tokenId || index} className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
              {outcome.name}
            </span>
            <span className={cn(
              'text-xs font-medium',
              index === 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {(outcome.price * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* Volume */}
      <div className="mt-2 pt-2 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground">
          Vol: {formatVolume(market.market.volume)}
        </span>
      </div>
    </button>
  );
}

export default MarketTypeSelector;
