-- Eliza DD Frontend Database Schema
-- Run this in Supabase SQL Editor to set up the database
-- NOTE: This schema works with Privy authentication (not Supabase Auth)

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table (linked to Privy authentication)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table (chat sessions with elizaOS backend)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  timeout_config JSONB DEFAULT '{}'
);

-- Messages table (chat messages within sessions)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id TEXT,
  text TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  created_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'
);

-- User preferences table (theme, terminal config, etc.)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  terminal_config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON public.users(privy_user_id);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON public.sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_agent ON public.sessions(user_id, agent_id);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON public.messages(session_id, created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- NOTE: Since we're using Privy (not Supabase Auth), we disable RLS
-- and handle authorization at the application level.
-- The service_role key is used which bypasses RLS anyway.

-- Disable RLS on all tables (application handles authorization)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant full access to authenticated and service roles
GRANT ALL ON public.users TO authenticated, service_role;
GRANT ALL ON public.sessions TO authenticated, service_role;
GRANT ALL ON public.messages TO authenticated, service_role;
GRANT ALL ON public.user_preferences TO authenticated, service_role;

-- Grant access to anon for initial user creation
GRANT SELECT, INSERT ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO anon;

-- ============================================================================
-- REALTIME
-- ============================================================================
-- Enable realtime for messages and sessions
-- Run this if you want real-time updates (optional)

-- Check if publication exists before adding tables
DO $$
BEGIN
  -- Add tables to realtime publication if they're not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Publication doesn't exist, skip
    NULL;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.users IS 'User accounts linked to Privy authentication';
COMMENT ON TABLE public.sessions IS 'Chat sessions with elizaOS agents';
COMMENT ON TABLE public.messages IS 'Chat messages within sessions';
COMMENT ON TABLE public.user_preferences IS 'User preferences (theme, terminal settings, etc.)';

COMMENT ON COLUMN public.users.privy_user_id IS 'Privy user ID from authentication';
COMMENT ON COLUMN public.sessions.channel_id IS 'Channel ID for the session';
COMMENT ON COLUMN public.sessions.agent_id IS 'ElizaOS agent ID';
COMMENT ON COLUMN public.sessions.metadata IS 'Additional session metadata';
COMMENT ON COLUMN public.sessions.timeout_config IS 'Session timeout configuration';
COMMENT ON COLUMN public.messages.role IS 'Message role: user or agent';
COMMENT ON COLUMN public.user_preferences.terminal_config IS 'Terminal appearance configuration (font, colors, etc.)';

-- ============================================================================
-- MEMORY & CONTEXT PROFILING TABLES
-- ============================================================================

-- Conversation summaries for short-term memory
-- Stores summarized context from recent conversations
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  
  -- Summary content
  summary TEXT NOT NULL,
  key_topics TEXT[] DEFAULT '{}',
  key_entities JSONB DEFAULT '{}',
  sentiment_score REAL DEFAULT 0,
  
  -- Context window info
  message_count INTEGER DEFAULT 0,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- User context profiles for longer-term memory
-- Aggregated user preferences and patterns learned from conversations
CREATE TABLE IF NOT EXISTS public.user_context_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  
  -- Profile data
  display_name TEXT,
  inferred_interests TEXT[] DEFAULT '{}',
  communication_style JSONB DEFAULT '{}',
  preferred_topics TEXT[] DEFAULT '{}',
  
  -- Betting/prediction context (specific to this app)
  favorite_teams TEXT[] DEFAULT '{}',
  favorite_sports TEXT[] DEFAULT '{}',
  risk_tolerance TEXT DEFAULT 'moderate' CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  betting_preferences JSONB DEFAULT '{}',
  
  -- Interaction patterns
  total_sessions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_session_duration_minutes REAL DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  
  -- Profile metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  
  -- Unique constraint per user per agent
  UNIQUE(user_id, agent_id)
);

-- Memory fragments for fine-grained context storage
-- Individual pieces of information learned about the user
CREATE TABLE IF NOT EXISTS public.memory_fragments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  
  -- Memory content
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'intent', 'entity', 'context')),
  content TEXT NOT NULL,
  confidence REAL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Source tracking
  source_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Relevance and decay
  importance REAL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- MEMORY INDEXES
