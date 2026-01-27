/**
 * Authentication Hook
 * Provides authentication state and actions using Privy
 */

import { useCallback, useEffect, useState } from 'react';
import {
  usePrivy,
  useLogin,
  useLogout,
  useLinkAccount,
  User as PrivyUserType,
} from '@privy-io/react-auth';
import {
  getOrCreateUser,
  migrateToSupabase,
  isMigrationCompleted,
  isSupabaseConfigured,
} from '@/services/supabase';
import { getUserId as getLegacyUserId } from '@/utils/storage';
import type { AuthState } from '@/types/auth';

interface UseAuthReturn extends AuthState {
  login: () => void;
  logout: () => Promise<void>;
  linkEmail: () => void;
  linkWallet: () => void;
  linkGoogle: () => void;
  linkTwitter: () => void;
  linkDiscord: () => void;
  linkGithub: () => void;
  linkFarcaster: () => void;
  getAccessToken: () => Promise<string | null>;
  privyUser: PrivyUserType | null;
  isMigrating: boolean;
  migrationProgress: { current: number; total: number; stage: string } | null;
}

/**
 * Main authentication hook
 * Handles Privy authentication and Supabase user management
 */
export function useAuth(): UseAuthReturn {
  const {
    ready,
    authenticated,
    user: privyUser,
    getAccessToken: privyGetAccessToken,
  } = usePrivy();

  const { login } = useLogin({
    onComplete: (params) => {
      console.log('Login complete:', { userId: params.user.id, isNewUser: params.isNewUser });
    },
    onError: (error) => {
      console.error('Login error:', error);
    },
  });

  const { logout: privyLogout } = useLogout({
    onSuccess: () => {
      setSupabaseUserId(null);
      console.log('Logout complete');
    },
  });

  // Link methods from useLinkAccount
  const {
    linkEmail,
    linkWallet,
    linkGoogle,
    linkTwitter,
    linkDiscord,
    linkGithub,
    linkFarcaster,
  } = useLinkAccount({
    onSuccess: ({ linkMethod, linkedAccount }) => {
      console.log('Account linked:', { linkMethod, linkedAccount });
    },
    onError: (error) => {
      console.error('Link error:', error);
    },
  });

  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    current: number;
    total: number;
    stage: string;
  } | null>(null);

  // Sync Privy user with Supabase
  useEffect(() => {
    async function syncUser() {
      if (!authenticated || !privyUser || !isSupabaseConfigured()) {
        return;
      }

      // Get or create Supabase user
      const supabaseUser = await getOrCreateUser(privyUser.id);
      setSupabaseUserId(supabaseUser.id);

      // Check if migration is needed
      if (!isMigrationCompleted(supabaseUser.id)) {
        setIsMigrating(true);
        const legacyUserId = getLegacyUserId();

        const result = await migrateToSupabase(
          legacyUserId,
          supabaseUser.id,
          (progress) => setMigrationProgress(progress)
        );

        console.log('Migration result:', result);
        setIsMigrating(false);
        setMigrationProgress(null);
      }
    }

    if (ready && authenticated && privyUser) {
      syncUser();
    }
  }, [ready, authenticated, privyUser]);

  const logout = useCallback(async () => {
    await privyLogout();
  }, [privyLogout]);

  const getAccessToken = useCallback(async () => {
    if (!authenticated) return null;
    return privyGetAccessToken();
  }, [authenticated, privyGetAccessToken]);

  return {
    isAuthenticated: authenticated,
    isLoading: !ready,
    user: privyUser as unknown as UseAuthReturn['user'],
    supabaseUserId,
    login,
    logout,
    linkEmail,
    linkWallet,
    linkGoogle,
    linkTwitter,
    linkDiscord,
    linkGithub,
    linkFarcaster,
    getAccessToken,
    privyUser,
    isMigrating,
    migrationProgress,
  };
}

/**
 * Hook to get the current user ID
 * Returns Supabase user ID if authenticated, otherwise legacy user ID
 */
export function useUserId(): string {
  const { isAuthenticated, supabaseUserId } = useAuth();

  if (isAuthenticated && supabaseUserId) {
    return supabaseUserId;
  }

  return getLegacyUserId();
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated, isLoading } = useAuth();
  return !isLoading && isAuthenticated;
}
