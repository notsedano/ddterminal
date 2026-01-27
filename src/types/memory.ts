/**
 * Memory System Types
 * Types for short-term memory and context profiling
 */

import type {
  ConversationSummaryRow,
  UserContextProfileRow,
  MemoryFragmentRow,
} from './database';

// ============================================================================
// Memory Fragment Types
// ============================================================================

export type MemoryType = 'fact' | 'preference' | 'intent' | 'entity' | 'context';

export interface MemoryFragment {
  id: string;
  userId: string;
  sessionId: string | null;
  agentId: string;
  memoryType: MemoryType;
  content: string;
  confidence: number;
  sourceMessageId: string | null;
  extractedAt: string;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateMemoryFragment {
  userId: string;
  sessionId?: string | null;
  agentId: string;
  memoryType: MemoryType;
  content: string;
  confidence?: number;
  sourceMessageId?: string | null;
  importance?: number;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Conversation Summary Types
// ============================================================================

export interface KeyEntities {
  teams?: string[];
  players?: string[];
  markets?: string[];
  sports?: string[];
  other?: string[];
}

export interface ConversationSummary {
  id: string;
  sessionId: string;
  userId: string;
  agentId: string;
  summary: string;
  keyTopics: string[];
  keyEntities: KeyEntities;
  sentimentScore: number;
  messageCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateConversationSummary {
  sessionId: string;
  userId: string;
  agentId: string;
  summary: string;
  keyTopics?: string[];
  keyEntities?: KeyEntities;
  sentimentScore?: number;
  messageCount?: number;
  firstMessageAt?: string | null;
  lastMessageAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateConversationSummary {
  summary?: string;
  keyTopics?: string[];
  keyEntities?: KeyEntities;
  sentimentScore?: number;
  messageCount?: number;
  lastMessageAt?: string | null;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// User Context Profile Types
// ============================================================================

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export interface CommunicationStyle {
  formality?: 'formal' | 'casual' | 'mixed';
  verbosity?: 'concise' | 'moderate' | 'verbose';
  emoji_usage?: 'none' | 'minimal' | 'frequent';
  preferred_response_length?: 'short' | 'medium' | 'long';
}

export interface BettingPreferences {
  preferredBetTypes?: string[];
  typicalStakeSizes?: string[];
  preferredOddsFormat?: 'american' | 'decimal' | 'fractional';
  hedgingPreference?: boolean;
  liveBettingInterest?: boolean;
}

export interface UserContextProfile {
  id: string;
  userId: string;
  agentId: string;
  displayName: string | null;
  inferredInterests: string[];
  communicationStyle: CommunicationStyle;
  preferredTopics: string[];
  favoriteTeams: string[];
  favoriteSports: string[];
  riskTolerance: RiskTolerance;
  bettingPreferences: BettingPreferences;
  totalSessions: number;
  totalMessages: number;
  avgSessionDurationMinutes: number;
  lastInteractionAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateUserContextProfile {
  userId: string;
  agentId: string;
  displayName?: string | null;
  inferredInterests?: string[];
  communicationStyle?: CommunicationStyle;
  preferredTopics?: string[];
  favoriteTeams?: string[];
  favoriteSports?: string[];
  riskTolerance?: RiskTolerance;
  bettingPreferences?: BettingPreferences;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserContextProfile {
  displayName?: string | null;
  inferredInterests?: string[];
  communicationStyle?: CommunicationStyle;
  preferredTopics?: string[];
  favoriteTeams?: string[];
  favoriteSports?: string[];
  riskTolerance?: RiskTolerance;
  bettingPreferences?: BettingPreferences;
  totalSessions?: number;
  totalMessages?: number;
  avgSessionDurationMinutes?: number;
  lastInteractionAt?: string | null;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Memory Context Types (for chat integration)
// ============================================================================

/**
 * Aggregated memory context for a chat session
 * This is what gets passed to the agent for context awareness
 */
export interface MemoryContext {
  // User profile summary
  userProfile: UserContextProfile | null;

  // Recent conversation summaries (last N sessions)
  recentSummaries: ConversationSummary[];

  // Current session summary (if exists)
  currentSessionSummary: ConversationSummary | null;

  // Relevant memory fragments sorted by importance
  relevantMemories: MemoryFragment[];

  // Quick access to key user facts
  userFacts: {
    displayName: string | null;
    favoriteTeams: string[];
    favoriteSports: string[];
    riskTolerance: RiskTolerance;
    recentTopics: string[];
  };

  // Metadata
  lastUpdated: string;
  memoryCount: number;
}

/**
 * Options for retrieving memory context
 */
export interface MemoryContextOptions {
  sessionId?: string;
  agentId: string;
  maxRecentSummaries?: number;
  maxMemoryFragments?: number;
  memoryTypes?: MemoryType[];
  minConfidence?: number;
  includeExpired?: boolean;
}

// ============================================================================
// Conversion Utilities
// ============================================================================

export function memoryFragmentFromRow(row: MemoryFragmentRow): MemoryFragment {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    agentId: row.agent_id,
    memoryType: row.memory_type,
    content: row.content,
    confidence: row.confidence,
    sourceMessageId: row.source_message_id,
    extractedAt: row.extracted_at,
    importance: row.importance,
    accessCount: row.access_count,
    lastAccessedAt: row.last_accessed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    metadata: row.metadata as Record<string, unknown> | undefined,
  };
}

export function conversationSummaryFromRow(row: ConversationSummaryRow): ConversationSummary {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    agentId: row.agent_id,
    summary: row.summary,
    keyTopics: row.key_topics || [],
    keyEntities: (row.key_entities as KeyEntities) || {},
    sentimentScore: row.sentiment_score,
    messageCount: row.message_count,
    firstMessageAt: row.first_message_at,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata as Record<string, unknown> | undefined,
  };
}

export function userContextProfileFromRow(row: UserContextProfileRow): UserContextProfile {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    displayName: row.display_name,
    inferredInterests: row.inferred_interests || [],
    communicationStyle: (row.communication_style as CommunicationStyle) || {},
    preferredTopics: row.preferred_topics || [],
    favoriteTeams: row.favorite_teams || [],
    favoriteSports: row.favorite_sports || [],
    riskTolerance: row.risk_tolerance,
    bettingPreferences: (row.betting_preferences as BettingPreferences) || {},
    totalSessions: row.total_sessions,
    totalMessages: row.total_messages,
    avgSessionDurationMinutes: row.avg_session_duration_minutes,
    lastInteractionAt: row.last_interaction_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata as Record<string, unknown> | undefined,
  };
}
