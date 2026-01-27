/**
 * Static NBA Team Data
 * Imported at build time for optimal tree-shaking
 * This data rarely changes and can be safely cached indefinitely
 */

/**
 * Team abbreviation mappings for matching Sportradar to Polymarket
 * Key: Polymarket team name (lowercase mascot)
 * Value: Array of aliases (abbreviation, full name variants)
 */
export const TEAM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // Eastern Conference - Atlantic
  'celtics': ['bos', 'boston celtics'],
  'nets': ['bkn', 'brooklyn nets'],
  'knicks': ['nyk', 'new york knicks', 'ny knicks'],
  'sixers': ['phi', 'philadelphia 76ers', '76ers'],
  'raptors': ['tor', 'toronto raptors'],
  
  // Eastern Conference - Central
  'bulls': ['chi', 'chicago bulls'],
  'cavaliers': ['cle', 'cleveland cavaliers', 'cavs'],
  'pistons': ['det', 'detroit pistons'],
  'pacers': ['ind', 'indiana pacers'],
  'bucks': ['mil', 'milwaukee bucks'],
  
  // Eastern Conference - Southeast
  'hawks': ['atl', 'atlanta hawks'],
  'hornets': ['cha', 'charlotte hornets'],
  'heat': ['mia', 'miami heat'],
  'magic': ['orl', 'orlando magic'],
  'wizards': ['was', 'washington wizards'],
  
  // Western Conference - Northwest
  'nuggets': ['den', 'denver nuggets'],
  'timberwolves': ['min', 'minnesota timberwolves', 'wolves'],
  'thunder': ['okc', 'oklahoma city thunder'],
  'trail blazers': ['por', 'portland trail blazers', 'blazers'],
  'jazz': ['uta', 'utah jazz'],
  
  // Western Conference - Pacific
  'warriors': ['gsw', 'golden state warriors', 'gs warriors'],
  'clippers': ['lac', 'la clippers', 'los angeles clippers'],
  'lakers': ['lal', 'los angeles lakers', 'la lakers'],
  'suns': ['phx', 'phoenix suns'],
  'kings': ['sac', 'sacramento kings'],
  
  // Western Conference - Southwest
  'mavericks': ['dal', 'dallas mavericks', 'mavs'],
  'rockets': ['hou', 'houston rockets'],
  'grizzlies': ['mem', 'memphis grizzlies'],
  'pelicans': ['nop', 'new orleans pelicans', 'pels'],
  'spurs': ['sas', 'san antonio spurs'],
} as const;

/**
 * NBA keywords for matching events
 * Used to identify NBA-related events from Polymarket
 */
export const NBA_KEYWORDS: readonly string[] = [
  // Team mascots
  'lakers', 'celtics', 'warriors', 'bulls', 'heat', 'knicks', 'nets',
  'bucks', 'suns', 'mavericks', 'mavs', 'nuggets', 'clippers', 'sixers', '76ers',
  'raptors', 'spurs', 'hawks', 'timberwolves', 'wolves', 'grizzlies', 'pelicans',
  'pels', 'thunder', 'trail blazers', 'blazers', 'jazz', 'kings', 'pistons',
  'pacers', 'hornets', 'magic', 'wizards', 'cavaliers', 'cavs', 'rockets',
  
  // City names
  'los angeles', 'boston', 'golden state', 'chicago', 'miami', 'new york',
  'brooklyn', 'milwaukee', 'phoenix', 'dallas', 'denver', 'philadelphia',
  'toronto', 'san antonio', 'atlanta', 'minnesota', 'memphis', 'new orleans',
  'oklahoma city', 'portland', 'utah', 'sacramento', 'detroit', 'indiana',
  'charlotte', 'orlando', 'washington', 'cleveland', 'houston',
  
  // Keywords
  'nba',
] as const;

/**
 * Team abbreviation to full name mapping
 * Useful for display purposes
 */
export const TEAM_FULL_NAMES: Readonly<Record<string, string>> = {
  'ATL': 'Atlanta Hawks',
  'BOS': 'Boston Celtics',
  'BKN': 'Brooklyn Nets',
  'CHA': 'Charlotte Hornets',
  'CHI': 'Chicago Bulls',
  'CLE': 'Cleveland Cavaliers',
  'DAL': 'Dallas Mavericks',
  'DEN': 'Denver Nuggets',
  'DET': 'Detroit Pistons',
  'GSW': 'Golden State Warriors',
  'HOU': 'Houston Rockets',
  'IND': 'Indiana Pacers',
  'LAC': 'Los Angeles Clippers',
  'LAL': 'Los Angeles Lakers',
  'MEM': 'Memphis Grizzlies',
  'MIA': 'Miami Heat',
  'MIL': 'Milwaukee Bucks',
  'MIN': 'Minnesota Timberwolves',
  'NOP': 'New Orleans Pelicans',
  'NYK': 'New York Knicks',
  'OKC': 'Oklahoma City Thunder',
  'ORL': 'Orlando Magic',
  'PHI': 'Philadelphia 76ers',
  'PHX': 'Phoenix Suns',
  'POR': 'Portland Trail Blazers',
  'SAC': 'Sacramento Kings',
  'SAS': 'San Antonio Spurs',
  'TOR': 'Toronto Raptors',
  'UTA': 'Utah Jazz',
  'WAS': 'Washington Wizards',
} as const;

/**
 * Lookup team by any identifier (alias, abbreviation, or mascot)
 */
export function findTeamByIdentifier(identifier: string): string | null {
  const lower = identifier.toLowerCase();
  
  // Direct mascot match
  if (TEAM_ALIASES[lower]) {
    return lower;
  }
  
  // Search through aliases
  for (const [mascot, aliases] of Object.entries(TEAM_ALIASES)) {
    if (aliases.some(alias => alias.toLowerCase() === lower)) {
      return mascot;
    }
  }
  
  return null;
}
