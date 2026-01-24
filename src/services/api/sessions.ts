import apiClient from './client';
import type { CreateSessionRequest, CreateSessionResponse, MessagesResponse } from '@/types';

export async function createSession(data: CreateSessionRequest): Promise<CreateSessionResponse> {
  const response = await apiClient.post<CreateSessionResponse>('/messaging/sessions', data);
  return response.data;
}

export async function getSession(sessionId: string): Promise<CreateSessionResponse> {
  const response = await apiClient.get<CreateSessionResponse>(`/messaging/sessions/${sessionId}`);
  return response.data;
}

export async function getMessages(sessionId: string, limit?: number): Promise<MessagesResponse> {
  const params = limit ? { limit } : {};
  const response = await apiClient.get<MessagesResponse>(`/messaging/sessions/${sessionId}/messages`, { params });
  return response.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/messaging/sessions/${sessionId}`);
}
