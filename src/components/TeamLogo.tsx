/**
 * Team Logo Component
 * Maps team aliases to react-nba-logos components
 */

import * as NBAIcons from 'react-nba-logos';
import { cn } from '@/utils/cn';

interface TeamLogoProps {
  alias: string;
  size?: number;
  className?: string;
}

/**
 * Map team aliases to react-nba-logos component names
 * The package uses 3-letter codes (e.g., TOR, NYK, PHI)
 */
const TEAM_LOGO_MAP: Record<string, keyof typeof NBAIcons> = {
  'ATL': 'ATL',
  'BOS': 'BOS',
  'BKN': 'BKN',
  'CHA': 'CHA',
  'CHI': 'CHI',
  'CLE': 'CLE',
  'DAL': 'DAL',
  'DEN': 'DEN',
  'DET': 'DET',
  'GSW': 'GSW',
  'HOU': 'HOU',
  'IND': 'IND',
  'LAC': 'LAC',
  'LAL': 'LAL',
  'MEM': 'MEM',
  'MIA': 'MIA',
  'MIL': 'MIL',
  'MIN': 'MIN',
  'NOP': 'NOP',
  'NYK': 'NYK',
  'OKC': 'OKC',
  'ORL': 'ORL',
  'PHI': 'PHI',
  'PHX': 'PHX',
  'POR': 'POR',
  'SAC': 'SAC',
  'SAS': 'SAS',
  'TOR': 'TOR',
  'UTA': 'UTA',
  'WAS': 'WAS',
};

export function TeamLogo({ alias, size = 40, className }: TeamLogoProps) {
  const aliasUpper = alias.toUpperCase();
  const logoKey = TEAM_LOGO_MAP[aliasUpper];
  
  // Try to get the logo component from the package
  let LogoComponent: React.ComponentType<{ size?: number }> | null = null;
  
  if (logoKey && NBAIcons[logoKey]) {
    LogoComponent = NBAIcons[logoKey] as React.ComponentType<{ size?: number }>;
  }

  if (!LogoComponent) {
    // Fallback to text if logo not found
    return (
      <div className={cn(
        'flex items-center justify-center rounded-lg',
        'bg-gradient-to-br from-muted to-muted/50',
        'text-sm font-bold',
        className
      )} style={{ width: size, height: size }}>
        {alias}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <LogoComponent size={size} />
    </div>
  );
}
