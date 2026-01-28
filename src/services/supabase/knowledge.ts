/**
 * Session Knowledge Storage Service
 * 
 * Handles CRUD operations for session-scoped RAG knowledge.
 * Knowledge is sourced from URLs, cleaned, chunked, embedded, and stored for semantic search.
 */

import { supabase } from './client';

/** Supabase client cast for knowledge tables/RPCs not in generated types */
const db = supabase as any;

import {
  scrapeArticle,
  generateEmbeddings,
  generateQueryEmbedding,
  getRateLimitStatus,
  JinaRateLimitError,
  JinaScrapingError,
} from '@/services/jina';
import { chunkText, extractDomain } from '@/utils/chunking';
import type {
  KnowledgeSource,
  KnowledgeSourceRow,
  KnowledgeSearchResult,
  KnowledgeSearchResultRow,
  KnowledgeContextItem,
  KnowledgeContextRow,
  JinaRateLimitStatus,
} from '@/types/knowledge';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_SOURCES_PER_SESSION = 5;

// Chunking configuration for sports articles
const CHUNK_OPTIONS = {
  maxChunkSize: 1000,   // Characters per chunk
  chunkOverlap: 200,    // Overlap for context continuity
  minChunkSize: 100,    // Minimum chunk size to keep
};

// ============================================================================
// KNOWLEDGE SOURCE OPERATIONS
// ============================================================================

/**
 * Retrieves all knowledge sources for a session.
 */
