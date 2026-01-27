/**
 * Match Card Component
 * Displays a single match with teams, score, and comprehensive market data from Polymarket
 */

import { useState, useMemo, memo } from 'react';
import { cn } from '@/utils/cn';
import type { MatchPanelGame, PolymarketSportsMarket, SportsMarketType } from '@/types';
import { isGameScheduled, formatPriceAsPercentage, formatPriceAsAmericanOdds, formatVolume } from '@/types';
import { formatTimeUntilGame } from '@/services/api/sportradar';
import { useGameMarketData, usePolymarketForGame } from '@/hooks/usePolymarketNBA';
import { useNBAInjuries } from '@/hooks/useNBAInjuries';
import { useMatchHistory } from '@/hooks/useMatchHistory';
import { useBettingIndicators } from '@/hooks/useBettingIndicators';
import type { ParsedGameMarket } from '@/services/api/polymarket';
import { MatchStatusBadge } from './MatchStatusBadge';
import { MarketDetails } from './MarketDetails';
import { MarketButton } from './MarketButton';
import { ShinyButton } from './ShinyButton';
import { InjuryReport } from './InjuryReport';
import { StreakPanel } from './StreakIndicator';
import { BettingSignalsPanel } from './BettingSignals';
import { TeamLogo } from '@/components/TeamLogo';
import { Clock, Calendar, ExternalLink, TrendingUp, Wifi, Activity, ArrowUpDown, Target, DollarSign, ChevronDown, ChevronUp, BarChart3, LineChart as LineChartIcon, Flame, Zap } from 'lucide-react';
import { PriceLineChart, OutcomeComparisonChart } from '@/components/charts';
import { HudChartWrapper } from '@/components/ui/HudChartWrapper';
import { format } from 'date-fns';

interface MatchCardProps {
  game: MatchPanelGame;
  market: PolymarketSportsMarket | null;
  className?: string;
}

/**
 * Main MatchCard component - memoized to prevent unnecessary re-renders
 * during live updates when props haven't changed
 */
