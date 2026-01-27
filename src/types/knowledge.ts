/**
 * Knowledge Types
 * 
 * Types for the session-scoped RAG knowledge system.
 * Knowledge is sourced from sports article URLs, cleaned via Jina Reader,
 * chunked, embedded, and stored for semantic search during chat.
 */

// ============================================================================
// KNOWLEDGE SOURCE TYPES
// ============================================================================

export type KnowledgeSourceStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface KnowledgeSource {
  id: string;
  sessionId: string;
  userId: string;
  url: string;
  title: string | null;
  sourceDomain: string | null;
  author: string | null;
  publishedDate: string | null;
  status: KnowledgeSourceStatus;
  errorMessage: string | null;
  wordCount: number | null;
  chunkCount: number;
  createdAt: string;
  processedAt: string | null;
  metadata: KnowledgeSourceMetadata;
}

export interface KnowledgeSourceMetadata {
  siteName?: string;
  description?: string;
  ogImage?: string;
  [key: string]: unknown;
}

// Database row type (snake_case)
export interface KnowledgeSourceRow {
  id: string;
  session_id: string;
  user_id: string;
  url: string;
  title: string | null;
  source_domain: string | null;
  author: string | null;
  published_date: string | null;
  status: KnowledgeSourceStatus;
  error_message: string | null;
  word_count: number | null;
  chunk_count: number;
  created_at: string;
  processed_at: string | null;
  metadata: KnowledgeSourceMetadata;
}

// ============================================================================
// KNOWLEDGE CHUNK TYPES
// ============================================================================

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  sessionId: string;
  content: string;
  chunkIndex: number;
  embedding: number[] | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

// Database row type (snake_case)
export interface KnowledgeChunkRow {
  id: string;
  source_id: string;
  session_id: string;
  content: string;
  chunk_index: number;
  embedding: string | null; // pgvector format as string
  created_at: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// SEARCH RESULT TYPES
// ============================================================================

export interface KnowledgeSearchResult {
  chunkId: string;
  sourceId: string;
  content: string;
  chunkIndex: number;
  sourceTitle: string | null;
  sourceUrl: string;
  sourceDomain: string | null;
  similarity: number;
}

// Database function return type (snake_case)
export interface KnowledgeSearchResultRow {
  chunk_id: string;
  source_id: string;
  content: string;
  chunk_index: number;
  source_title: string | null;
  source_url: string;
  source_domain: string | null;
  similarity: number;
}

// ============================================================================
// KNOWLEDGE CONTEXT TYPES
// ============================================================================

export interface KnowledgeContextItem {
  sourceTitle: string | null;
  sourceUrl: string;
  sourceDomain: string | null;
  content: string;
  chunkIndex: number;
}

// Database function return type (snake_case)
export interface KnowledgeContextRow {
  source_title: string | null;
  source_url: string;
  source_domain: string | null;
  content: string;
  chunk_index: number;
}

// ============================================================================
// JINA API TYPES
// ============================================================================

export interface JinaRateLimitStatus {
  readerRequestsRemaining: number;
  readerResetAt: string | null;
  embeddingsRequestsRemaining: number;
  embeddingsResetAt: string | null;
  isDisabled: boolean;
  lastUpdated: string;
}

// Database row type (snake_case)
export interface JinaRateLimitStatusRow {
  id: number;
  reader_requests_remaining: number;
  reader_reset_at: string | null;
  embeddings_requests_remaining: number;
  embeddings_reset_at: string | null;
  is_disabled: boolean;
  last_updated: string;
}

export interface JinaReaderResponse {
  code: number;
  status: number;
  data: {
    title: string;
    content: string;
    url: string;
    author?: string;
    publishedTime?: string;
    siteName?: string;
    description?: string;
    image?: string;
  };
}

export interface JinaEmbeddingsRequest {
  model: 'jina-embeddings-v3';
  task: 'retrieval.passage' | 'retrieval.query';
  dimensions: number;
  input: string[];
}

export interface JinaEmbeddingsResponse {
  model: string;
  object: string;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
  };
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
}

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

export function knowledgeSourceFromRow(row: KnowledgeSourceRow): KnowledgeSource {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    sourceDomain: row.source_domain,
    author: row.author,
    publishedDate: row.published_date,
    status: row.status,
    errorMessage: row.error_message,
    wordCount: row.word_count,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
    processedAt: row.processed_at,
    metadata: row.metadata,
  };
}

export function knowledgeSearchResultFromRow(row: KnowledgeSearchResultRow): KnowledgeSearchResult {
  return {
    chunkId: row.chunk_id,
    sourceId: row.source_id,
    content: row.content,
    chunkIndex: row.chunk_index,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    sourceDomain: row.source_domain,
    similarity: row.similarity,
  };
}

export function knowledgeContextFromRow(row: KnowledgeContextRow): KnowledgeContextItem {
  return {
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    sourceDomain: row.source_domain,
    content: row.content,
    chunkIndex: row.chunk_index,
  };
}
