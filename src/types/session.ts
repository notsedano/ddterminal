export interface Session {
  sessionId: string;
  channelId: string;
  agentId: string;
  userId: string;
  createdAt: string;
  metadata: SessionMetadata;
  expiresAt: string;
  timeoutConfig: {
    timeoutMinutes: number;
    autoRenew: boolean;
    maxDurationMinutes: number;
    warningThresholdMinutes: number;
  };
}

/**
 * Session metadata - stores matchup info and other context
 */
export interface SessionMetadata {
  /** Matchup title (e.g., "Lakers vs Celtics") */
  matchupTitle?: string;
  /** Game/matchup ID from the sports API */
  gameId?: string;
  /** Home team info */
  homeTeam?: {
    id: string;
    name: string;
    alias: string;
  };
  /** Away team info */
  awayTeam?: {
    id: string;
    name: string;
    alias: string;
  };
  /** Sport type */
  sport?: 'NBA' | 'NFL' | 'MLB' | 'NHL' | 'other';
  /** Scheduled game time */
  scheduledTime?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface CreateSessionRequest {
  agentId: string;
  userId: string;
  channelId: string;
  metadata?: SessionMetadata;
}

export interface CreateSessionResponse extends Session {}

/**
 * Archived session - stores deleted conversations
 */
export interface ArchivedSession {
  id: string;
  originalSessionId: string;
  userId: string;
  channelId: string;
  agentId: string;
  matchupTitle: string | null;
  matchupData: SessionMetadata;
  originalCreatedAt: string;
  originalExpiresAt: string | null;
  originalMetadata: SessionMetadata;
  timeoutConfig: Session['timeoutConfig'] | null;
  messageCount: number;
  messages: ArchivedMessage[];
  conversationSummary: Record<string, unknown>;
  memoryFragments: Record<string, unknown>[];
  archivedAt: string;
  archivedBy: string | null;
  archiveReason: 'user_deleted' | 'expired' | 'system_cleanup';
}

export interface ArchivedMessage {
  id: string;
  text: string;
  userId: string;
  agentId?: string;
  role: 'user' | 'agent';
  createdAt: string;
}
