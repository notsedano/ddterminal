export interface Agent {
  id: string;
  name: string;
  characterName: string;
  bio: string;
  status: 'active' | 'inactive';
}

export interface AgentListResponse {
  success: boolean;
  data: {
    agents: Agent[];
  };
}

export interface AgentInfo {
  id: string;
  name: string;
  characterName: string;
  bio: string;
  status: string;
}

export interface PluginPanel {
  name: string;
  path: string;
}

export interface PluginPanelsResponse {
  success: boolean;
  data: PluginPanel[];
}
