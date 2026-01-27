-- Session Knowledge: URL-based RAG for sports articles
-- Knowledge is session-scoped and automatically deleted when session ends
-- Migration: 20260128_session_knowledge.sql

-- ============================================================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- SESSION KNOWLEDGE SOURCES TABLE
-- ============================================================================

-- Stores the URLs/sources added to a session (max 5 per session)
CREATE TABLE IF NOT EXISTS public.session_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Source info
  url TEXT NOT NULL,
  title TEXT,
  source_domain TEXT,
  author TEXT,
  published_date TIMESTAMPTZ,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Stats
  word_count INTEGER,
  chunk_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Metadata (siteName, description, og:image, etc.)
  metadata JSONB DEFAULT '{}',
  
  -- Unique URL per session
  CONSTRAINT unique_url_per_session UNIQUE(session_id, url)
);

-- ============================================================================
-- SESSION KNOWLEDGE CHUNKS TABLE
-- ============================================================================

-- Stores embedded content chunks for vector similarity search
CREATE TABLE IF NOT EXISTS public.session_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.session_knowledge_sources(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  
  -- Chunk content
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  
  -- Embedding vector (Jina v3 produces 1024 dimensions)
  embedding vector(1024),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- JINA API RATE LIMIT TRACKING TABLE
-- ============================================================================

-- Singleton table to track Jina API rate limits across all users
CREATE TABLE IF NOT EXISTS public.jina_rate_limit_status (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  reader_requests_remaining INTEGER DEFAULT 200,
  reader_reset_at TIMESTAMPTZ,
  embeddings_requests_remaining INTEGER DEFAULT 500,
  embeddings_reset_at TIMESTAMPTZ,
  is_disabled BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize the singleton row
INSERT INTO public.jina_rate_limit_status (id) 
VALUES (1) 
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Session knowledge sources indexes
CREATE INDEX IF NOT EXISTS idx_session_knowledge_sources_session 
  ON public.session_knowledge_sources(session_id);
CREATE INDEX IF NOT EXISTS idx_session_knowledge_sources_status 
  ON public.session_knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_session_knowledge_sources_user 
  ON public.session_knowledge_sources(user_id);

-- Session knowledge chunks indexes
CREATE INDEX IF NOT EXISTS idx_session_knowledge_chunks_session 
  ON public.session_knowledge_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_session_knowledge_chunks_source 
  ON public.session_knowledge_chunks(source_id);

-- Vector similarity search index using HNSW (Hierarchical Navigable Small World)
-- This enables fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_session_knowledge_chunks_embedding 
  ON public.session_knowledge_chunks 
  USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Count sources per session (for enforcing max 5 limit)
CREATE OR REPLACE FUNCTION public.count_session_knowledge_sources(p_session_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM public.session_knowledge_sources 
    WHERE session_id = p_session_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Semantic search within session knowledge
-- Uses cosine similarity to find the most relevant chunks for a query
CREATE OR REPLACE FUNCTION public.search_session_knowledge(
  p_session_id UUID,
  p_query_embedding vector(1024),
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  content TEXT,
  chunk_index INTEGER,
  source_title TEXT,
  source_url TEXT,
  source_domain TEXT,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS chunk_id,
    c.source_id,
    c.content,
    c.chunk_index,
    s.title AS source_title,
    s.url AS source_url,
    s.source_domain,
    (1 - (c.embedding <=> p_query_embedding))::REAL AS similarity
  FROM public.session_knowledge_chunks c
  INNER JOIN public.session_knowledge_sources s ON s.id = c.source_id
  WHERE c.session_id = p_session_id
    AND c.embedding IS NOT NULL
    AND s.status = 'completed'
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get all knowledge content for a session (for full context injection)
CREATE OR REPLACE FUNCTION public.get_session_knowledge_context(p_session_id UUID)
RETURNS TABLE (
  source_title TEXT,
  source_url TEXT,
  source_domain TEXT,
  content TEXT,
  chunk_index INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.title AS source_title,
    s.url AS source_url,
    s.source_domain,
    c.content,
    c.chunk_index
  FROM public.session_knowledge_chunks c
  INNER JOIN public.session_knowledge_sources s ON s.id = c.source_id
  WHERE c.session_id = p_session_id
    AND s.status = 'completed'
  ORDER BY s.created_at, c.chunk_index;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Disable RLS (application handles authorization via Privy)
ALTER TABLE public.session_knowledge_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_knowledge_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jina_rate_limit_status DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant full access to authenticated and service roles
GRANT ALL ON public.session_knowledge_sources TO authenticated, service_role;
GRANT ALL ON public.session_knowledge_chunks TO authenticated, service_role;
GRANT ALL ON public.jina_rate_limit_status TO authenticated, service_role;

-- Grant access to anon for frontend operations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_knowledge_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_knowledge_chunks TO anon;
GRANT SELECT, UPDATE ON public.jina_rate_limit_status TO anon;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.count_session_knowledge_sources(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_session_knowledge(UUID, vector(1024), INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_session_knowledge_context(UUID) TO anon, authenticated, service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.session_knowledge_sources IS 'URL sources for session-scoped RAG knowledge (sports articles)';
COMMENT ON TABLE public.session_knowledge_chunks IS 'Embedded text chunks for semantic search within session knowledge';
COMMENT ON TABLE public.jina_rate_limit_status IS 'Tracks Jina API rate limits to auto-disable when limits are reached';

COMMENT ON COLUMN public.session_knowledge_sources.status IS 'Processing status: pending, processing, completed, failed';
COMMENT ON COLUMN public.session_knowledge_sources.source_domain IS 'Extracted domain from URL (e.g., espn.com)';
COMMENT ON COLUMN public.session_knowledge_chunks.embedding IS 'Jina v3 embedding vector (1024 dimensions)';
COMMENT ON COLUMN public.session_knowledge_chunks.chunk_index IS 'Order of chunk within source document';

COMMENT ON FUNCTION public.search_session_knowledge IS 'Semantic search using cosine similarity on embedded chunks';
COMMENT ON FUNCTION public.get_session_knowledge_context IS 'Get all knowledge content for a session for full context injection';
