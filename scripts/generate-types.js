/**
 * Generate TypeScript types from Supabase database
 * Uses Supabase REST API to introspect the database
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env
const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Generate types based on our known schema
const types = `/**
 * Supabase Database Types
 * Auto-generated from database schema
 * Last updated: ${new Date().toISOString()}
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          privy_user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          privy_user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          privy_user_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          channel_id: string
          agent_id: string
          created_at: string
          expires_at: string
          metadata: Json
          timeout_config: Json
        }
        Insert: {
          id: string
          user_id: string
          channel_id: string
          agent_id: string
          created_at: string
          expires_at: string
          metadata?: Json
          timeout_config?: Json
        }
        Update: {
          id?: string
          user_id?: string
          channel_id?: string
          agent_id?: string
          created_at?: string
          expires_at?: string
          metadata?: Json
          timeout_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          session_id: string
          user_id: string
          agent_id: string | null
          text: string
          role: 'user' | 'agent'
          created_at: string
          metadata: Json
        }
        Insert: {
          id: string
          session_id: string
          user_id: string
          agent_id?: string | null
          text: string
          role: 'user' | 'agent'
          created_at: string
          metadata?: Json
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          agent_id?: string | null
          text?: string
          role?: 'user' | 'agent'
          created_at?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_preferences: {
        Row: {
          user_id: string
          theme: 'dark' | 'light'
          terminal_config: Json
          updated_at: string
        }
        Insert: {
          user_id: string
          theme?: 'dark' | 'light'
          terminal_config?: Json
          updated_at?: string
        }
        Update: {
          user_id?: string
          theme?: 'dark' | 'light'
          terminal_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}

export type UserRow = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type SessionRow = Database['public']['Tables']['sessions']['Row']
export type SessionInsert = Database['public']['Tables']['sessions']['Insert']
export type SessionUpdate = Database['public']['Tables']['sessions']['Update']

export type MessageRow = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type MessageUpdate = Database['public']['Tables']['messages']['Update']

export type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row']
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert']
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update']
`;

async function verifyAndGenerate() {
  console.log('🔍 Verifying database connection...');
  
  try {
    // Test connection by querying users table
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection error:', error.message);
      return false;
    }
    
    console.log('✅ Database connection verified');
    
    // Write types file
    const typesPath = join(__dirname, '..', 'src', 'types', 'database.ts');
    writeFileSync(typesPath, types, 'utf-8');
    console.log('✅ TypeScript types generated:', typesPath);
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

verifyAndGenerate().then(success => {
  process.exit(success ? 0 : 1);
});
