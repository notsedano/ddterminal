export interface Message {
  id: string;
  text: string;
  userId: string;
  agentId?: string;
  sessionId: string;
  createdAt: string;
  role: 'user' | 'agent';
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  text: string;
  userId: string;
}

export interface SendMessageResponse {
  messageId: string;
  sessionId: string;
}

export interface SendMessageAPIResponse {
  success: boolean;
  userMessage: {
    id: string;
    channel_id: string;
    message_server_id: string;
    author_id: string;
    content: string;
    created_at: number;
    source_type: string;
    raw_message: {
      content: string;
    };
    metadata: Record<string, unknown>;
  };
  sessionStatus: {
    expiresAt: string;
    renewalCount: number;
    wasRenewed: boolean;
    isNearExpiration: boolean;
  };
}

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

export interface SocketMessageEvent {
  text: string;
  userId: string;
  agentId: string;
  sessionId?: string;
  messageId?: string;
  timestamp?: string;
}

export interface SocketTypingEvent {
  agentId: string;
  sessionId: string;
  isTyping: boolean;
}

export interface SocketStatusEvent {
  agentId: string;
  status: 'idle' | 'processing' | 'typing' | 'error';
  message?: string;
}
