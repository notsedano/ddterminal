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
  const [isExpanded, setIsExpanded] = useState(!compact);
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
    <div className={cn('flex flex-col gap-3 border-t border-border pt-3', className)}>
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
  const criticalInjuries = team.players.filter(p => 
    p.injuries.some(i => i.status === 'Out' || i.status === 'Doubtful')
  );
  const questionableInjuries = team.players.filter(p => 
    p.injuries.some(i => i.status === 'Questionable' || i.status === 'Day-To-Day')
  );
  const probableInjuries = team.players.filter(p => 
    p.injuries.some(i => i.status === 'Probable')
  );

  return (
    <div className="flex flex-col gap-2 p-2 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold">{team.market} {team.name}</span>
        <span className="text-[10px] text-muted-foreground">
          ({team.players.length} {team.players.length === 1 ? 'player' : 'players'})
        </span>
      </div>

      {/* Critical Injuries (Out/Doubtful) */}
      {criticalInjuries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {criticalInjuries.map(player => (
            <PlayerInjury
              key={player.id}
              player={player}
              severity="critical"
            />
          ))}
        </div>
      )}

      {/* Questionable Injuries */}
      {questionableInjuries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {questionableInjuries.map(player => (
            <PlayerInjury
              key={player.id}
              player={player}
              severity="questionable"
            />
          ))}
        </div>
      )}

      {/* Probable Injuries */}
      {probableInjuries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {probableInjuries.map(player => (
            <PlayerInjury
              key={player.id}
              player={player}
              severity="probable"
            />
          ))}
        </div>
      )}
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
