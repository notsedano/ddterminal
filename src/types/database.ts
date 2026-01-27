/**
 * Supabase Database Types
 * Auto-generated types for the database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          privy_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          privy_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          privy_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          channel_id: string;
          agent_id: string;
          created_at: string;
          expires_at: string;
          metadata: Json;
          timeout_config: Json;
        };
        Insert: {
          id: string;
          user_id: string;
          channel_id: string;
          agent_id: string;
          created_at: string;
          expires_at: string;
          metadata?: Json;
          timeout_config?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          channel_id?: string;
          agent_id?: string;
          created_at?: string;
          expires_at?: string;
          metadata?: Json;
          timeout_config?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          agent_id: string | null;
          text: string;
          role: 'user' | 'agent';
          created_at: string;
          metadata: Json;
        };
        Insert: {
          id: string;
          session_id: string;
          user_id: string;
          agent_id?: string | null;
          text: string;
          role: 'user' | 'agent';
          created_at: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          agent_id?: string | null;
          text?: string;
          role?: 'user' | 'agent';
          created_at?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      user_preferences: {
        Row: {
          user_id: string;
          theme: 'dark' | 'light';
          terminal_config: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          theme?: 'dark' | 'light';
          terminal_config?: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          theme?: 'dark' | 'light';
          terminal_config?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_preferences_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      conversation_summaries: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          agent_id: string;
          summary: string;
          key_topics: string[];
          key_entities: Json;
          sentiment_score: number;
          message_count: number;
          first_message_at: string | null;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          agent_id: string;
          summary: string;
          key_topics?: string[];
          key_entities?: Json;
          sentiment_score?: number;
          message_count?: number;
          first_message_at?: string | null;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          agent_id?: string;
          summary?: string;
          key_topics?: string[];
          key_entities?: Json;
          sentiment_score?: number;
          message_count?: number;
          first_message_at?: string | null;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_summaries_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_summaries_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      user_context_profiles: {
        Row: {
          id: string;
          user_id: string;
          agent_id: string;
          display_name: string | null;
          inferred_interests: string[];
          communication_style: Json;
          preferred_topics: string[];
          favorite_teams: string[];
          favorite_sports: string[];
          risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
          betting_preferences: Json;
          total_sessions: number;
          total_messages: number;
          avg_session_duration_minutes: number;
          last_interaction_at: string | null;
          created_at: string;
          updated_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          agent_id: string;
          display_name?: string | null;
          inferred_interests?: string[];
          communication_style?: Json;
          preferred_topics?: string[];
          favorite_teams?: string[];
          favorite_sports?: string[];
          risk_tolerance?: 'conservative' | 'moderate' | 'aggressive';
          betting_preferences?: Json;
          total_sessions?: number;
          total_messages?: number;
          avg_session_duration_minutes?: number;
          last_interaction_at?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          agent_id?: string;
          display_name?: string | null;
          inferred_interests?: string[];
          communication_style?: Json;
          preferred_topics?: string[];
          favorite_teams?: string[];
          favorite_sports?: string[];
          risk_tolerance?: 'conservative' | 'moderate' | 'aggressive';
          betting_preferences?: Json;
          total_sessions?: number;
          total_messages?: number;
          avg_session_duration_minutes?: number;
          last_interaction_at?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'user_context_profiles_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      memory_fragments: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          agent_id: string;
          memory_type: 'fact' | 'preference' | 'intent' | 'entity' | 'context';
          content: string;
          confidence: number;
          source_message_id: string | null;
          extracted_at: string;
          importance: number;
          access_count: number;
          last_accessed_at: string | null;
          expires_at: string | null;
          created_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          agent_id: string;
          memory_type: 'fact' | 'preference' | 'intent' | 'entity' | 'context';
          content: string;
          confidence?: number;
          source_message_id?: string | null;
          extracted_at?: string;
          importance?: number;
          access_count?: number;
          last_accessed_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string | null;
          agent_id?: string;
          memory_type?: 'fact' | 'preference' | 'intent' | 'entity' | 'context';
          content?: string;
          confidence?: number;
          source_message_id?: string | null;
          extracted_at?: string;
          importance?: number;
          access_count?: number;
          last_accessed_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'memory_fragments_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memory_fragments_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memory_fragments_source_message_id_fkey';
            columns: ['source_message_id'];
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          }
        ];
      };
      archived_sessions: {
        Row: {
          id: string;
          original_session_id: string;
          user_id: string;
          channel_id: string;
          agent_id: string;
          matchup_title: string | null;
          matchup_data: Json;
          original_created_at: string;
          original_expires_at: string | null;
          original_metadata: Json;
          timeout_config: Json;
          message_count: number;
          messages: Json;
          conversation_summary: Json;
          memory_fragments: Json;
          archived_at: string;
          archived_by: string | null;
          archive_reason: string;
        };
        Insert: {
          id?: string;
          original_session_id: string;
          user_id: string;
          channel_id: string;
          agent_id: string;
          matchup_title?: string | null;
          matchup_data?: Json;
          original_created_at: string;
          original_expires_at?: string | null;
          original_metadata?: Json;
          timeout_config?: Json;
          message_count?: number;
          messages?: Json;
          conversation_summary?: Json;
          memory_fragments?: Json;
          archived_at?: string;
          archived_by?: string | null;
          archive_reason?: string;
        };
        Update: {
          id?: string;
          original_session_id?: string;
          user_id?: string;
          channel_id?: string;
          agent_id?: string;
          matchup_title?: string | null;
          matchup_data?: Json;
          original_created_at?: string;
          original_expires_at?: string | null;
          original_metadata?: Json;
          timeout_config?: Json;
          message_count?: number;
          messages?: Json;
          conversation_summary?: Json;
          memory_fragments?: Json;
          archived_at?: string;
          archived_by?: string | null;
          archive_reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'archived_sessions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    // eslint-disable-next-line @typescript-eslint/ban-types
    Views: {};
    // eslint-disable-next-line @typescript-eslint/ban-types
    Functions: {};
    // eslint-disable-next-line @typescript-eslint/ban-types
    Enums: {};
    // eslint-disable-next-line @typescript-eslint/ban-types
    CompositeTypes: {};
  };
}

/**
 * Convenience types for table rows
 */
export type UserRow = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type SessionRow = Database['public']['Tables']['sessions']['Row'];
export type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
export type SessionUpdate = Database['public']['Tables']['sessions']['Update'];

export type MessageRow = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

export type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row'];
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert'];
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update'];

export type ConversationSummaryRow = Database['public']['Tables']['conversation_summaries']['Row'];
export type ConversationSummaryInsert = Database['public']['Tables']['conversation_summaries']['Insert'];
export type ConversationSummaryUpdate = Database['public']['Tables']['conversation_summaries']['Update'];

export type UserContextProfileRow = Database['public']['Tables']['user_context_profiles']['Row'];
export type UserContextProfileInsert = Database['public']['Tables']['user_context_profiles']['Insert'];
export type UserContextProfileUpdate = Database['public']['Tables']['user_context_profiles']['Update'];

export type MemoryFragmentRow = Database['public']['Tables']['memory_fragments']['Row'];
export type MemoryFragmentInsert = Database['public']['Tables']['memory_fragments']['Insert'];
export type MemoryFragmentUpdate = Database['public']['Tables']['memory_fragments']['Update'];

export type ArchivedSessionRow = Database['public']['Tables']['archived_sessions']['Row'];
export type ArchivedSessionInsert = Database['public']['Tables']['archived_sessions']['Insert'];
export type ArchivedSessionUpdate = Database['public']['Tables']['archived_sessions']['Update'];
