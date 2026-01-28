/**
 * Jina AI API Client
 * 
 * Provides article scraping via Jina Reader and text embeddings via Jina Embeddings.
 * Includes rate limit tracking that persists to Supabase and auto-disables when limits are reached.
 */

import { supabase } from '@/services/supabase/client';
import type {
  JinaRateLimitStatus,
  JinaRateLimitStatusRow,
  JinaReaderResponse,
  JinaEmbeddingsResponse,
} from '@/types/knowledge';
import { cleanArticleContent } from '@/utils/chunking';

// ============================================================================
// CONSTANTS
// ============================================================================

const JINA_READER_BASE = 'https://r.jina.ai';
const JINA_EMBEDDINGS_URL = 'https://api.jina.ai/v1/embeddings';

// Rate limit thresholds - disable feature when below these to preserve quota
const READER_MIN_REQUESTS = 5;
const EMBEDDINGS_MIN_REQUESTS = 10;

// Jina Embeddings v3 model configuration
const EMBEDDING_MODEL = 'jina-embeddings-v3';
const EMBEDDING_DIMENSIONS = 1024;

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Error thrown when Jina API rate limits are exceeded.
 * Contains the reset time if available.
 */
export class JinaRateLimitError extends Error {
  public readonly resetAt: Date | null;
  public readonly service: 'reader' | 'embeddings';
  
  constructor(message: string, service: 'reader' | 'embeddings', resetAt: Date | null = null) {
    super(message);
    this.name = 'JinaRateLimitError';
    this.service = service;
    this.resetAt = resetAt;
  }
  
  /**
   * Returns a human-readable message about when the service will be available again.
   */
  getResetMessage(): string {
    if (!this.resetAt) {
      return 'Rate limit exceeded. Please try again later.';
    }
    
    const now = new Date();
    const diffMs = this.resetAt.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Rate limit should be reset now. Please try again.';
    }
    
    const diffMinutes = Math.ceil(diffMs / 60000);
    if (diffMinutes < 60) {
      return `Rate limit will reset in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}.`;
    }
    
    const diffHours = Math.ceil(diffMinutes / 60);
    return `Rate limit will reset in ${diffHours} hour${diffHours === 1 ? '' : 's'}.`;
  }
}

/**
 * Error thrown when article scraping fails.
 */
export class JinaScrapingError extends Error {
  public readonly url: string;
  public readonly statusCode: number | null;
  
  constructor(message: string, url: string, statusCode: number | null = null) {
    super(message);
    this.name = 'JinaScrapingError';
    this.url = url;
    this.statusCode = statusCode;
  }
}

// ============================================================================
// RATE LIMIT MANAGEMENT
// ============================================================================

/**
 * Retrieves the current Jina API rate limit status from Supabase.
 */
export async function getRateLimitStatus(): Promise<JinaRateLimitStatus> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('jina_rate_limit_status')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    // If table doesn't exist yet, return default values
    if (error.code === 'PGRST116') {
      return {
        readerRequestsRemaining: 200,
        readerResetAt: null,
        embeddingsRequestsRemaining: 500,
        embeddingsResetAt: null,
        isDisabled: false,
        lastUpdated: new Date().toISOString(),
      };
    }
    throw new Error(`Failed to get Jina rate limit status: ${error.message}`);
  }

  const row = data as unknown as JinaRateLimitStatusRow;
  
  // Check if reset time has passed and re-enable if so
  const now = new Date();
  let isDisabled = row.is_disabled;
  
  if (isDisabled) {
    const readerReset = row.reader_reset_at ? new Date(row.reader_reset_at) : null;
    const embeddingsReset = row.embeddings_reset_at ? new Date(row.embeddings_reset_at) : null;
    
    // Re-enable if both reset times have passed
    const readerOk = !readerReset || readerReset <= now;
    const embeddingsOk = !embeddingsReset || embeddingsReset <= now;
    
    if (readerOk && embeddingsOk) {
      // Reset the status
      await updateRateLimitStatus({
        isDisabled: false,
        readerRequestsRemaining: 200,
        embeddingsRequestsRemaining: 500,
        readerResetAt: null,
        embeddingsResetAt: null,
      });
      isDisabled = false;
    }
  }

  return {
    readerRequestsRemaining: row.reader_requests_remaining,
    readerResetAt: row.reader_reset_at,
    embeddingsRequestsRemaining: row.embeddings_requests_remaining,
    embeddingsResetAt: row.embeddings_reset_at,
    isDisabled,
    lastUpdated: row.last_updated,
  };
}

/**
 * Updates the Jina API rate limit status in Supabase.
 */
