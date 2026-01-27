/**
 * Injury Report Component
 * Displays injury information for teams in a game
 */

import { memo } from 'react';
import { cn } from '@/utils/cn';
import type { NBATeamInjuries, NBAInjuredPlayer } from '@/types';
import { AlertTriangle, CheckCircle2, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface InjuryReportProps {
  homeInjuries: NBATeamInjuries | null;
  awayInjuries: NBATeamInjuries | null;
  className?: string;
  compact?: boolean;
}

/**
 * Main Injury Report component
 */
export const InjuryReport = memo(function InjuryReport({
  homeInjuries,
  awayInjuries,
  className,
  compact = false,
}: InjuryReportProps) {
  // Injury report minimized by default
  const [isExpanded, setIsExpanded] = useState(false);
  const totalInjuries = (homeInjuries?.players?.length ?? 0) + (awayInjuries?.players?.length ?? 0);
  const hasInjuries = totalInjuries > 0;

  if (compact) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {hasInjuries ? (
          <>
            {homeInjuries && homeInjuries.players.length > 0 && (
              <TeamInjuriesCompact team={homeInjuries} />
            )}
            {awayInjuries && awayInjuries.players.length > 0 && (
              <TeamInjuriesCompact team={awayInjuries} />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center p-1.5 rounded bg-muted/30">
            <span className="text-[10px] text-green-400">No injuries reported</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2 border-t border-border pt-2', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          {hasInjuries ? (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          <span>Injury Report</span>
          {hasInjuries ? (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
              {totalInjuries}
            </span>
          ) : (
            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
              None
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-3">
          {hasInjuries ? (
            <>
              {homeInjuries && homeInjuries.players.length > 0 && (
                <TeamInjuries team={homeInjuries} />
              )}
              {awayInjuries && awayInjuries.players.length > 0 && (
                <TeamInjuries team={awayInjuries} />
              )}
            </>
          ) : (
            <NoInjuriesDisplay />
          )}
        </div>
      )}
    </div>
  );
});

/**
 * No Injuries Display
 */
const NoInjuriesDisplay = memo(function NoInjuriesDisplay() {
  return (
    <div className="flex flex-col items-center justify-center py-4 px-3 rounded-lg bg-green-500/5 border border-green-500/10">
      <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
      <span className="text-xs font-medium text-green-400">No Injuries Reported</span>
      <span className="text-[10px] text-muted-foreground mt-1">
        Both teams have a clean bill of health
      </span>
    </div>
  );
});

/**
 * Team Injuries Display
 */
interface TeamInjuriesProps {
  team: NBATeamInjuries;
}

const TeamInjuries = memo(function TeamInjuries({ team }: TeamInjuriesProps) {
  // Show all players, sorted by severity (Out/Doubtful first, then Questionable, then Probable)
  const sortedPlayers = [...team.players].sort((a, b) => {
    const getSeverityOrder = (player: NBAInjuredPlayer): number => {
      const status = player.injuries[0]?.status || '';
      if (status === 'Out' || status === 'Doubtful' || status.includes('Out')) return 0;
      if (status === 'Questionable' || status === 'Day-To-Day') return 1;
      if (status === 'Probable') return 2;
      return 3;
    };
    return getSeverityOrder(a) - getSeverityOrder(b);
  });

  return (
    <div className="flex flex-col gap-2 p-2 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold">{team.market} {team.name}</span>
        <span className="text-[10px] text-muted-foreground">
          ({team.players.length} {team.players.length === 1 ? 'player' : 'players'})
        </span>
      </div>

      {/* Table Format - Show all players */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Player</th>
              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Pos</th>
              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Status</th>
              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Injury</th>
              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Updated</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player) => {
              const primaryInjury = player.injuries[0];
              if (!primaryInjury) return null;
              
              const status = primaryInjury.status || 'Unknown';
              
              // Extract injury type from desc or comment
              // Try to get a clean injury name (e.g., "Hamstring", "Quad", "Shoulder")
              let injuryType = '-';
              if (primaryInjury.desc) {
                // Try to extract the injury type from description
                // Common patterns: "Hamstring", "Injury Management", "Foot", "Back", etc.
                const desc = primaryInjury.desc;
                // Look for common injury keywords
                const injuryKeywords = ['Hamstring', 'Quad', 'Knee', 'Ankle', 'Foot', 'Back', 'Shoulder', 'Thoracic', 'Wrist', 'Hand', 'Groin', 'Calf', 'Achilles', 'Hip', 'Elbow', 'Neck', 'Head', 'Concussion'];
                const foundKeyword = injuryKeywords.find(keyword => 
                  desc.toLowerCase().includes(keyword.toLowerCase())
                );
                if (foundKeyword) {
                  injuryType = foundKeyword;
                } else {
                  // Fallback: take first word or phrase before comma/dash
                  injuryType = desc.split(/[,\-–—]/)[0].trim();
                }
              } else if (primaryInjury.comment) {
                injuryType = primaryInjury.comment.split(/[,\-–—]/)[0].trim();
              }
              
              // Format date as "Jan 26" or "Jan 14"
              let updatedDate = '-';
              try {
                if (primaryInjury.update_date) {
                  const date = new Date(primaryInjury.update_date);
                  updatedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } else if (primaryInjury.start_date) {
                  const date = new Date(primaryInjury.start_date);
                  updatedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
              } catch (e) {
                // Invalid date, keep as '-'
              }

              // Determine severity for styling - handle "Out For Season" and other variations
              const statusLower = status.toLowerCase();
              const isCritical = statusLower.includes('out') || status === 'Doubtful';
              const isQuestionable = status === 'Questionable' || status === 'Day-To-Day';
              const isProbable = status === 'Probable';

              return (
                <tr 
                  key={player.id}
                  className={cn(
                    'border-b border-border/30 hover:bg-muted/20 transition-colors',
                    isCritical && 'bg-red-500/5',
                    isQuestionable && 'bg-yellow-500/5',
                    isProbable && 'bg-green-500/5'
                  )}
                >
                  <td className="py-1.5 px-2">
                    <span className="font-medium">
                      #{player.jersey_number || '?'} {player.full_name}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground">
                    {player.position || player.primary_position || '-'}
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        isCritical && 'bg-red-500',
                        isQuestionable && 'bg-yellow-500',
                        isProbable && 'bg-green-500',
                        !isCritical && !isQuestionable && !isProbable && 'bg-muted-foreground'
                      )} />
                      <span className={cn(
                        'font-medium',
                        isCritical && 'text-red-400',
                        isQuestionable && 'text-yellow-400',
                        isProbable && 'text-green-400'
                      )}>
                        {status}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground">
                    {injuryType}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground">
                    {updatedDate}
                  </td>
                </tr>
              );
            }).filter(Boolean)}
          </tbody>
        </table>
      </div>
    </div>
  );
});

/**
 * Compact Team Injuries Display
 */
const TeamInjuriesCompact = memo(function TeamInjuriesCompact({ team }: TeamInjuriesProps) {
  const criticalCount = team.players.filter(p => 
    p.injuries.some(i => i.status === 'Out' || i.status === 'Doubtful')
  ).length;
  const questionableCount = team.players.filter(p => 
    p.injuries.some(i => i.status === 'Questionable' || i.status === 'Day-To-Day')
  ).length;

  return (
    <div className="flex items-center justify-between p-1.5 rounded bg-muted/30">
      <span className="text-[10px] font-medium">{team.alias}</span>
      <div className="flex items-center gap-1.5">
        {criticalCount > 0 && (
          <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
            {criticalCount} Out
          </span>
        )}
        {questionableCount > 0 && (
          <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
            {questionableCount} Q
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * Player Injury Display
 */
interface PlayerInjuryProps {
  player: NBAInjuredPlayer;
  severity: 'critical' | 'questionable' | 'probable';
}

const PlayerInjury = memo(function PlayerInjury({ player, severity }: PlayerInjuryProps) {
  const primaryInjury = player.injuries[0];
  const statusColor = {
    critical: 'text-red-400',
    questionable: 'text-yellow-400',
    probable: 'text-green-400',
  }[severity];

  const statusBg = {
    critical: 'bg-red-500/10',
    questionable: 'bg-yellow-500/10',
    probable: 'bg-green-500/10',
  }[severity];

  return (
    <div className={cn('flex items-start gap-2 p-1.5 rounded', statusBg)}>
      <User className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium truncate">
            {player.full_name}
            {player.jersey_number && (
              <span className="text-muted-foreground ml-1">#{player.jersey_number}</span>
            )}
            {player.position && (
              <span className="text-muted-foreground ml-1">({player.position})</span>
            )}
          </span>
          {primaryInjury && (
            <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded', statusColor, statusBg)}>
              {primaryInjury.status}
            </span>
          )}
        </div>
        {primaryInjury?.desc && (
          <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">
            {primaryInjury.desc}
          </p>
        )}
        {primaryInjury?.comment && (
          <p className="text-[9px] text-muted-foreground/70 mt-0.5 italic line-clamp-1">
            {primaryInjury.comment}
          </p>
        )}
      </div>
    </div>
  );
});