export const MatchCard = memo(function MatchCard({ game, market: marketProp, className }: MatchCardProps) {
  const isScheduled = isGameScheduled(game.status);
  const now = new Date();
  const isUpcoming = isScheduled && game.scheduledTime > now;

  // Fetch per-game market data from Polymarket
  const gameMarkets = useGameMarketData(game);
  
  // Also fetch the full market if prop is null (for chart support)
  const { data: fetchedMarket } = usePolymarketForGame(marketProp ? null : game);
  
  // Use prop market or fetched market
  const market = marketProp ?? fetchedMarket ?? null;

  // Fetch injury data for this game
  const { getInjuriesForGame } = useNBAInjuries();
  const { home: homeInjuries, away: awayInjuries } = getInjuriesForGame(game);
  
  // Fetch match history for streak indicators
  const { homeHistory, awayHistory } = useMatchHistory(game, { 
    limit: 10, 
    includeH2H: true 
  });
  
  // Fetch betting indicators
  const { indicators } = useBettingIndicators(game);
  
  // Track expanded sections
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showBettingSignals, setShowBettingSignals] = useState(false);
  
  // Track selected market type
  const [selectedMarketType, setSelectedMarketType] = useState<SportsMarketType>('MONEYLINE');

  // Determine which markets are available
  const availableMarketTypes = useMemo(() => {
    return {
      moneyline: gameMarkets.moneyline,
      spread: gameMarkets.bestSpread,
      total: gameMarkets.bestTotal,
      props: gameMarkets.data?.props ?? [],
    };
  }, [gameMarkets]);

  // Get the currently selected market
  const currentParsedMarket: ParsedGameMarket | null = useMemo(() => {
    switch (selectedMarketType) {
      case 'MONEYLINE':
        return availableMarketTypes.moneyline;
      case 'SPREAD':
        return availableMarketTypes.spread;
      case 'TOTAL':
        return availableMarketTypes.total;
      case 'PROP':
        return availableMarketTypes.props[0] ?? null;
      default:
        return availableMarketTypes.moneyline;
    }
  }, [selectedMarketType, availableMarketTypes]);

  // Check if multiple market types are available
  const hasMultipleMarketTypes = useMemo(() => {
    let count = 0;
    if (availableMarketTypes.moneyline) count++;
    if (availableMarketTypes.spread) count++;
    if (availableMarketTypes.total) count++;
    if (availableMarketTypes.props.length > 0) count++;
    return count > 1;
  }, [availableMarketTypes]);
  
  // Check if we have any market data
  const hasMarketData = gameMarkets.hasMarkets;
  const isLoadingMarkets = gameMarkets.isLoading;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Status Badge */}
      <div className="flex justify-center">
        <MatchStatusBadge status={game.status} />
      </div>

      {/* Time Until Game (for upcoming games) */}
      {isUpcoming && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 text-blue-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-semibold">{formatTimeUntilGame(game.scheduledTime)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{format(game.scheduledTime, 'h:mm a')}</span>
          </div>
        </div>
      )}

      {/* Teams Display */}
      <div className="flex flex-col gap-3">
        {/* Away Team */}
        <TeamRow
          team={game.away.team}
          score={game.away.score}
          record={game.away.record}
          odds={getTeamOddsFromParsedMarket(currentParsedMarket, game.away.team.name, false)}
          marketType={selectedMarketType}
          line={currentParsedMarket?.line}
          isAway
          isFirst={false}
        />

        {/* VS Separator with Clock */}
        <div className="flex items-center gap-2 px-2">
          <div className="flex-1 h-px bg-border" />
          <div className="flex flex-col items-center">
            {game.isLive && game.clock ? (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">
                  Q{game.clock.quarter} {game.clock.time}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">VS</span>
            )}
          </div>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Home Team */}
        <TeamRow
          team={game.home.team}
          score={game.home.score}
          record={game.home.record}
          odds={getTeamOddsFromParsedMarket(currentParsedMarket, game.home.team.name, true)}
          marketType={selectedMarketType}
          line={currentParsedMarket?.line}
          isFirst={true}
        />
      </div>

      {/* Odds Bar (if market available) */}
      {currentParsedMarket && currentParsedMarket.outcomes.length >= 2 && (
        <div className="px-2">
          <ParsedMarketOddsBar outcomes={currentParsedMarket.outcomes} />
        </div>
      )}

      {/* Market Type Tabs (if multiple types available) */}
      {hasMultipleMarketTypes && (
        <GameMarketTypeTabs
          selectedType={selectedMarketType}
          onSelectType={setSelectedMarketType}
          moneyline={availableMarketTypes.moneyline}
          spread={availableMarketTypes.spread}
          total={availableMarketTypes.total}
          props={availableMarketTypes.props}
        />
      )}

      {/* Market Data */}
      <div className="border-t border-border pt-3">
        {isLoadingMarkets ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-pulse flex gap-2 items-center text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Loading market data...</span>
            </div>
          </div>
        ) : market ? (
          // Use MarketDetails with charts when we have full market data
          <MarketDetails 
            market={market} 
            showOrderbook={true}
            showFullDetails={true}
          />
        ) : hasMarketData && currentParsedMarket ? (
          <GameMarketDisplay 
            market={currentParsedMarket}
            totalVolume={gameMarkets.totalVolume}
            eventSlug={gameMarkets.data?.eventSlug ?? ''}
          />
        ) : (
          <NoMarketDataDisplay />
        )}
      </div>

      {/* Injury Report */}
      <InjuryReport 
        homeInjuries={homeInjuries}
        awayInjuries={awayInjuries}
      />

      {/* Match History Section */}
      {(homeHistory && awayHistory) && (
        <div className="border-t border-border pt-3 mt-1">
          <button
            onClick={() => setShowMatchHistory(!showMatchHistory)}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Flame className="h-3.5 w-3.5" />
              <span>Match History</span>
              {/* Quick streak preview */}
              <div className="flex items-center gap-1.5 ml-2">
                <span className={cn(
                  'text-[10px] font-bold px-1 rounded',
                  homeHistory.streakType === 'W' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'
                )}>
                  {game.home.team.alias} {homeHistory.streakType}{homeHistory.streakCount}
                </span>
                <span className={cn(
                  'text-[10px] font-bold px-1 rounded',
                  awayHistory.streakType === 'W' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'
                )}>
                  {game.away.team.alias} {awayHistory.streakType}{awayHistory.streakCount}
                </span>
              </div>
            </div>
            {showMatchHistory ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showMatchHistory && (
            <div className="mt-3">
              <StreakPanel
                homeHistory={homeHistory}
                awayHistory={awayHistory}
                homeAlias={game.home.team.alias}
                awayAlias={game.away.team.alias}
              />
            </div>
          )}
        </div>
      )}

      {/* Betting Signals Section */}
      {indicators && (
        <div className="border-t border-border pt-3 mt-1">
          <button
            onClick={() => setShowBettingSignals(!showBettingSignals)}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span>Betting Signals</span>
              {indicators.signals.length > 0 && (
                <span className="text-[10px] text-yellow-400 bg-yellow-500/20 px-1.5 py-0.5 rounded">
                  {indicators.signals.length} signal{indicators.signals.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {showBettingSignals ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showBettingSignals && (
            <div className="mt-3">
              <BettingSignalsPanel
                indicators={indicators}
                homeAlias={game.home.team.alias}
                awayAlias={game.away.team.alias}
              />
            </div>
          )}
        </div>
      )}

      {/* Live indicator */}
      {(hasMarketData || isLoadingMarkets) && (
        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/50">
          <Wifi className="h-3 w-3" />
          <span>Live odds from Polymarket</span>
        </div>
      )}
    </div>
  );
});