async function updateRateLimitStatus(
  updates: Partial<{
    readerRequestsRemaining: number;
    readerResetAt: string | null;
    embeddingsRequestsRemaining: number;
    embeddingsResetAt: string | null;
    isDisabled: boolean;
  }>
): Promise<void> {
  const updatePayload: Record<string, unknown> = { 
    last_updated: new Date().toISOString() 
  };
  
  if (updates.readerRequestsRemaining !== undefined) {
    updatePayload.reader_requests_remaining = updates.readerRequestsRemaining;
  }
  if (updates.readerResetAt !== undefined) {
    updatePayload.reader_reset_at = updates.readerResetAt;
  }
  if (updates.embeddingsRequestsRemaining !== undefined) {
    updatePayload.embeddings_requests_remaining = updates.embeddingsRequestsRemaining;
  }
  if (updates.embeddingsResetAt !== undefined) {
    updatePayload.embeddings_reset_at = updates.embeddingsResetAt;
  }
  if (updates.isDisabled !== undefined) {
    updatePayload.is_disabled = updates.isDisabled;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('jina_rate_limit_status')
    .update(updatePayload)
    .eq('id', 1);
    
  if (error) {
    console.error('Failed to update Jina rate limit status:', error);
  }
}

/**
 * Parses rate limit headers from Jina API responses and updates status.
 */
function processRateLimitHeaders(
  headers: Headers,
  service: 'reader' | 'embeddings'
): void {
  const remaining = headers.get('x-ratelimit-remaining-requests');
  const reset = headers.get('x-ratelimit-reset');

  if (remaining !== null) {
    const remainingNum = parseInt(remaining, 10);
    const resetAt = reset 
      ? new Date(parseInt(reset, 10) * 1000).toISOString() 
      : null;
    
    const minThreshold = service === 'reader' 
      ? READER_MIN_REQUESTS 
      : EMBEDDINGS_MIN_REQUESTS;
    
    const shouldDisable = remainingNum < minThreshold;

    if (service === 'reader') {
      updateRateLimitStatus({
        readerRequestsRemaining: remainingNum,
        readerResetAt: resetAt,
        isDisabled: shouldDisable ? true : undefined,
      });
    } else {
      updateRateLimitStatus({
        embeddingsRequestsRemaining: remainingNum,
        embeddingsResetAt: resetAt,
        isDisabled: shouldDisable ? true : undefined,
      });
    }
  }
}

/**
 * Checks if Jina APIs are currently available (not rate limited).
 */
export async function isJinaAvailable(): Promise<boolean> {
  const status = await getRateLimitStatus();
  return !status.isDisabled;
}

// ============================================================================
// JINA READER API
// ============================================================================

export interface ScrapedArticle {
  title: string;
  content: string;
  url: string;
  author: string | null;
  publishedTime: string | null;
  siteName: string | null;
  description: string | null;
  wordCount: number;
}

/**
 * Scrapes an article URL using Jina Reader API.
 * Returns clean, readable content suitable for RAG.
 * 
 * @param url - The article URL to scrape
 * @throws JinaRateLimitError if rate limited
 * @throws JinaScrapingError if scraping fails
 */
export async function scrapeArticle(url: string): Promise<ScrapedArticle> {
  // Check rate limits first
  const status = await getRateLimitStatus();
  
  if (status.isDisabled) {
    const resetAt = status.readerResetAt ? new Date(status.readerResetAt) : null;
    throw new JinaRateLimitError(
      'Jina Reader rate limit reached. Knowledge feature temporarily disabled.',
      'reader',
      resetAt
    );
  }

  // Jina Reader API: prefix the URL to get clean content
  const readerUrl = `${JINA_READER_BASE}/${url}`;
  
  const response = await fetch(readerUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Return-Format': 'json',
      'X-With-Links-Summary': 'false',
      'X-With-Images-Summary': 'false',
    },
  });

  // Process rate limit headers
  processRateLimitHeaders(response.headers, 'reader');

  // Handle rate limit response
  if (response.status === 429) {
    const resetHeader = response.headers.get('x-ratelimit-reset');
    const resetAt = resetHeader 
      ? new Date(parseInt(resetHeader, 10) * 1000) 
      : null;
    
    await updateRateLimitStatus({ 
      isDisabled: true, 
      readerResetAt: resetAt?.toISOString() ?? null 
    });
    
    throw new JinaRateLimitError(
      'Jina Reader rate limit exceeded',
      'reader',
      resetAt
    );
  }

  // Handle other errors
  if (!response.ok) {
    throw new JinaScrapingError(
      `Failed to scrape article: ${response.status} ${response.statusText}`,
      url,
      response.status
    );
  }

  const data: JinaReaderResponse = await response.json();
  
  // Validate response
  if (!data.data || !data.data.content) {
    throw new JinaScrapingError(
      'No content could be extracted from this article',
      url,
      null
    );
  }

  // Clean the content
  const cleanedContent = cleanArticleContent(data.data.content);
  
  if (cleanedContent.length < 100) {
    throw new JinaScrapingError(
      'Article content is too short or could not be properly extracted',
      url,
      null
    );
  }

  // Count words
  const wordCount = cleanedContent.split(/\s+/).filter(w => w.length > 0).length;

  return {
    title: data.data.title || 'Untitled Article',
    content: cleanedContent,
    url: data.data.url || url,
    author: data.data.author || null,
    publishedTime: data.data.publishedTime || null,
    siteName: data.data.siteName || null,
    description: data.data.description || null,
    wordCount,
  };
}

