/**
 * Prediction API Service
 * Handles prediction session creation and management
 */

import { getApiBase, getAuthToken } from '@/utils/config';
import type { PredictionContext, PredictionRequest, PredictionResponse } from '@/types/prediction';

/**
 * Create a prediction session/request
 * This initiates a prediction analysis with the agent
 */
export async function createPredictionSession(
  agentId: string,
  sessionId: string,
  roomId: string,
  query: string,
  context: PredictionContext
): Promise<PredictionResponse> {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error('No API base URL configured');
  }

  const authToken = getAuthToken();
  const url = new URL(`${apiBase}/agents/${agentId}/predict`);

  const requestBody: PredictionRequest = {
    agentId,
    sessionId,
    roomId,
    query,
    context,
  };

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Prediction request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get the SSE stream URL for a prediction
 */
export function getPredictionStreamUrl(agentId: string, roomId: string, predictionId?: string): string {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error('No API base URL configured');
  }

  const authToken = getAuthToken();
  const url = new URL(`${apiBase}/agents/${agentId}/predict/stream`);
  url.searchParams.set('roomId', roomId);
  if (predictionId) {
    url.searchParams.set('predictionId', predictionId);
  }
  if (authToken) {
    url.searchParams.set('token', authToken);
  }

  return url.toString();
}

/**
 * Build prediction context from current session/matchup data
 */
export function buildPredictionContext(params: {
  homeTeam: { name: string; abbreviation: string; record?: string };
  awayTeam: { name: string; abbreviation: string; record?: string };
  gameId: string;
  scheduledTime: string;
  sport?: string;
  stats?: Record<string, unknown>;
  market?: Record<string, unknown>;
}): PredictionContext {
  return {
    matchup: {
      homeTeam: {
        name: params.homeTeam.name,
        abbreviation: params.homeTeam.abbreviation,
        record: params.homeTeam.record,
      },
      awayTeam: {
        name: params.awayTeam.name,
        abbreviation: params.awayTeam.abbreviation,
        record: params.awayTeam.record,
      },
      gameId: params.gameId,
      scheduledTime: params.scheduledTime,
      sport: params.sport || 'NBA',
    },
    stats: params.stats,
    market: params.market,
  };
}
