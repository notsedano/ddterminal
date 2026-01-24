import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveSession,
  getSession,
  getAllSessions,
  deleteSession,
  saveMessage,
  getMessages,
  clearAllData,
} from '../conversationStorage';
import type { Session, Message } from '@/types';

describe('Conversation Storage', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await clearAllData();
  });

  afterEach(async () => {
    // Clean up after each test
    await clearAllData();
  });

  describe('Session operations', () => {
    const defaultTimeoutConfig = {
      timeoutMinutes: 60,
      autoRenew: true,
      maxDurationMinutes: 480,
      warningThresholdMinutes: 5,
    };

    const createTestSession = (sessionId: string, agentId: string = 'test-agent', userId: string = 'test-user'): Session => ({
      sessionId,
      agentId,
      userId,
      channelId: `channel-${sessionId}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      metadata: {},
      timeoutConfig: defaultTimeoutConfig,
    });

    it('should save and retrieve a session', async () => {
      const session = createTestSession('session-1');
      await saveSession(session);

      const retrieved = await getSession('session-1');
      expect(retrieved).toEqual(session);
    });

    it('should return undefined for non-existent session', async () => {
      const retrieved = await getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should update existing session when saving with same id', async () => {
      const session1 = createTestSession('session-1', 'agent-1');
      await saveSession(session1);

      const session2 = { ...session1, agentId: 'agent-2' };
      await saveSession(session2);

      const retrieved = await getSession('session-1');
      expect(retrieved?.agentId).toBe('agent-2');
    });

    it('should get all sessions for a user', async () => {
      const userId = 'user-123';
      const sessions = [
        createTestSession('session-1', 'agent-1', userId),
        createTestSession('session-2', 'agent-1', userId),
        createTestSession('session-3', 'agent-2', userId),
      ];

      for (const session of sessions) {
        await saveSession(session);
      }

      const retrieved = await getAllSessions(userId);
      expect(retrieved).toHaveLength(3);
      expect(retrieved.map(s => s.sessionId)).toContain('session-1');
      expect(retrieved.map(s => s.sessionId)).toContain('session-2');
      expect(retrieved.map(s => s.sessionId)).toContain('session-3');
    });

    it('should sort sessions by createdAt descending', async () => {
      const userId = 'user-123';
      const baseTime = Date.now();
      const base = createTestSession('session-1', 'agent-1', userId);

      const sessions: Session[] = [
        { ...base, sessionId: 'session-1', channelId: 'channel-1', createdAt: new Date(baseTime + 1000).toISOString() },
        { ...base, sessionId: 'session-2', channelId: 'channel-2', createdAt: new Date(baseTime + 3000).toISOString() },
        { ...base, sessionId: 'session-3', channelId: 'channel-3', createdAt: new Date(baseTime + 2000).toISOString() },
      ];

      for (const session of sessions) {
        await saveSession(session);
      }

      const retrieved = await getAllSessions(userId);
      expect(retrieved[0].sessionId).toBe('session-2'); // Most recent
      expect(retrieved[1].sessionId).toBe('session-3');
      expect(retrieved[2].sessionId).toBe('session-1'); // Oldest
    });

    it('should only return sessions for specified user', async () => {
      const session1 = createTestSession('session-1', 'agent-1', 'user-1');
      const session2 = createTestSession('session-2', 'agent-1', 'user-2');
      const session3 = createTestSession('session-3', 'agent-1', 'user-1');

      await saveSession(session1);
      await saveSession(session2);
      await saveSession(session3);

      const user1Sessions = await getAllSessions('user-1');
      expect(user1Sessions).toHaveLength(2);
      expect(user1Sessions.map(s => s.sessionId)).toContain('session-1');
      expect(user1Sessions.map(s => s.sessionId)).toContain('session-3');

      const user2Sessions = await getAllSessions('user-2');
      expect(user2Sessions).toHaveLength(1);
      expect(user2Sessions[0].sessionId).toBe('session-2');
    });

    it('should delete a session', async () => {
      const session = createTestSession('session-1');
      await saveSession(session);

      await deleteSession('session-1');

      const retrieved = await getSession('session-1');
      expect(retrieved).toBeUndefined();
    });

    it('should delete all messages when deleting a session', async () => {
      const session = createTestSession('session-1');
      await saveSession(session);

      const message1: Message = {
        id: 'msg-1',
        text: 'Message 1',
        userId: 'user-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        role: 'user',
      };

      const message2: Message = {
        id: 'msg-2',
        text: 'Message 2',
        userId: 'user-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        role: 'agent',
      };

      await saveMessage(message1);
      await saveMessage(message2);

      await deleteSession('session-1');

      const messages = await getMessages('session-1');
      expect(messages).toHaveLength(0);
    });

    it('should handle deleting non-existent session gracefully', async () => {
      await expect(deleteSession('non-existent')).resolves.not.toThrow();
    });

    it('should handle empty user sessions list', async () => {
      const sessions = await getAllSessions('non-existent-user');
      expect(sessions).toEqual([]);
    });
  });

  describe('Message operations', () => {
    const createTestMessage = (id: string, sessionId: string, role: 'user' | 'agent' = 'user'): Message => ({
      id,
      text: `Message ${id}`,
      userId: 'user-123',
      sessionId,
      createdAt: new Date().toISOString(),
      role,
    });

    it('should save and retrieve messages', async () => {
      const message = createTestMessage('msg-1', 'session-1');
      await saveMessage(message);

      const retrieved = await getMessages('session-1');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(message);
    });

    it('should retrieve messages sorted by createdAt ascending', async () => {
      const baseTime = Date.now();
      const messages = [
        { ...createTestMessage('msg-1', 'session-1'), createdAt: new Date(baseTime + 3000).toISOString() },
        { ...createTestMessage('msg-2', 'session-1'), createdAt: new Date(baseTime + 1000).toISOString() },
        { ...createTestMessage('msg-3', 'session-1'), createdAt: new Date(baseTime + 2000).toISOString() },
      ];

      for (const msg of messages) {
        await saveMessage(msg);
      }

      const retrieved = await getMessages('session-1');
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].id).toBe('msg-2'); // Oldest
      expect(retrieved[1].id).toBe('msg-3');
      expect(retrieved[2].id).toBe('msg-1'); // Newest
    });

    it('should only return messages for specified session', async () => {
      const message1 = createTestMessage('msg-1', 'session-1');
      const message2 = createTestMessage('msg-2', 'session-2');
      const message3 = createTestMessage('msg-3', 'session-1');

      await saveMessage(message1);
      await saveMessage(message2);
      await saveMessage(message3);

      const session1Messages = await getMessages('session-1');
      expect(session1Messages).toHaveLength(2);
      expect(session1Messages.map(m => m.id)).toContain('msg-1');
      expect(session1Messages.map(m => m.id)).toContain('msg-3');

      const session2Messages = await getMessages('session-2');
      expect(session2Messages).toHaveLength(1);
      expect(session2Messages[0].id).toBe('msg-2');
    });

    it('should update existing message when saving with same id', async () => {
      const message1 = createTestMessage('msg-1', 'session-1');
      await saveMessage(message1);

      const message2 = { ...message1, text: 'Updated text' };
      await saveMessage(message2);

      const retrieved = await getMessages('session-1');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].text).toBe('Updated text');
    });

    it('should handle empty messages list for session', async () => {
      const messages = await getMessages('non-existent-session');
      expect(messages).toEqual([]);
    });

    it('should handle messages with different roles', async () => {
      const userMessage = createTestMessage('msg-1', 'session-1', 'user');
      const agentMessage = createTestMessage('msg-2', 'session-1', 'agent');

      await saveMessage(userMessage);
      await saveMessage(agentMessage);

      const retrieved = await getMessages('session-1');
      expect(retrieved).toHaveLength(2);
      expect(retrieved.find(m => m.role === 'user')?.id).toBe('msg-1');
      expect(retrieved.find(m => m.role === 'agent')?.id).toBe('msg-2');
    });

    it('should handle large number of messages', async () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createTestMessage(`msg-${i}`, 'session-1')
      );

      for (const msg of messages) {
        await saveMessage(msg);
      }

      const retrieved = await getMessages('session-1');
      expect(retrieved).toHaveLength(100);
    });
  });

  describe('clearAllData', () => {
    it('should clear all sessions and messages', async () => {
      const session: Session = {
        sessionId: 'session-1',
        agentId: 'agent-1',
        userId: 'user-1',
        channelId: 'channel-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        metadata: {},
        timeoutConfig: {
          timeoutMinutes: 60,
          autoRenew: true,
          maxDurationMinutes: 480,
          warningThresholdMinutes: 5,
        },
      };

      const message: Message = {
        id: 'msg-1',
        text: 'Test',
        userId: 'user-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        role: 'user',
      };

      await saveSession(session);
      await saveMessage(message);

      await clearAllData();

      const sessions = await getAllSessions('user-1');
      const messages = await getMessages('session-1');

      expect(sessions).toHaveLength(0);
      expect(messages).toHaveLength(0);
    });

    it('should handle clearing empty database', async () => {
      await expect(clearAllData()).resolves.not.toThrow();
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent session saves', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        sessionId: `session-${i}`,
        agentId: 'agent-1',
        userId: 'user-1',
        channelId: `channel-${i}`,
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      }));

      await Promise.all(sessions.map(s => saveSession(s)));

      const retrieved = await getAllSessions('user-1');
      expect(retrieved).toHaveLength(10);
    });

    it('should handle concurrent message saves', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        text: `Message ${i}`,
        userId: 'user-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        role: 'user' as const,
      }));

      await Promise.all(messages.map(m => saveMessage(m)));

      const retrieved = await getMessages('session-1');
      expect(retrieved).toHaveLength(10);
    });
  });
});
