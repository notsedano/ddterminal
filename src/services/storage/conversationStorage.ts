import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Session, Message } from '@/types';

interface ConversationDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { 'by-agentId': string; 'by-userId': string; 'by-createdAt': string };
  };
  messages: {
    key: string;
    value: Message;
    indexes: { 'by-sessionId': string; 'by-createdAt': string };
  };
}

let dbPromise: Promise<IDBPDatabase<ConversationDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ConversationDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ConversationDB>('eliza-conversations', 1, {
      upgrade(db) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
        sessionStore.createIndex('by-agentId', 'agentId');
        sessionStore.createIndex('by-userId', 'userId');
        sessionStore.createIndex('by-createdAt', 'createdAt');

        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('by-sessionId', 'sessionId');
        messageStore.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function saveSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  const db = await getDB();
  return db.get('sessions', sessionId);
}

export async function getAllSessions(userId: string): Promise<Session[]> {
  const db = await getDB();
  const tx = db.transaction('sessions', 'readonly');
  const index = tx.store.index('by-userId');
  const sessions = await index.getAll(userId);
  await tx.done;
  return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'messages'], 'readwrite');
  
  // Delete session
  await tx.objectStore('sessions').delete(sessionId);
  
  // Delete all messages for this session
  const messageIndex = tx.objectStore('messages').index('by-sessionId');
  const messages = await messageIndex.getAll(sessionId);
  await Promise.all(messages.map(msg => tx.objectStore('messages').delete(msg.id)));
  
  await tx.done;
}

export async function saveMessage(message: Message): Promise<void> {
  const db = await getDB();
  await db.put('messages', message);
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  const db = await getDB();
  const tx = db.transaction('messages', 'readonly');
  const index = tx.store.index('by-sessionId');
  const messages = await index.getAll(sessionId);
  await tx.done;
  return messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'messages'], 'readwrite');
  await tx.objectStore('sessions').clear();
  await tx.objectStore('messages').clear();
  await tx.done;
}
