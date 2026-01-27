/**
 * useSessionKnowledge Hook
 * 
 * React hook for managing session-scoped RAG knowledge.
 * Provides CRUD operations for knowledge sources and semantic search.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import {
  getSessionKnowledgeSources,
  addKnowledgeSource,
  processKnowledgeSource,
  deleteKnowledgeSource,
  searchSessionKnowledge,
  getKnowledgeRateLimitStatus,
  MAX_SOURCES_PER_SESSION,
} from '@/services/supabase/knowledge';
import { JinaRateLimitError } from '@/services/jina';
import type { KnowledgeSource, KnowledgeSearchResult, JinaRateLimitStatus } from '@/types/knowledge';

// ============================================================================
// QUERY KEYS
// ============================================================================

const knowledgeQueryKeys = {
  all: ['session-knowledge'] as const,
  sources: (sessionId: string) => [...knowledgeQueryKeys.all, 'sources', sessionId] as const,
  rateLimit: ['jina-rate-limit'] as const,
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export interface UseSessionKnowledgeResult {
  /** List of knowledge sources for the session */
  sources: KnowledgeSource[];
  /** Whether sources are loading */
  isLoading: boolean;
  /** Whether Jina API is rate limited */
  isRateLimited: boolean;
  /** When the rate limit will reset (ISO string) */
  rateLimitResetAt: string | null;
  /** Remaining API requests before rate limit */
  remainingRequests: number;
  /** Maximum sources allowed per session */
  maxSources: number;
  /** Whether the session has reached max sources */
  isAtLimit: boolean;
  /** Number of completed sources */
  completedCount: number;
  /** Add a new knowledge source URL */
  addSource: (url: string) => Promise<KnowledgeSource>;
  /** Delete a knowledge source */
  deleteSource: (sourceId: string) => Promise<void>;
  /** Whether an add operation is in progress */
  isAdding: boolean;
  /** Whether a delete operation is in progress */
  isDeleting: boolean;
  /** Error from the last operation */
  error: Error | null;
  /** Refetch sources */
  refetch: () => Promise<void>;
}

