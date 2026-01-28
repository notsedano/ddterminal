import type { Message } from '@/types';

export function convertApiMessageToMessage(
  apiMsg: {
    id?: string;
    content?: string;
    text?: string;
    authorId?: string;
    userId?: string;
    isAgent?: boolean;
    createdAt?: string;
    metadata?: Record<string, unknown>;
  },
  sessionId: string,
  agentId: string
): Message {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required');
  }
  if (!agentId || typeof agentId !== 'string') {
    throw new Error('agentId is required');
  }

  return {
    id: apiMsg.id || `msg-${Date.now()}-${Math.random()}`,
    text: apiMsg.content || apiMsg.text || '',
    userId: apiMsg.authorId || apiMsg.userId || '',
    agentId: apiMsg.isAgent ? apiMsg.authorId || agentId : agentId,
    sessionId,
    createdAt: apiMsg.createdAt || new Date().toISOString(),
    role: apiMsg.isAgent ? 'agent' : 'user',
    metadata: apiMsg.metadata,
  };
}

export function mergeMessages(existing: Message[], newMessages: Message[]): Message[] {
  if (!Array.isArray(existing) || !Array.isArray(newMessages)) {
    throw new Error('Both arguments must be arrays');
  }

  const existingIds = new Set(existing.map(m => m.id));
  const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
  
  if (uniqueNew.length === 0) return existing;
  
  return [...existing, ...uniqueNew].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

const NBA_ABBREVS = new Set([
  'por', 'was', 'lal', 'bos', 'ny', 'nyk', 'tor', 'gsw', 'chi', 'mia',
  'den', 'sa', 'okc', 'det', 'bkn', 'atl', 'cha', 'cle', 'dal', 'hou',
  'ind', 'lac', 'mem', 'min', 'no', 'sac', 'orl', 'phi', 'phx', 'uta'
]);

const TEAM_NAME_PATTERN = /(?:new york\s+)?(?:new york\s+)?(knicks|raptors|lakers|celtics|warriors|bulls|heat|nuggets|spurs|thunder|pistons|trail blazers|wizards|portland|washington|nets|hawks|hornets|cavaliers|mavericks|rockets|pacers|clippers|grizzlies|timberwolves|pelicans|kings|magic|76ers|suns|jazz)/gi;

const ABBREV_MAP: Record<string, string[]> = {
  por: ['portland', 'trail blazers'],
  was: ['washington', 'wizards'],
  ny: ['knicks', 'new york'],
  nyk: ['knicks', 'new york'],
  tor: ['raptors', 'toronto'],
};

function extractTeams(text: string): { abbrevs: string[]; names: string[] } {
  const textLower = text.toLowerCase();
  const abbrevPattern = /\b([A-Z]{2,4})\b/g;
  const abbrevs = Array.from(textLower.matchAll(abbrevPattern))
    .map(m => m[1].toLowerCase())
    .filter(abbrev => NBA_ABBREVS.has(abbrev));
  
  const nameMatches = Array.from(textLower.matchAll(TEAM_NAME_PATTERN));
  const names = nameMatches.map(m => m[1].toLowerCase());
  
  return { abbrevs, names };
}

export function isMessageRelated(agentText: string, userText: string): boolean {
  if (typeof agentText !== 'string' || typeof userText !== 'string') {
    throw new Error('Both arguments must be strings');
  }

  if (!userText.includes('PREDICTION REQUEST') && !userText.toLowerCase().includes('prediction')) {
    return true;
  }
  
  const userTeams = extractTeams(userText);
  const agentTeams = extractTeams(agentText);
  
  if (userTeams.abbrevs.length === 0 && userTeams.names.length === 0) {
    return true;
  }
  
  const mentionsUserTeams = 
    userTeams.abbrevs.some(abbrev => agentText.toLowerCase().includes(abbrev)) ||
    userTeams.names.some(name => {
      const agentLower = agentText.toLowerCase();
      return agentLower.includes(name) || agentLower.includes(name.split(' ')[0]);
    });
  
  if (mentionsUserTeams) return true;
  
  if (agentTeams.abbrevs.length === 0 && agentTeams.names.length === 0) {
    return true;
  }
  
  const hasMatchingTeam = 
    userTeams.names.some(ut => 
      agentTeams.names.some(at => at === ut || at.includes(ut) || ut.includes(at))
    ) ||
    userTeams.abbrevs.some(ua => agentTeams.abbrevs.includes(ua)) ||
    userTeams.abbrevs.some(ua => {
      const variants = ABBREV_MAP[ua] || [];
      return agentTeams.names.some(at => 
        variants.some(v => at.includes(v) || v.includes(at))
      );
    });
  
  return hasMatchingTeam;
}
