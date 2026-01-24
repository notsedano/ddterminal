/**
 * Match Panel Component
 * Main container for the NBA match panel with navigation and market data
 */

import { ChevronDown, ChevronUp, RefreshCw, Tv, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { useMatchPanel, useMatchPanelKeyboard, useMatchPanelVisibility } from '@/hooks/useMatchPanel';
import { MatchCard } from './MatchCard';
import { MatchNavigation } from './MatchNavigation';
import { format } from 'date-fns';

interface MatchPanelProps {
  className?: string;
  defaultExpanded?: boolean;
}

export function MatchPanel({ className, defaultExpanded = true }: MatchPanelProps) {
  const {
    isExpanded,
    isMobileOverlayOpen,
    toggle,
    openMobileOverlay,
    closeMobileOverlay,
  } = useMatchPanelVisibility(defaultExpanded);

  const {
    currentMatch,
    currentIndex,
    totalMatches,
    matches,
    goToNext,
    goToPrevious,
    goToIndex,
    isLoading,
    isRefreshing,
    scheduleError,
    marketError,
    refresh,
    lastUpdated,
    hasLiveGames,
    liveGameCount,
    upcomingGameCount,
  } = useMatchPanel({ autoRefresh: true });

  // Keyboard navigation
  useMatchPanelKeyboard(goToNext, goToPrevious, isExpanded);

  // Get indices of live and upcoming games for dot indicators
  const liveIndices = matches
    .map((m, i) => (m.game.isLive ? i : -1))
    .filter(i => i !== -1);
  
  const upcomingIndices = matches
    .map((m, i) => {
      const isScheduled = m.game.status === 'scheduled' || m.game.status === 'created' || m.game.status === 'time-tbd';
      return isScheduled ? i : -1;
    })
    .filter(i => i !== -1);

  // Desktop Panel
  return (
    <>
      {/* Desktop Panel (upper-right) */}
      <div
        className={cn(
          'hidden md:flex flex-col',
          'w-80 hud-panel border-l bg-background',
          'transition-all duration-300',
          !isExpanded && 'w-12',
          className
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center border-b border-border p-3',
          !isExpanded && 'justify-center'
        )}>
          {isExpanded ? (
            <>
              <div className="flex items-center gap-2 flex-1">
                <Tv className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">NBA Matches</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refresh}
                  disabled={isRefreshing}
                  className="h-7 w-7"
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggle}
                  className="h-7 w-7"
                  aria-label="Collapse panel"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-8 w-8"
              aria-label="Expand panel"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Loading State */}
            {isLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading matches...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {!isLoading && (scheduleError || marketError) && (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="text-sm text-destructive">
                    {scheduleError?.message || marketError?.message || 'Failed to load data'}
                  </span>
                  <Button variant="outline" size="sm" onClick={refresh}>
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !scheduleError && totalMatches === 0 && (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Tv className="h-8 w-8 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">No games today</span>
                  <span className="text-xs text-muted-foreground/70">
                    Check back later for upcoming matches
                  </span>
                </div>
              </div>
            )}

            {/* Match Content */}
            {!isLoading && currentMatch && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Match Card */}
                <div className="flex-1 overflow-y-auto p-4">
                  <MatchCard
                    game={currentMatch.game}
                    market={currentMatch.market}
                  />
                </div>

                {/* Navigation */}
                <div className="border-t border-border p-3">
                  <MatchNavigation
                    currentIndex={currentIndex}
                    totalMatches={totalMatches}
                    onPrevious={goToPrevious}
                    onNext={goToNext}
                    onDotClick={goToIndex}
                    liveIndices={liveIndices}
                    upcomingIndices={upcomingIndices}
                  />
                </div>

                {/* Last Updated */}
                {lastUpdated && (
                  <div className="px-3 pb-2 text-[10px] text-muted-foreground/50 text-center">
                    Updated {format(lastUpdated, 'h:mm:ss a')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsed State Indicator */}
        {!isExpanded && hasLiveGames && (
          <div className="flex justify-center py-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Mobile Floating Button */}
      <button
        onClick={openMobileOverlay}
        className={cn(
          'md:hidden fixed bottom-20 right-4 z-40',
          'flex items-center justify-center',
          'w-12 h-12 rounded-full',
          'bg-primary text-primary-foreground',
          'shadow-lg hover:shadow-xl transition-shadow',
          hasLiveGames && 'ring-2 ring-red-500 ring-offset-2 ring-offset-background'
        )}
        aria-label="Open match panel"
      >
        <Tv className="h-5 w-5" />
        {hasLiveGames && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
            {liveGameCount}
          </span>
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileOverlayOpen && (
        <MobileMatchOverlay
          currentMatch={currentMatch}
          currentIndex={currentIndex}
          totalMatches={totalMatches}
          matches={matches}
          goToNext={goToNext}
          goToPrevious={goToPrevious}
          goToIndex={goToIndex}
          liveIndices={liveIndices}
          upcomingIndices={upcomingIndices}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          error={scheduleError || marketError}
          onRefresh={refresh}
          onClose={closeMobileOverlay}
          lastUpdated={lastUpdated}
          hasLiveGames={hasLiveGames}
          liveGameCount={liveGameCount}
          upcomingGameCount={upcomingGameCount}
        />
      )}
    </>
  );
}

/**
 * Mobile Full-Screen Overlay
 */
interface MobileMatchOverlayProps {
  currentMatch: ReturnType<typeof useMatchPanel>['currentMatch'];
  currentIndex: number;
  totalMatches: number;
  matches: ReturnType<typeof useMatchPanel>['matches'];
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
  liveIndices: number[];
  upcomingIndices: number[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  onRefresh: () => void;
  onClose: () => void;
  lastUpdated: Date | null;
  hasLiveGames: boolean;
  liveGameCount: number;
  upcomingGameCount: number;
}

function MobileMatchOverlay({
  currentMatch,
  currentIndex,
  totalMatches,
  goToNext,
  goToPrevious,
  goToIndex,
  liveIndices,
  upcomingIndices,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onClose,
  lastUpdated,
}: MobileMatchOverlayProps) {
  // Keyboard navigation for mobile too
  useMatchPanelKeyboard(goToNext, goToPrevious, true);

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Tv className="h-5 w-5 text-primary" />
          <span className="font-medium">NBA Matches</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading matches...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="text-destructive">{error.message}</span>
              <Button variant="outline" onClick={onRefresh}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && totalMatches === 0 && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <Tv className="h-12 w-12 text-muted-foreground/50" />
              <span className="text-lg text-muted-foreground">No games today</span>
              <span className="text-sm text-muted-foreground/70">
                Check back later for upcoming matches
              </span>
            </div>
          </div>
        )}

        {/* Match Content */}
        {!isLoading && currentMatch && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Match Card */}
            <div className="flex-1 overflow-y-auto p-6">
              <MatchCard
                game={currentMatch.game}
                market={currentMatch.market}
              />
            </div>

            {/* Navigation */}
            <div className="border-t border-border p-4">
              <MatchNavigation
                currentIndex={currentIndex}
                totalMatches={totalMatches}
                onPrevious={goToPrevious}
                onNext={goToNext}
                onDotClick={goToIndex}
                liveIndices={liveIndices}
                upcomingIndices={upcomingIndices}
              />
            </div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="px-4 pb-4 text-xs text-muted-foreground/50 text-center">
                Updated {format(lastUpdated, 'h:mm:ss a')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MatchPanel;
