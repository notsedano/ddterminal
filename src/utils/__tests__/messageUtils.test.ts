import { describe, it, expect } from 'vitest';
import { convertApiMessageToMessage, mergeMessages } from '../messageUtils';
import type { Message } from '@/types';

describe('Message utilities', () => {
  describe('convertApiMessageToMessage', () => {
    const sessionId = 'test-session-123';
    const agentId = 'test-agent-456';

    it('should convert API message with all fields', () => {
      const apiMsg = {
        id: 'msg-123',
        content: 'Hello world',
        authorId: 'user-789',
        isAgent: false,
        createdAt: '2024-01-01T12:00:00Z',
        metadata: { source: 'web' },
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);

      expect(result).toEqual({
        id: 'msg-123',
        text: 'Hello world',
        userId: 'user-789',
        agentId: agentId,
        sessionId,
        createdAt: '2024-01-01T12:00:00Z',
        role: 'user',
        metadata: { source: 'web' },
      });
    });

    it('should convert agent message correctly', () => {
      const apiMsg = {
        id: 'msg-456',
        content: 'Agent response',
        authorId: 'agent-789',
        isAgent: true,
        createdAt: '2024-01-01T12:01:00Z',
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);

      expect(result.role).toBe('agent');
      expect(result.agentId).toBe('agent-789');
      expect(result.text).toBe('Agent response');
    });

    it('should handle missing id by generating one', () => {
      const apiMsg = {
        content: 'Test message',
        authorId: 'user-123',
        isAgent: false,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);

      expect(result.id).toBeTruthy();
      // Format: msg-{Date.now()}-{Math.random()} (decimal)
      expect(result.id).toMatch(/^msg-\d+-[\d.]+$/);
    });

    it('should prefer content over text field', () => {
      const apiMsg = {
        content: 'Content field',
        text: 'Text field',
        authorId: 'user-123',
        isAgent: false,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      expect(result.text).toBe('Content field');
    });

    it('should fall back to text field if content is missing', () => {
      const apiMsg = {
        text: 'Text field only',
        authorId: 'user-123',
        isAgent: false,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      expect(result.text).toBe('Text field only');
    });

    it('should use empty string if both content and text are missing', () => {
      const apiMsg = {
        authorId: 'user-123',
        isAgent: false,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      expect(result.text).toBe('');
    });

    it('should prefer authorId over userId', () => {
      const apiMsg = {
        content: 'Test',
        authorId: 'author-123',
        userId: 'user-456',
        isAgent: false,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      expect(result.userId).toBe('author-123');
    });

    it('should fall back to userId if authorId is missing', () => {
      const apiMsg = {
        content: 'Test',
        userId: 'user-456',
        isAgent: false,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      expect(result.userId).toBe('user-456');
    });

    it('should use empty string if both authorId and userId are missing', () => {
      const apiMsg = {
        content: 'Test',
        isAgent: false,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      expect(result.userId).toBe('');
    });

    it('should generate createdAt if missing', () => {
      const apiMsg = {
        content: 'Test',
        authorId: 'user-123',
        isAgent: false,
      };

      const before = new Date().toISOString();
      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      const after = new Date().toISOString();

      expect(result.createdAt).toBeTruthy();
      expect(new Date(result.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
      expect(new Date(result.createdAt).getTime()).toBeLessThanOrEqual(new Date(after).getTime());
    });

    it('should handle missing metadata', () => {
      const apiMsg = {
        content: 'Test',
        authorId: 'user-123',
        isAgent: false,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      expect(result.metadata).toBeUndefined();
    });

    it('should preserve metadata when present', () => {
      const metadata = { source: 'web', priority: 'high', tags: ['important'] };
      const apiMsg = {
        content: 'Test',
        authorId: 'user-123',
        isAgent: false,
        metadata,
      };

      const result = convertApiMessageToMessage(apiMsg, sessionId, agentId);
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('mergeMessages', () => {
    const baseTime = new Date('2024-01-01T12:00:00Z');
    
    const createMessage = (id: string, createdAt: Date): Message => ({
      id,
      text: `Message ${id}`,
      userId: 'user-123',
      sessionId: 'session-123',
      createdAt: createdAt.toISOString(),
      role: 'user',
    });

    it('should merge new messages with existing ones', () => {
      const existing: Message[] = [
        createMessage('msg-1', new Date(baseTime.getTime() + 1000)),
        createMessage('msg-2', new Date(baseTime.getTime() + 2000)),
      ];

      const newMessages: Message[] = [
        createMessage('msg-3', new Date(baseTime.getTime() + 3000)),
        createMessage('msg-4', new Date(baseTime.getTime() + 4000)),
      ];

      const result = mergeMessages(existing, newMessages);

      expect(result).toHaveLength(4);
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3', 'msg-4']);
    });

    it('should avoid duplicates based on message id', () => {
      const existing: Message[] = [
        createMessage('msg-1', new Date(baseTime.getTime() + 1000)),
        createMessage('msg-2', new Date(baseTime.getTime() + 2000)),
      ];

      const newMessages: Message[] = [
        createMessage('msg-2', new Date(baseTime.getTime() + 2000)), // Duplicate
        createMessage('msg-3', new Date(baseTime.getTime() + 3000)),
      ];

      const result = mergeMessages(existing, newMessages);

      expect(result).toHaveLength(3);
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });

    it('should return existing messages if no new unique messages', () => {
      const existing: Message[] = [
        createMessage('msg-1', new Date(baseTime.getTime() + 1000)),
        createMessage('msg-2', new Date(baseTime.getTime() + 2000)),
      ];

      const newMessages: Message[] = [
        createMessage('msg-1', new Date(baseTime.getTime() + 1000)),
        createMessage('msg-2', new Date(baseTime.getTime() + 2000)),
      ];

      const result = mergeMessages(existing, newMessages);

      expect(result).toBe(existing); // Should return same reference if no changes
      expect(result).toHaveLength(2);
    });

    it('should sort messages by createdAt', () => {
      const existing: Message[] = [
        createMessage('msg-1', new Date(baseTime.getTime() + 3000)),
        createMessage('msg-2', new Date(baseTime.getTime() + 1000)),
      ];

      const newMessages: Message[] = [
        createMessage('msg-3', new Date(baseTime.getTime() + 2000)),
        createMessage('msg-4', new Date(baseTime.getTime() + 4000)),
      ];

      const result = mergeMessages(existing, newMessages);

      expect(result.map(m => m.id)).toEqual(['msg-2', 'msg-3', 'msg-1', 'msg-4']);
    });

    it('should handle empty existing array', () => {
      const newMessages: Message[] = [
        createMessage('msg-1', new Date(baseTime.getTime() + 1000)),
        createMessage('msg-2', new Date(baseTime.getTime() + 2000)),
      ];

      const result = mergeMessages([], newMessages);

      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2']);
    });

    it('should handle empty new messages array', () => {
      const existing: Message[] = [
        createMessage('msg-1', new Date(baseTime.getTime() + 1000)),
      ];

      const result = mergeMessages(existing, []);

      expect(result).toBe(existing);
      expect(result).toHaveLength(1);
    });

    it('should handle both arrays being empty', () => {
      const result = mergeMessages([], []);
      expect(result).toEqual([]);
    });

    it('should handle messages with same timestamp', () => {
      const sameTime = new Date(baseTime.getTime() + 1000);
      const existing: Message[] = [
        createMessage('msg-1', sameTime),
      ];

      const newMessages: Message[] = [
        createMessage('msg-2', sameTime),
      ];

      const result = mergeMessages(existing, newMessages);

      expect(result).toHaveLength(2);
      // Should maintain order when timestamps are equal
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });

    it('should handle large number of messages', () => {
      const existing: Message[] = Array.from({ length: 100 }, (_, i) =>
        createMessage(`msg-${i}`, new Date(baseTime.getTime() + i * 1000))
      );

      const newMessages: Message[] = Array.from({ length: 100 }, (_, i) =>
        createMessage(`msg-${i + 100}`, new Date(baseTime.getTime() + (i + 100) * 1000))
      );

      const result = mergeMessages(existing, newMessages);

      expect(result).toHaveLength(200);
      expect(result[0].id).toBe('msg-0');
      expect(result[199].id).toBe('msg-199');
    });
  });
});
