import apiClient from './client';
import type { SendMessageRequest, SendMessageResponse } from '@/types';

interface SendMessageAPIResponse {
  success: boolean;
  userMessage: {
    id: string;
    channel_id: string;
    author_id: string;
    content: string;
    created_at: number;
    source_type: string;
    metadata: Record<string, unknown>;
  };
  sessionStatus: {
    expiresAt: string;
    renewalCount: number;
    wasRenewed: boolean;
    isNearExpiration: boolean;
  };
}

export async function sendMessage(sessionId: string, data: SendMessageRequest): Promise<SendMessageResponse> {
  const response = await apiClient.post<SendMessageAPIResponse>(
    `/messaging/sessions/${sessionId}/messages`,
    {
      content: data.text,
      userId: data.userId,
    }
  );
  
  return {
    messageId: response.data.userMessage.id,
    sessionId,
  };
}
