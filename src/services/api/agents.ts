import apiClient from './client';
import type { AgentListResponse, AgentInfo, PluginPanelsResponse } from '@/types';

export interface HealthCheckResult {
  healthy: boolean;
  agentsAvailable: boolean;
  sessionsAvailable: boolean;
  error?: string;
}

/**
 * Check if the backend is accessible and which APIs are available
 */
export async function checkBackendHealth(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    healthy: false,
    agentsAvailable: false,
    sessionsAvailable: false,
  };

  try {
    // Check if agents API is available
    const agentsResponse = await apiClient.get('/agents');
    result.agentsAvailable = agentsResponse.status === 200;
    result.healthy = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Network')) {
      result.error = 'Cannot reach backend server';
    } else {
      result.error = message;
    }
  }

  // Check if sessions API is available (separate check)
  try {
    // Try to access sessions health endpoint if it exists
    const sessionsResponse = await apiClient.get('/messaging/sessions/health');
    result.sessionsAvailable = sessionsResponse.status === 200;
  } catch {
    // Sessions API might not have a health endpoint, that's okay
    // We'll find out when we try to create a session
    result.sessionsAvailable = false;
  }

  return result;
}

export async function getAgents(): Promise<AgentListResponse> {
  const response = await apiClient.get<AgentListResponse>('/agents');
  return response.data;
}

export async function getAgent(agentId: string): Promise<AgentInfo> {
  const response = await apiClient.get<{ success: boolean; data: AgentInfo }>(`/agents/${agentId}`);
  return response.data.data;
}

export async function getAgentPanels(agentId: string): Promise<PluginPanelsResponse> {
  const response = await apiClient.get<PluginPanelsResponse>(`/agents/${agentId}/panels`);
  return response.data;
}