-- ============================================================================

-- Conversation summaries indexes
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_session_id ON public.conversation_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_id ON public.conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_agent_id ON public.conversation_summaries(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_agent ON public.conversation_summaries(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_updated_at ON public.conversation_summaries(updated_at DESC);

-- User context profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_context_profiles_user_id ON public.user_context_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_context_profiles_agent_id ON public.user_context_profiles(agent_id);
CREATE INDEX IF NOT EXISTS idx_user_context_profiles_last_interaction ON public.user_context_profiles(last_interaction_at DESC);

-- Memory fragments indexes
CREATE INDEX IF NOT EXISTS idx_memory_fragments_user_id ON public.memory_fragments(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_fragments_session_id ON public.memory_fragments(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_fragments_agent_id ON public.memory_fragments(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_fragments_user_agent ON public.memory_fragments(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_fragments_type ON public.memory_fragments(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_fragments_importance ON public.memory_fragments(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memory_fragments_expires_at ON public.memory_fragments(expires_at) WHERE expires_at IS NOT NULL;

-- Full-text search on memory content
CREATE INDEX IF NOT EXISTS idx_memory_fragments_content_search ON public.memory_fragments USING gin(to_tsvector('english', content));

-- ============================================================================
-- MEMORY TRIGGERS
-- ============================================================================

-- Auto-update updated_at for conversation_summaries
DROP TRIGGER IF EXISTS update_conversation_summaries_updated_at ON public.conversation_summaries;
CREATE TRIGGER update_conversation_summaries_updated_at
  BEFORE UPDATE ON public.conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at for user_context_profiles
DROP TRIGGER IF EXISTS update_user_context_profiles_updated_at ON public.user_context_profiles;
CREATE TRIGGER update_user_context_profiles_updated_at
  BEFORE UPDATE ON public.user_context_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MEMORY SECURITY
-- ============================================================================

-- Disable RLS (application handles authorization via Privy)
ALTER TABLE public.conversation_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_context_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_fragments DISABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON public.conversation_summaries TO authenticated, service_role;
GRANT ALL ON public.user_context_profiles TO authenticated, service_role;
GRANT ALL ON public.memory_fragments TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_summaries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_context_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_fragments TO anon;

-- ============================================================================
-- MEMORY REALTIME
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_summaries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_summaries;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_context_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_context_profiles;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- ============================================================================
-- MEMORY COMMENTS
-- ============================================================================

COMMENT ON TABLE public.conversation_summaries IS 'Summarized context from chat sessions for short-term memory';
COMMENT ON TABLE public.user_context_profiles IS 'Aggregated user profiles learned from conversations';
COMMENT ON TABLE public.memory_fragments IS 'Individual memory pieces extracted from conversations';

COMMENT ON COLUMN public.conversation_summaries.key_topics IS 'Main topics discussed in the session';
COMMENT ON COLUMN public.conversation_summaries.key_entities IS 'Named entities (teams, players, markets) mentioned';
COMMENT ON COLUMN public.conversation_summaries.sentiment_score IS 'Overall sentiment (-1 to 1)';

COMMENT ON COLUMN public.user_context_profiles.communication_style IS 'Learned communication preferences (formal/casual, verbose/concise)';
COMMENT ON COLUMN public.user_context_profiles.risk_tolerance IS 'Betting risk preference level';
COMMENT ON COLUMN public.user_context_profiles.betting_preferences IS 'Specific betting preferences (bet types, stake sizes)';

COMMENT ON COLUMN public.memory_fragments.memory_type IS 'Type of memory: fact, preference, intent, entity, context';
COMMENT ON COLUMN public.memory_fragments.confidence IS 'Confidence score (0-1) for this memory';
COMMENT ON COLUMN public.memory_fragments.importance IS 'Importance weight for retrieval ranking';
COMMENT ON COLUMN public.memory_fragments.expires_at IS 'Optional expiration for short-term memories';
