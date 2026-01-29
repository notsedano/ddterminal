/**
 * Prediction Types
 * Types for the "PREDICT NOW" feature with thought streaming
 */

/**
 * Team information for prediction context
 */
export interface PredictionTeam {
  name: string;
  abbreviation: string;
  record?: string;
  id?: string;
}

/**
 * Matchup context for a prediction
 */
export interface PredictionMatchup {
  homeTeam: PredictionTeam;
  awayTeam: PredictionTeam;
  gameId: string;
  scheduledTime: string;
  sport: 'NBA' | 'NFL' | 'MLB' | 'NHL' | string;
  venue?: string;
  status?: string;
}

/**
 * Statistics context for prediction
 */
export interface PredictionStats {
  homeTeamStats?: Record<string, unknown>;
  awayTeamStats?: Record<string, unknown>;
  headToHead?: Record<string, unknown>;
  recentForm?: Record<string, unknown>;
  injuries?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Market/betting context for prediction
 */
export interface PredictionMarket {
  spread?: number;
  moneylineHome?: number;
  moneylineAway?: number;
  overUnder?: number;
  odds?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Full prediction context sent to the agent
 */
export interface PredictionContext {
  matchup: PredictionMatchup;
  stats?: PredictionStats;
  market?: PredictionMarket;
  userQuery?: string;
  additionalContext?: Record<string, unknown>;
}

/**
 * A single thought in the streaming thought process
 */
export interface PredictionThought {
  id: string;
  type: 'analyzing' | 'reasoning' | 'calculating' | 'concluding' | 'insight';
  content: string;
  timestamp: number;
  progress?: number; // 0-100, optional progress indicator
  phase?: 1 | 2 | 3; // Phase number for 3-part prediction responses
}

/**
 * SSE event types for prediction streaming
 */
export interface PredictionSSEChunkEvent {
  type: 'thought' | 'chunk' | 'progress';
  thought?: PredictionThought;
  chunk?: string;
  progress?: number;
  messageId?: string;
}

export interface PredictionSSECompleteEvent {
  type: 'complete';
  prediction: string;
  messageId: string;
  thoughts: PredictionThought[];
  confidence?: number;
}

export interface PredictionSSEErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

/**
 * Prediction session request
 */
export interface PredictionRequest {
  agentId: string;
  sessionId: string;
  roomId: string;
  query: string;
  context: PredictionContext;
}

/**
 * Prediction session response
 */
export interface PredictionResponse {
  predictionId: string;
  sessionId: string;
  success: boolean;
}

/**
 * State for the usePrediction hook
 */
export interface PredictionState {
  thoughts: PredictionThought[];
  isStreaming: boolean;
  prediction: string | null;
  error: string | null;
  progress: number;
  predictionId: string | null;
}

/**
 * Phases of thought for visual categorization
 */
export const THOUGHT_PHASES = {
  analyzing: {
    label: 'Analyzing Data',
    icon: '🔍',
    color: 'text-blue-400',
  },
  reasoning: {
    label: 'Reasoning',
    icon: '🧠',
    color: 'text-purple-400',
  },
  calculating: {
    label: 'Calculating',
    icon: '📊',
    color: 'text-green-400',
  },
  insight: {
    label: 'Key Insight',
    icon: '💡',
    color: 'text-yellow-400',
  },
  concluding: {
    label: 'Conclusion',
    icon: '🎯',
    color: 'text-amber-400',
  },
} as const;

export type ThoughtPhase = keyof typeof THOUGHT_PHASES;