/**
 * Team Row Component
 */
interface TeamRowProps {
  team: {
    id: string;
    name: string;
    market: string;
    alias: string;
  };
  score: number;
  record?: { wins: number; losses: number };
  odds: number | null;
  marketType: SportsMarketType;
  line?: number;
  isAway?: boolean;
  isFirst: boolean;
}

/**
 * TeamRow - memoized to prevent re-renders when team data hasn't changed
 */
const TeamRow = memo(function TeamRow({ team, score, record, odds, marketType, line, isAway, isFirst }: TeamRowProps) {
  const hasScore = score > 0;

  // Format odds display based on market type
  const formatOddsDisplay = (): string => {
    if (odds === null) return '-';
    
    // For spreads, show the line
    if (marketType === 'SPREAD' && line !== undefined) {
      const displayLine = isFirst ? line : -line;
      const lineStr = displayLine > 0 ? `+${displayLine}` : displayLine.toString();
      return `${lineStr} (${formatPriceAsPercentage(odds)})`;
    }
    
    // For totals
    if (marketType === 'TOTAL' && line !== undefined) {
      const label = isFirst ? 'O' : 'U';
      return `${label} ${line} (${formatPriceAsPercentage(odds)})`;
    }
    
    // Default: show percentage
    return formatPriceAsPercentage(odds);
  };

  return (
    <div className="flex items-center justify-between px-2">
      {/* Team Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Team Logo */}
        <TeamLogo alias={team.alias} size={40} className="w-10 h-10" />

        {/* Team Name & Record */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">
            {team.market} {team.name}
          </span>
          <div className="flex items-center gap-2">
            {record && (
              <span className="text-[10px] text-muted-foreground hud-data">
                {record.wins}-{record.losses}
              </span>
            )}
            {isAway && (
              <span className="text-[10px] text-muted-foreground/50">@ Away</span>
            )}
          </div>
        </div>
      </div>

      {/* Odds & Score */}
      <div className="flex items-center gap-3">
        {odds !== null && (
          <div className="flex flex-col items-end">
            <span className={cn(
              'text-xs font-medium hud-data',
              isFirst ? 'text-green-400' : 'text-red-400'
            )}>
              {formatOddsDisplay()}
            </span>
            {/* American odds on second line for moneyline */}
            {marketType === 'MONEYLINE' && (
              <span className="text-[10px] text-muted-foreground hud-data">
                {formatPriceAsAmericanOdds(odds)}
              </span>
            )}
          </div>
        )}
        <span className={cn(
          'text-2xl font-bold tabular-nums min-w-[2.5rem] text-right hud-data',
          hasScore ? 'text-foreground' : 'text-muted-foreground/50'
        )}>
          {hasScore ? score : '-'}
        </span>
      </div>
    </div>
  );
});

/**
 * Game Market Display Component
 * Shows per-game market data (moneyline, spread, totals) from Polymarket
 */
interface GameMarketDisplayProps {
  market: ParsedGameMarket;
  totalVolume: number;
  eventSlug: string;
}

/**
 * GameMarketDisplay - memoized for stable market data
 */
const GameMarketDisplay = memo(function GameMarketDisplay({ market, totalVolume, eventSlug }: GameMarketDisplayProps) {
  const [showCharts, setShowCharts] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<'price' | 'compare'>('price');
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState(0);

  const getMarketTypeIcon = () => {
    switch (market.type) {
      case 'MONEYLINE':
        return <TrendingUp className="h-4 w-4" />;
      case 'SPREAD':
        return <ArrowUpDown className="h-4 w-4" />;
      case 'TOTAL':
        return <Target className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getMarketTypeLabel = () => {
    switch (market.type) {
      case 'MONEYLINE':
        return 'Win Probability';
      case 'SPREAD':
        return `Spread ${market.line ? `(${market.line > 0 ? '+' : ''}${market.line})` : ''}`;
      case 'TOTAL':
        return `Over/Under ${market.line ?? ''}`;
      case 'PROP':
        return 'Player Prop';
      default:
        return 'Market';
    }
  };

  // Get token IDs for chart display
  const selectedOutcome = market.outcomes[selectedOutcomeIndex];
  const hasTokenId = Boolean(selectedOutcome?.tokenId);

  return (
    <div className="flex flex-col gap-3">
      {/* Market Type Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          {getMarketTypeIcon()}
          <span className="text-sm font-medium">{getMarketTypeLabel()}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          <span className="hud-data">Vol: {formatVolume(market.volume)}</span>
        </div>
      </div>

      {/* Outcomes Grid */}
      <div className="grid grid-cols-2 gap-3">
        {market.outcomes.map((outcome, index) => {
          // Determine which outcome has the higher percentage
          const higherIndex = market.outcomes[0].price >= market.outcomes[1]?.price ? 0 : 1;
          const isHigher = index === higherIndex;
          
          // Use ShinyButton for losing team (lower percentage), MarketButton for winning team
          if (isHigher) {
            return (
              <MarketButton
                key={outcome.tokenId || index}
                name={outcome.name}
                percentage={formatPriceAsPercentage(outcome.price)}
                odds={formatPriceAsAmericanOdds(outcome.price)}
                isHigher={isHigher}
              />
            );
          } else {
            return (
              <ShinyButton
                key={outcome.tokenId || index}
                name={outcome.name}
                percentage={formatPriceAsPercentage(outcome.price)}
                odds={formatPriceAsAmericanOdds(outcome.price)}
              />
            );
          }
        })}
      </div>

      {/* Market Question */}
      {market.question && (
        <p className="text-[10px] text-center text-muted-foreground/70 truncate">
          {market.question}
        </p>
      )}

      {/* Total Event Volume */}
      {totalVolume > 0 && (
        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/70">
          <span className="hud-data">Event Volume: ${formatVolume(totalVolume)}</span>
        </div>
      )}

      {/* Charts Section */}
      {hasTokenId && (
        <div className="border-t border-border pt-3 mt-1">
          {/* Chart Toggle Header */}
          <button
            onClick={() => setShowCharts(!showCharts)}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Charts & Analytics</span>
            </div>
            {showCharts ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Expanded Chart Content */}
          {showCharts && (
            <div className="mt-3 space-y-3">
              {/* Chart Tabs */}
              <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
                <button
                  onClick={() => setActiveChartTab('price')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    activeChartTab === 'price'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <LineChartIcon className="h-3 w-3" />
                  Price History
                </button>
                <button
                  onClick={() => setActiveChartTab('compare')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    activeChartTab === 'compare'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <BarChart3 className="h-3 w-3" />
                  Compare
                </button>
              </div>

              {/* Outcome Selector for Price Chart */}
              {activeChartTab === 'price' && market.outcomes.length > 1 && (
                <div className="flex items-center gap-2">
                  {market.outcomes.map((outcome, index) => (
                    <button
                      key={outcome.tokenId || index}
                      onClick={() => setSelectedOutcomeIndex(index)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                        selectedOutcomeIndex === index
                          ? index === 0
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      {outcome.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Price Chart */}
              {activeChartTab === 'price' && selectedOutcome?.tokenId && (
                <HudChartWrapper showScanlines={true} variant="default">
                  <PriceLineChart
                    tokenId={selectedOutcome.tokenId}
                    outcomeName={selectedOutcome.name}
                    height={180}
                    showTimeSelector={true}
                  />
                </HudChartWrapper>
              )}

              {/* Compare Chart - Both outcomes overlaid */}
              {activeChartTab === 'compare' && market.outcomes.length >= 2 && (
                <HudChartWrapper showScanlines={true} variant="default">
                  <OutcomeComparisonChart
                    outcomes={market.outcomes.slice(0, 2).map(o => ({
                      tokenId: o.tokenId,
                      name: o.name,
                      price: o.price,
                    }))}
                    height={180}
                    showTimeSelector={true}
                  />
                </HudChartWrapper>
              )}
            </div>
          )}
        </div>
      )}

      {/* Link to Polymarket */}
      {eventSlug && (
        <a
          href={`https://polymarket.com/event/${eventSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
        >
          <TrendingUp className="h-3 w-3" />
          <span>Trade on Polymarket</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  );
});

/**
 * Parsed Market Odds Bar - Visual representation of odds
 */
const ParsedMarketOddsBar = memo(function ParsedMarketOddsBar({ outcomes }: { outcomes: Array<{ name: string; price: number }> }) {
  if (outcomes.length < 2) return null;

  const leftPct = Math.round(outcomes[0].price * 100);
  const rightPct = Math.round(outcomes[1].price * 100);

  return (
    <div className="flex items-center gap-1 w-full">
      <span className="text-[10px] text-green-400 font-medium">{leftPct}%</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted/50">
        <div className="flex h-full">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-400"
            style={{ width: `${leftPct}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-red-400 to-red-500"
            style={{ width: `${rightPct}%` }}
          />
        </div>
      </div>
      <span className="text-[10px] text-red-400 font-medium">{rightPct}%</span>
    </div>
  );
});

/**
 * Game Market Type Tabs - Compact tabs for switching between market types
 */
interface GameMarketTypeTabsProps {
  selectedType: SportsMarketType;
  onSelectType: (type: SportsMarketType) => void;
  moneyline: ParsedGameMarket | null;
  spread: ParsedGameMarket | null;
  total: ParsedGameMarket | null;
  props: ParsedGameMarket[];
}

function GameMarketTypeTabs({ 
  selectedType, 
  onSelectType, 
  moneyline, 
  spread, 
  total, 
  props 
}: GameMarketTypeTabsProps) {
  const tabs: Array<{ type: SportsMarketType; label: string; available: boolean }> = [
    { type: 'MONEYLINE', label: 'ML', available: !!moneyline },
    { type: 'SPREAD', label: 'Spread', available: !!spread },
    { type: 'TOTAL', label: 'O/U', available: !!total },
    { type: 'PROP', label: 'Props', available: props.length > 0 },
  ];

  const availableTabs = tabs.filter(t => t.available);

  if (availableTabs.length <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 px-2">
      {availableTabs.map(tab => (
        <button
          key={tab.type}
          onClick={() => onSelectType(tab.type)}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-colors',
            selectedType === tab.type
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * No Market Data Display
 */
function NoMarketDataDisplay() {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
      <Activity className="h-5 w-5" />
      <span className="text-sm">No market data available for this game</span>
      <p className="text-[10px] text-center text-muted-foreground/70 max-w-[200px]">
        Market may not be listed on Polymarket yet
      </p>
    </div>
  );
}

/**
 * Helper to extract team odds from ParsedGameMarket
 */
function getTeamOddsFromParsedMarket(
  market: ParsedGameMarket | null, 
  teamName: string, 
  isFirst: boolean
): number | null {
  if (!market || market.outcomes.length === 0 || !teamName) return null;
  
  const teamLower = teamName.toLowerCase();
  
  // For moneyline/spread, find the team in outcomes
  for (const outcome of market.outcomes) {
    if (!outcome?.name) continue;
    const outcomeLower = outcome.name.toLowerCase();
    if (outcomeLower.includes(teamLower)) {
      return outcome.price;
    }
  }

  // For totals, return Over for first team, Under for second
  if (market.type === 'TOTAL') {
    // First (home) gets Over, second (away) gets Under
    const idx = isFirst ? 0 : 1;
    return market.outcomes[idx]?.price ?? null;
  }

  // Fallback: first outcome for first team, second for second
  if (market.outcomes.length >= 2) {
    const idx = isFirst ? 0 : 1;
    return market.outcomes[idx].price;
  }

  return market.outcomes[0]?.price ?? null;
}


/**
 * Minimal Match Card for list views
 */
interface MinimalMatchCardProps {
  game: MatchPanelGame;
  market?: PolymarketSportsMarket | null;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * MinimalMatchCard - memoized for list views
 */
export const MinimalMatchCard = memo(function MinimalMatchCard({ game, market, isActive, onClick, className }: MinimalMatchCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-2 rounded-lg text-left transition-colors',
        'hover:bg-accent/50',
        isActive && 'bg-accent',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Teams */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-xs">
            <span className="font-medium">{game.away.team.alias}</span>
            <span className="text-muted-foreground">@</span>
            <span className="font-medium">{game.home.team.alias}</span>
          </div>
          
          {/* Quick odds if available */}
          {market && (
            <div className="flex items-center gap-2 mt-0.5">
              {market.market.outcomes.slice(0, 2).map((outcome, index) => (
                <span 
                  key={outcome.tokenId || index} 
                  className={cn(
                    'text-[10px]',
                    index === 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {formatPriceAsPercentage(outcome.price)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status/Score */}
        <div className="flex items-center gap-2">
          {game.isLive ? (
            <>
              <span className="text-xs font-mono">
                {game.away.score} - {game.home.score}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            </>
          ) : (
            <MatchStatusBadge status={game.status} className="text-[10px] px-1.5 py-0" />
          )}
        </div>
      </div>
    </button>
  );
});

/**
 * Expanded Match Card with full market details
 */
interface ExpandedMatchCardProps {
  game: MatchPanelGame;
  market: PolymarketSportsMarket | null;
  onClose?: () => void;
  className?: string;
}

/**
 * ExpandedMatchCard - memoized for detail views
 */
export const ExpandedMatchCard = memo(function ExpandedMatchCard({ game, market, className }: ExpandedMatchCardProps) {
  return (
    <div className={cn('flex flex-col gap-4 p-4 bg-background rounded-xl border border-border', className)}>
      <MatchCard 
        game={game} 
        market={market} 
      />
      
      {/* Polymarket Link */}
      {market && (
        <a
          href={`https://polymarket.com/event/${market.eventSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
        >
          <TrendingUp className="h-4 w-4" />
          <span>Trade on Polymarket</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
});
