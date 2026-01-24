import { useQuery } from '@tanstack/react-query';
import { getAgent, getAgentPanels } from '@/services/api/agents';
import type { AgentInfo, PluginPanelsResponse } from '@/types';

export function useAgent(agentId: string) {
  return useQuery<AgentInfo>({
    queryKey: ['agent', agentId],
    queryFn: () => getAgent(agentId),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAgentPanels(agentId: string) {
  return useQuery<PluginPanelsResponse>({
    queryKey: ['agent-panels', agentId],
    queryFn: () => getAgentPanels(agentId),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,
  });
}
