-- Archived Sessions Migration
-- Creates table to store deleted conversations for potential recovery/analytics

-- ============================================================================
-- ARCHIVED SESSIONS TABLE
-- ============================================================================

-- Archived sessions (soft-deleted conversations)
CREATE TABLE IF NOT EXISTS public.archived_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Original session data
  original_session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  
  -- Matchup metadata
  matchup_title TEXT,
  matchup_data JSONB DEFAULT '{}',
  
  -- Session metadata
  original_created_at TIMESTAMPTZ NOT NULL,
  original_expires_at TIMESTAMPTZ,
  original_metadata JSONB DEFAULT '{}',
  timeout_config JSONB DEFAULT '{}',
  
  -- Message archive (denormalized for easy access)
  message_count INTEGER DEFAULT 0,
  messages JSONB DEFAULT '[]',
  
  -- Memory data at time of deletion
  conversation_summary JSONB DEFAULT '{}',
  memory_fragments JSONB DEFAULT '[]',
  
  -- Archive metadata
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES public.users(id),
  archive_reason TEXT DEFAULT 'user_deleted',
  
  -- Prevent duplicate archives of same session
  UNIQUE(original_session_id, user_id)
);

-- ============================================================================
-- ARCHIVED SESSIONS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_archived_sessions_user_id ON public.archived_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_archived_sessions_agent_id ON public.archived_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_archived_sessions_archived_at ON public.archived_sessions(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_sessions_original_session_id ON public.archived_sessions(original_session_id);
CREATE INDEX IF NOT EXISTS idx_archived_sessions_matchup_title ON public.archived_sessions(matchup_title) WHERE matchup_title IS NOT NULL;

-- ============================================================================
-- SECURITY
-- ============================================================================

ALTER TABLE public.archived_sessions DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.archived_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_sessions TO anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.archived_sessions IS 'Stores deleted conversations for recovery and analytics';
COMMENT ON COLUMN public.archived_sessions.matchup_title IS 'Title of the matchup this conversation was about (e.g., "Lakers vs Celtics")';
COMMENT ON COLUMN public.archived_sessions.matchup_data IS 'Full matchup metadata (teams, game ID, sport, etc.)';
COMMENT ON COLUMN public.archived_sessions.messages IS 'Archived messages as JSON array';
COMMENT ON COLUMN public.archived_sessions.archive_reason IS 'Why the session was archived: user_deleted, expired, system_cleanup';
