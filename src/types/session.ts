export interface Session {
  sessionId: string;
  channelId: string;
  agentId: string;
  userId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  expiresAt: string;
  timeoutConfig: {
    timeoutMinutes: number;
    autoRenew: boolean;
    maxDurationMinutes: number;
    warningThresholdMinutes: number;
  };
}

export interface CreateSessionRequest {
  agentId: string;
  userId: string;
  channelId: string;
}

export interface CreateSessionResponse extends Session {}
