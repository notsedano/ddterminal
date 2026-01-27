/**
 * Supabase Client
 * Centralized Supabase client initialization with proper typing
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

/**
 * Supabase client instance
 * Uses typed Database interface for full type safety
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-client-info': 'eliza-dd-frontend',
      },
    },
  }
);

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Set custom auth token for authenticated requests
 * Used with Privy JWT tokens
 */
export async function setSupabaseAuth(accessToken: string | null): Promise<void> {
  if (accessToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: '',
    });
  } else {
    await supabase.auth.signOut();
  }
}

/**
 * Create a new Supabase client with a specific auth token
 * Useful for server-side operations or when you need a fresh client
 */
export function createAuthenticatedClient(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'x-client-info': 'eliza-dd-frontend',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

export type { Database };