export function useSessionKnowledge(
  sessionId: string | null,
  userId: string | null
): UseSessionKnowledgeResult {
  const queryClient = useQueryClient();

  // ============================================================================
  // QUERIES
  // ============================================================================

  // Fetch knowledge sources for the session
  const sourcesQuery = useQuery({
    queryKey: knowledgeQueryKeys.sources(sessionId ?? ''),
    queryFn: () => getSessionKnowledgeSources(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000, // Consider fresh for 30 seconds
    refetchInterval: (query) => {
      // Refetch every 5 seconds if any source is processing
      const data = query.state.data as KnowledgeSource[] | undefined;
      const hasProcessing = data?.some(s => s.status === 'processing' || s.status === 'pending');
      return hasProcessing ? 5_000 : false;
    },
  });

  // Fetch Jina API rate limit status
  const rateLimitQuery = useQuery({
    queryKey: knowledgeQueryKeys.rateLimit,
    queryFn: getKnowledgeRateLimitStatus,
    staleTime: 60_000, // Consider fresh for 1 minute
    refetchInterval: (query) => {
      // Refetch every 30 seconds if rate limited
      const data = query.state.data as JinaRateLimitStatus | undefined;
      return data?.isDisabled ? 30_000 : 120_000;
    },
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  // Add a new knowledge source
  const addSourceMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!sessionId || !userId) {
        throw new Error('Session and user are required');
      }
      
      // Add the source (creates in pending status)
      const source = await addKnowledgeSource(sessionId, userId, url);
      
      // Start processing in the background
      // We don't await this - it runs async and updates the source status
      processKnowledgeSource(source.id)
        .then(() => {
          // Refetch to get the completed source
          queryClient.invalidateQueries({ 
            queryKey: knowledgeQueryKeys.sources(sessionId) 
          });
        })
        .catch((error) => {
          console.error('Failed to process knowledge source:', error);
          // Refetch to get the failed status
          queryClient.invalidateQueries({ 
            queryKey: knowledgeQueryKeys.sources(sessionId) 
          });
          // Update rate limit status if it was a rate limit error
          if (error instanceof JinaRateLimitError) {
            queryClient.invalidateQueries({ 
              queryKey: knowledgeQueryKeys.rateLimit 
            });
          }
        });

      return source;
    },
    onSuccess: () => {
      // Immediately refetch to show the pending source
      if (sessionId) {
        queryClient.invalidateQueries({ 
          queryKey: knowledgeQueryKeys.sources(sessionId) 
        });
      }
    },
    onError: (error) => {
      // If rate limited, update the rate limit status
      if (error instanceof JinaRateLimitError) {
        queryClient.invalidateQueries({ 
          queryKey: knowledgeQueryKeys.rateLimit 
        });
      }
    },
  });

  // Delete a knowledge source
  const deleteSourceMutation = useMutation({
    mutationFn: deleteKnowledgeSource,
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ 
          queryKey: knowledgeQueryKeys.sources(sessionId) 
        });
      }
    },
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const sources = sourcesQuery.data ?? [];
  const completedCount = sources.filter(s => s.status === 'completed').length;
  const isAtLimit = sources.length >= MAX_SOURCES_PER_SESSION;

  const rateLimitStatus = rateLimitQuery.data;
  const isRateLimited = rateLimitStatus?.isDisabled ?? false;
  const rateLimitResetAt = rateLimitStatus?.readerResetAt ?? rateLimitStatus?.embeddingsResetAt ?? null;
  const remainingRequests = Math.min(
    rateLimitStatus?.readerRequestsRemaining ?? 999,
    rateLimitStatus?.embeddingsRequestsRemaining ?? 999
  );

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  const addSource = useCallback(
    (url: string) => addSourceMutation.mutateAsync(url),
    [addSourceMutation]
  );

  const deleteSource = useCallback(
    (sourceId: string) => deleteSourceMutation.mutateAsync(sourceId),
    [deleteSourceMutation]
  );

  const refetch = useCallback(async () => {
    if (sessionId) {
      await queryClient.invalidateQueries({ 
        queryKey: knowledgeQueryKeys.sources(sessionId) 
      });
    }
  }, [queryClient, sessionId]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Prefetch rate limit status when hook mounts
  useEffect(() => {
    if (!rateLimitQuery.data) {
      queryClient.prefetchQuery({
        queryKey: knowledgeQueryKeys.rateLimit,
        queryFn: getKnowledgeRateLimitStatus,
      });
    }
  }, [queryClient, rateLimitQuery.data]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    sources,
    isLoading: sourcesQuery.isLoading,
    isRateLimited,
    rateLimitResetAt,
    remainingRequests,
    maxSources: MAX_SOURCES_PER_SESSION,
    isAtLimit,
    completedCount,
    addSource,
    deleteSource,
    isAdding: addSourceMutation.isPending,
    isDeleting: deleteSourceMutation.isPending,
    error: addSourceMutation.error ?? deleteSourceMutation.error ?? null,
    refetch,
  };
}

// ============================================================================
// KNOWLEDGE SEARCH HOOK
// ============================================================================

export interface UseKnowledgeSearchResult {
  /** Perform a semantic search on session knowledge */
  search: (query: string, limit?: number) => Promise<KnowledgeSearchResult[]>;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Last search results */
  results: KnowledgeSearchResult[];
  /** Error from the last search */
  error: Error | null;
  /** Clear the last search results */
  clearResults: () => void;
}

export function useKnowledgeSearch(sessionId: string | null): UseKnowledgeSearchResult {
  const queryClient = useQueryClient();

  const searchMutation = useMutation({
    mutationFn: async ({ query, limit = 5 }: { query: string; limit?: number }) => {
      if (!sessionId) {
        throw new Error('No session ID');
      }
      return searchSessionKnowledge(sessionId, query, limit);
    },
    onError: (error) => {
      if (error instanceof JinaRateLimitError) {
        queryClient.invalidateQueries({ 
          queryKey: knowledgeQueryKeys.rateLimit 
        });
      }
    },
  });

  const search = useCallback(
    (query: string, limit?: number) => searchMutation.mutateAsync({ query, limit }),
    [searchMutation]
  );

  const clearResults = useCallback(() => {
    searchMutation.reset();
  }, [searchMutation]);

  return {
    search,
    isSearching: searchMutation.isPending,
    results: searchMutation.data ?? [],
    error: searchMutation.error,
    clearResults,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { knowledgeQueryKeys };