// ============================================================================
// JINA EMBEDDINGS API
// ============================================================================

/**
 * Generates embeddings for an array of text passages.
 * Uses Jina Embeddings v3 with 'retrieval.passage' task for document chunks.
 * 
 * @param texts - Array of text passages to embed
 * @throws JinaRateLimitError if rate limited
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // Check rate limits first
  const status = await getRateLimitStatus();
  
  if (status.isDisabled) {
    const resetAt = status.embeddingsResetAt ? new Date(status.embeddingsResetAt) : null;
    throw new JinaRateLimitError(
      'Jina Embeddings rate limit reached. Knowledge feature temporarily disabled.',
      'embeddings',
      resetAt
    );
  }

  const apiKey = import.meta.env.VITE_JINA_API_KEY;
  
  if (!apiKey) {
    throw new Error('VITE_JINA_API_KEY is not configured');
  }

  const response = await fetch(JINA_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      task: 'retrieval.passage',
      dimensions: EMBEDDING_DIMENSIONS,
      input: texts,
    }),
  });

  // Process rate limit headers
  processRateLimitHeaders(response.headers, 'embeddings');

  // Handle rate limit response
  if (response.status === 429) {
    const resetHeader = response.headers.get('x-ratelimit-reset');
    const resetAt = resetHeader 
      ? new Date(parseInt(resetHeader, 10) * 1000) 
      : null;
    
    await updateRateLimitStatus({ 
      isDisabled: true, 
      embeddingsResetAt: resetAt?.toISOString() ?? null 
    });
    
    throw new JinaRateLimitError(
      'Jina Embeddings rate limit exceeded',
      'embeddings',
      resetAt
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jina Embeddings failed: ${response.status} - ${errorText}`);
  }

  const data: JinaEmbeddingsResponse = await response.json();
  
  // Sort by index to ensure correct order
  const sorted = [...data.data].sort((a, b) => a.index - b.index);
  
  return sorted.map(item => item.embedding);
}

/**
 * Generates an embedding for a search query.
 * Uses Jina Embeddings v3 with 'retrieval.query' task for queries.
 * 
 * @param query - The search query to embed
 * @throws JinaRateLimitError if rate limited
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  // Check rate limits first
  const status = await getRateLimitStatus();
  
  if (status.isDisabled) {
    const resetAt = status.embeddingsResetAt ? new Date(status.embeddingsResetAt) : null;
    throw new JinaRateLimitError(
      'Jina Embeddings rate limit reached. Knowledge feature temporarily disabled.',
      'embeddings',
      resetAt
    );
  }

  const apiKey = import.meta.env.VITE_JINA_API_KEY;
  
  if (!apiKey) {
    throw new Error('VITE_JINA_API_KEY is not configured');
  }

  const response = await fetch(JINA_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      task: 'retrieval.query',
      dimensions: EMBEDDING_DIMENSIONS,
      input: [query],
    }),
  });

  // Process rate limit headers
  processRateLimitHeaders(response.headers, 'embeddings');

  // Handle rate limit response
  if (response.status === 429) {
    const resetHeader = response.headers.get('x-ratelimit-reset');
    const resetAt = resetHeader 
      ? new Date(parseInt(resetHeader, 10) * 1000) 
      : null;
    
    await updateRateLimitStatus({ 
      isDisabled: true, 
      embeddingsResetAt: resetAt?.toISOString() ?? null 
    });
    
    throw new JinaRateLimitError(
      'Jina Embeddings rate limit exceeded',
      'embeddings',
      resetAt
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jina Embeddings failed: ${response.status} - ${errorText}`);
  }

  const data: JinaEmbeddingsResponse = await response.json();
  
  return data.data[0].embedding;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { EMBEDDING_DIMENSIONS };
