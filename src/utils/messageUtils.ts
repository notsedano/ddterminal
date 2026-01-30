import type { Message } from '@/types';

/**
 * Safely extract error message from any error type
 * Simple, direct implementation - no over-engineering
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || 'Unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') {
      return msg;
    }
    if (msg instanceof Error) {
      return msg.message || msg.name || 'Unknown error';
    }
    return String(msg);
  }
  return String(error);
}

/**
 * Sanitizes metadata to ensure it's fully serializable (no circular references)
 * This is critical for storage operations (IndexedDB, Supabase) and API requests
 * 
 * Handles:
 * - Circular references (returns null for circular refs)
 * - Functions (removed)
 * - Undefined values (removed)
 * - Non-serializable objects (Date, RegExp, etc. converted to strings)
 * - Nested objects and arrays
 */
export function sanitizeMetadata(metadata: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  // Use a Map to track seen objects with their path for better debugging
  const seen = new WeakSet<object>();
  
  const sanitize = (value: unknown, depth: number = 0): unknown => {
    // Prevent infinite recursion
    if (depth > 100) {
      console.warn('[sanitizeMetadata] Maximum depth reached, truncating object');
      return null;
    }
    
    if (value === null || value === undefined) {
      return null;
    }
    
    // Handle primitives
    if (typeof value === 'function') {
      return undefined; // Remove functions
    }
    
    if (typeof value !== 'object') {
      return value;
    }
    
    // Check for circular references
    if (seen.has(value as object)) {
      return null; // Replace circular reference with null
    }
    
    // Handle special objects that aren't directly serializable
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (value instanceof RegExp) {
      return value.toString();
    }
    
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    
    // Mark as seen before recursing
    seen.add(value as object);
    
    try {
      if (Array.isArray(value)) {
        const sanitized = value.map(item => sanitize(item, depth + 1)).filter(item => item !== undefined);
        return sanitized;
      }
      
      const result: Record<string, unknown> = {};
      for (const key in value) {
        // Skip prototype properties
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue;
        }
        
        try {
          const sanitized = sanitize((value as Record<string, unknown>)[key], depth + 1);
          if (sanitized !== undefined) {
            result[key] = sanitized;
          }
        } catch (err) {
          // If sanitization fails for a specific property, skip it
          console.warn(`[sanitizeMetadata] Failed to sanitize property "${key}":`, err);
        }
      }
      
      return result;
    } catch (err) {
      // If sanitization fails entirely, return empty object
      console.error('[sanitizeMetadata] Error during sanitization:', err);
      return {};
    }
  };
  
  try {
    const result = sanitize(metadata) as Record<string, unknown>;
    // Verify the result is serializable
    JSON.stringify(result);
    return result;
  } catch (error) {
    console.error('[sanitizeMetadata] Failed to sanitize metadata, returning empty object:', error);
    return {};
  }
}

export function convertApiMessageToMessage(
  apiMsg: {
    id?: string;
    content?: string;
    text?: string;
    authorId?: string;
    author_id?: string; // API uses snake_case
    userId?: string;
    isAgent?: boolean;
    source_type?: string; // API field: 'user' or 'agent'
    createdAt?: string;
    created_at?: number; // API uses created_at as timestamp
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

  // Get author ID from either camelCase or snake_case
  const authorId = apiMsg.author_id || apiMsg.authorId || apiMsg.userId || '';
  
  // Determine if message is from agent:
  // 1. Check isAgent field (if present)
  // 2. Check source_type === 'agent' (API field)
  // 3. Check if author_id matches agentId
  const isAgent = 
    apiMsg.isAgent === true ||
    apiMsg.source_type === 'agent' ||
    (authorId && authorId === agentId);

  // Convert created_at timestamp to ISO string if needed
  let createdAt = apiMsg.createdAt || new Date().toISOString();
  if (apiMsg.created_at && typeof apiMsg.created_at === 'number') {
    createdAt = new Date(apiMsg.created_at).toISOString();
  }

  // For prediction messages, preserve displayText from metadata if it exists
  const rawMetadata = apiMsg.metadata || {};
  const metadata = sanitizeMetadata(rawMetadata);
  const isPredictionMessage = metadata.isPredictionMessage === true;
  const displayText = metadata.displayText as string | undefined;
  
  // Use displayText if this is a prediction message, otherwise use actual content
  const text = (isPredictionMessage && displayText) ? displayText : (apiMsg.content || apiMsg.text || '');

  return {
    id: apiMsg.id || `msg-${Date.now()}-${Math.random()}`,
    text,
    userId: authorId,
    agentId: isAgent ? (authorId || agentId) : agentId,
    sessionId,
    createdAt,
    role: isAgent ? 'agent' : 'user',
    metadata,
  };
}

export function mergeMessages(existing: Message[], newMessages: Message[]): Message[] {
  if (!Array.isArray(existing) || !Array.isArray(newMessages)) {
    throw new Error('Both arguments must be arrays');
  }

  const existingIds = new Set(existing.map(m => m.id));
  
  // Filter out messages that already exist by ID only
  // The recentlySentMessageIdsRef in useChat handles polling duplicates
  const uniqueNew = newMessages.filter(newMsg => {
    // Skip if ID already exists
    if (existingIds.has(newMsg.id)) {
      return false;
    }
    return true;
  });
  
  if (uniqueNew.length === 0) {
    // No new messages, just sanitize existing ones
    return existing.map(msg => {
      const sanitizedMetadata = sanitizeMetadata(msg.metadata);
      if (sanitizedMetadata.isPredictionMessage && sanitizedMetadata.displayText) {
        return {
          ...msg,
          text: sanitizedMetadata.displayText as string,
          metadata: sanitizedMetadata,
        };
      }
      return {
        ...msg,
        metadata: sanitizedMetadata,
      };
    });
  }

  // Sanitize new messages
  const processedNew = uniqueNew.map(newMsg => {
    const sanitizedMetadata = sanitizeMetadata(newMsg.metadata);
    
    // For prediction messages from API, ensure displayText is used if available
    if (sanitizedMetadata.isPredictionMessage && sanitizedMetadata.displayText) {
      return {
        ...newMsg,
        text: sanitizedMetadata.displayText as string,
        metadata: sanitizedMetadata,
      };
    }
    
    return {
      ...newMsg,
      metadata: sanitizedMetadata,
    };
  });

  // Preserve existing messages with their displayText
  const preservedExisting = existing.map(existingMsg => {
    const sanitizedMetadata = sanitizeMetadata(existingMsg.metadata);
    
    if (sanitizedMetadata.isPredictionMessage && sanitizedMetadata.displayText) {
      return {
        ...existingMsg,
        text: sanitizedMetadata.displayText as string,
        metadata: sanitizedMetadata,
      };
    }
    return {
      ...existingMsg,
      metadata: sanitizedMetadata,
    };
  });

  return [...preservedExisting, ...processedNew].sort(
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