export async function getSessionKnowledgeSources(sessionId: string): Promise<KnowledgeSource[]> {
  const { data, error } = await db
    .from('session_knowledge_sources')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get knowledge sources: ${error.message}`);
  }

  return (data as unknown as KnowledgeSourceRow[]).map(row => ({
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
  }));
}

/**
 * Gets the count of knowledge sources for a session.
 */
export async function getSessionKnowledgeSourceCount(sessionId: string): Promise<number> {
  const { count, error } = await db
    .from('session_knowledge_sources')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to count knowledge sources: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Checks if a URL already exists for a session.
 */
export async function isUrlAlreadyAdded(sessionId: string, url: string): Promise<boolean> {
  const { data } = await db
    .from('session_knowledge_sources')
    .select('id')
    .eq('session_id', sessionId)
    .eq('url', url)
    .maybeSingle();

  return data !== null;
}

/**
 * Adds a new knowledge source to a session.
 * Creates the source in 'pending' status - call processKnowledgeSource to scrape and embed.
 */
export async function addKnowledgeSource(
  sessionId: string,
  userId: string,
  url: string
): Promise<KnowledgeSource> {
  // Check if we've hit the limit
  const currentCount = await getSessionKnowledgeSourceCount(sessionId);
  if (currentCount >= MAX_SOURCES_PER_SESSION) {
    throw new Error(`Maximum of ${MAX_SOURCES_PER_SESSION} knowledge sources per session. Remove one to add another.`);
  }

  // Check for duplicate URL
  const isDuplicate = await isUrlAlreadyAdded(sessionId, url);
  if (isDuplicate) {
    throw new Error('This article has already been added to this session');
  }

  // Create the source in pending status
  const { data, error } = await db
    .from('session_knowledge_sources')
    .insert({
      session_id: sessionId,
      user_id: userId,
      url,
      source_domain: extractDomain(url),
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This article has already been added to this session');
    }
    throw new Error(`Failed to add knowledge source: ${error.message}`);
  }

  const row = data as unknown as KnowledgeSourceRow;
  
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

/**
 * Updates a knowledge source status.
 */
async function updateSourceStatus(
  sourceId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  updates?: Partial<{
    title: string;
    author: string;
    publishedDate: string;
    wordCount: number;
    chunkCount: number;
    errorMessage: string;
    metadata: Record<string, unknown>;
  }>
): Promise<void> {
  const updatePayload: Record<string, unknown> = { status };
  
  if (updates?.title !== undefined) updatePayload.title = updates.title;
  if (updates?.author !== undefined) updatePayload.author = updates.author;
  if (updates?.publishedDate !== undefined) updatePayload.published_date = updates.publishedDate;
  if (updates?.wordCount !== undefined) updatePayload.word_count = updates.wordCount;
  if (updates?.chunkCount !== undefined) updatePayload.chunk_count = updates.chunkCount;
  if (updates?.errorMessage !== undefined) updatePayload.error_message = updates.errorMessage;
  if (updates?.metadata !== undefined) updatePayload.metadata = updates.metadata;
  
  if (status === 'completed') {
    updatePayload.processed_at = new Date().toISOString();
  }

  const { error } = await db
    .from('session_knowledge_sources')
    .update(updatePayload)
    .eq('id', sourceId);

  if (error) {
    throw new Error(`Failed to update source status: ${error.message}`);
  }
}

/**
 * Processes a knowledge source: scrapes the URL, chunks the content, generates embeddings, and stores.
 * This is the main "worker" function that transforms a URL into searchable knowledge.
 */
export async function processKnowledgeSource(sourceId: string): Promise<void> {
  // Get the source
  const { data: sourceData, error: sourceError } = await db
    .from('session_knowledge_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (sourceError || !sourceData) {
    throw new Error('Knowledge source not found');
  }

  const source = sourceData as unknown as KnowledgeSourceRow;

  // Update status to processing
  await updateSourceStatus(sourceId, 'processing');

  // Step 1: Scrape the article
  let article;
  try {
    article = await scrapeArticle(source.url);
  } catch (error) {
    const errorMessage = error instanceof JinaRateLimitError
      ? error.getResetMessage()
      : error instanceof JinaScrapingError
        ? error.message
        : 'Failed to fetch article content';
    
    await updateSourceStatus(sourceId, 'failed', { errorMessage });
    throw error;
  }

  // Step 2: Chunk the content
  const chunks = chunkText(article.content, CHUNK_OPTIONS);

  if (chunks.length === 0) {
    await updateSourceStatus(sourceId, 'failed', {
      errorMessage: 'No content could be extracted from this article',
    });
    throw new Error('No content extracted');
  }

  // Step 3: Generate embeddings for all chunks
  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddings(chunks);
  } catch (error) {
    const errorMessage = error instanceof JinaRateLimitError
      ? error.getResetMessage()
      : 'Failed to generate embeddings';
    
    await updateSourceStatus(sourceId, 'failed', { errorMessage });
    throw error;
  }

  // Step 4: Store chunks with embeddings
  const chunkInserts = chunks.map((content, index) => ({
    source_id: sourceId,
    session_id: source.session_id,
    content,
    chunk_index: index,
    // pgvector expects array format as string: [x, y, z, ...]
    embedding: `[${embeddings[index].join(',')}]`,
  }));

  const { error: chunksError } = await db
    .from('session_knowledge_chunks')
    .insert(chunkInserts);

  if (chunksError) {
    await updateSourceStatus(sourceId, 'failed', {
      errorMessage: `Failed to store knowledge chunks: ${chunksError.message}`,
    });
    throw new Error(`Failed to store chunks: ${chunksError.message}`);
  }

  // Step 5: Update source with success status and metadata
  await updateSourceStatus(sourceId, 'completed', {
    title: article.title,
    author: article.author ?? undefined,
    publishedDate: article.publishedTime ?? undefined,
    wordCount: article.wordCount,
    chunkCount: chunks.length,
    metadata: {
      siteName: article.siteName,
      description: article.description,
    },
  });
}

/**
 * Deletes a knowledge source and all its chunks (cascading delete).
 */
export async function deleteKnowledgeSource(sourceId: string): Promise<void> {
  const { error } = await db
    .from('session_knowledge_sources')
    .delete()
    .eq('id', sourceId);

  if (error) {
    throw new Error(`Failed to delete knowledge source: ${error.message}`);
  }
}

// ============================================================================
// KNOWLEDGE SEARCH OPERATIONS
// ============================================================================

/**
 * Performs semantic search on session knowledge using vector similarity.
 * Returns the most relevant chunks for a given query.
 */
export async function searchSessionKnowledge(
  sessionId: string,
  query: string,
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query);

  // Call the search function
  const { data, error } = await db.rpc('search_session_knowledge', {
    p_session_id: sessionId,
    p_query_embedding: `[${queryEmbedding.join(',')}]`,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`Knowledge search failed: ${error.message}`);
  }

  return (data as unknown as KnowledgeSearchResultRow[]).map(row => ({
    chunkId: row.chunk_id,
    sourceId: row.source_id,
    content: row.content,
    chunkIndex: row.chunk_index,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    sourceDomain: row.source_domain,
    similarity: row.similarity,
  }));
}

/**
 * Gets all knowledge content for a session (for full context injection).
 * Use this when you want to include all knowledge rather than semantic search.
 */
export async function getSessionKnowledgeContext(
  sessionId: string
): Promise<KnowledgeContextItem[]> {
  const { data, error } = await db.rpc('get_session_knowledge_context', {
    p_session_id: sessionId,
  });

  if (error) {
    throw new Error(`Failed to get knowledge context: ${error.message}`);
  }

  return (data as unknown as KnowledgeContextRow[]).map(row => ({
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    sourceDomain: row.source_domain,
    content: row.content,
    chunkIndex: row.chunk_index,
  }));
}

/**
 * Checks if a session has any completed knowledge sources.
 */
export async function sessionHasKnowledge(sessionId: string): Promise<boolean> {
  const { count, error } = await db
    .from('session_knowledge_sources')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('status', 'completed');

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}

// ============================================================================
// KNOWLEDGE CONTEXT FORMATTING
// ============================================================================

/**
 * Formats search results as a context string for LLM injection.
 */
export function formatSearchResultsForContext(
  results: KnowledgeSearchResult[],
  options?: {
    maxChars?: number;
    includeSources?: boolean;
  }
): string {
  if (results.length === 0) {
    return '';
  }

  const { maxChars = 4000, includeSources = true } = options ?? {};
  
  let context = '--- Relevant Knowledge from Sports Articles ---\n\n';
  let totalChars = context.length;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    let chunkText = '';
    if (includeSources && result.sourceTitle) {
      chunkText += `[${result.sourceTitle}`;
      if (result.sourceDomain) {
        chunkText += ` - ${result.sourceDomain}`;
      }
      chunkText += ']\n';
    }
    chunkText += result.content + '\n\n';

    if (totalChars + chunkText.length > maxChars) {
      // Truncate to fit
      const remaining = maxChars - totalChars - 50; // Leave room for closing
      if (remaining > 100) {
        context += chunkText.slice(0, remaining) + '...\n\n';
      }
      break;
    }

    context += chunkText;
    totalChars += chunkText.length;
  }

  context += '--- End Knowledge Context ---';

  return context;
}

/**
 * Formats all session knowledge as a context string.
 */
export function formatFullKnowledgeForContext(
  items: KnowledgeContextItem[],
  options?: {
    maxChars?: number;
  }
): string {
  if (items.length === 0) {
    return '';
  }

  const { maxChars = 6000 } = options ?? {};

  // Group by source
  const bySource = new Map<string, { title: string; domain: string; chunks: string[] }>();
  
  for (const item of items) {
    const key = item.sourceUrl;
    if (!bySource.has(key)) {
      bySource.set(key, {
        title: item.sourceTitle || 'Untitled',
        domain: item.sourceDomain || '',
        chunks: [],
      });
    }
    bySource.get(key)!.chunks.push(item.content);
  }

  let context = '--- Session Knowledge from Sports Articles ---\n\n';
  let totalChars = context.length;

  for (const [, source] of bySource) {
    let sourceText = `### ${source.title}`;
    if (source.domain) {
      sourceText += ` (${source.domain})`;
    }
    sourceText += '\n\n';
    sourceText += source.chunks.join('\n\n');
    sourceText += '\n\n---\n\n';

    if (totalChars + sourceText.length > maxChars) {
      // Include truncated version
      const remaining = maxChars - totalChars - 50;
      if (remaining > 200) {
        context += sourceText.slice(0, remaining) + '...\n\n';
      }
      break;
    }

    context += sourceText;
    totalChars += sourceText.length;
  }

  context += '--- End Session Knowledge ---';

  return context;
}

// ============================================================================
// RATE LIMIT STATUS
// ============================================================================

/**
 * Gets the current Jina API rate limit status.
 */
export async function getKnowledgeRateLimitStatus(): Promise<JinaRateLimitStatus> {
  return getRateLimitStatus();
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MAX_SOURCES_PER_SESSION };
