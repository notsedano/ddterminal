import type { Message } from '@/types';

/**
 * Converts API message format to our internal Message format
 */
export function convertApiMessageToMessage(
  apiMsg: {
    id?: string;
    content?: string;
    text?: string;
    authorId?: string;
    userId?: string;
    isAgent?: boolean;
    createdAt?: string;
    metadata?: Record<string, unknown>;
  },
  sessionId: string,
  agentId: string
): Message {
  return {
    id: apiMsg.id || `msg-${Date.now()}-${Math.random()}`,
    text: apiMsg.content || apiMsg.text || '',
    userId: apiMsg.authorId || apiMsg.userId || '',
    agentId: apiMsg.isAgent ? apiMsg.authorId || agentId : agentId,
    sessionId,
    createdAt: apiMsg.createdAt || new Date().toISOString(),
    role: apiMsg.isAgent ? 'agent' : 'user',
    metadata: apiMsg.metadata,
  };
}

/**
 * Merges new messages with existing messages, avoiding duplicates
 */
export function mergeMessages(existing: Message[], newMessages: Message[]): Message[] {
  const existingIds = new Set(existing.map(m => m.id));
  const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
  
  if (uniqueNew.length === 0) return existing;
  
  return [...existing, ...uniqueNew].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}
