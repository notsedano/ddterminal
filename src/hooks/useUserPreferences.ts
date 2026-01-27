/**
 * User Preferences Hook
 * Manages user preferences with Supabase sync
 */

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  getUserPreferencesFromSupabase,
  updateThemePreference,
  updateTerminalConfig,
  isSupabaseConfigured,
} from '@/services/supabase';
import { getTheme, setTheme as setLocalTheme } from '@/utils/storage';
import type { TerminalConfig } from '@/types/auth';
import type { UserPreferencesRow } from '@/types/database';

interface UseUserPreferencesReturn {
  theme: 'dark' | 'light';
  terminalConfig: TerminalConfig;
  isLoading: boolean;
  setTheme: (theme: 'dark' | 'light') => Promise<void>;
  setTerminalConfig: (config: TerminalConfig) => Promise<void>;
  updateTerminalSetting: <K extends keyof TerminalConfig>(
    key: K,
    value: TerminalConfig[K]
  ) => Promise<void>;
}

const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  cursorBlink: true,
  cursorStyle: 'block',
  lineHeight: 1.2,
  letterSpacing: 0,
};

/**
 * Hook for managing user preferences
 * Syncs with Supabase for authenticated users
 */
export function useUserPreferences(): UseUserPreferencesReturn {
  const { isAuthenticated, supabaseUserId } = useAuth();
  const queryClient = useQueryClient();

  // Local state for non-authenticated users
  const [localTheme, setLocalThemeState] = useState<'dark' | 'light'>(() => getTheme());
  const [localTerminalConfig, setLocalTerminalConfig] = useState<TerminalConfig>(
    () => {
      const stored = localStorage.getItem('eliza_terminal_config');
      return stored ? JSON.parse(stored) : DEFAULT_TERMINAL_CONFIG;
    }
  );

  // Query for Supabase preferences
  const { data: supabasePreferences, isLoading } = useQuery<UserPreferencesRow | null>({
    queryKey: ['user-preferences', supabaseUserId],
    queryFn: () => {
      if (!supabaseUserId || !isSupabaseConfigured()) {
        return null;
      }
      return getUserPreferencesFromSupabase(supabaseUserId);
    },
    enabled: isAuthenticated && !!supabaseUserId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Theme mutation
  const themeMutation = useMutation({
    mutationFn: async (theme: 'dark' | 'light') => {
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        await updateThemePreference(supabaseUserId, theme);
      }
      return theme;
    },
    onSuccess: (theme) => {
      setLocalTheme(theme);
      setLocalThemeState(theme);
      queryClient.invalidateQueries({ queryKey: ['user-preferences', supabaseUserId] });
    },
  });

  // Terminal config mutation
  const terminalConfigMutation = useMutation({
    mutationFn: async (config: TerminalConfig) => {
      if (isAuthenticated && supabaseUserId && isSupabaseConfigured()) {
        await updateTerminalConfig(supabaseUserId, config);
      }
      return config;
    },
    onSuccess: (config) => {
      localStorage.setItem('eliza_terminal_config', JSON.stringify(config));
      setLocalTerminalConfig(config);
      queryClient.invalidateQueries({ queryKey: ['user-preferences', supabaseUserId] });
    },
  });

  // Sync Supabase preferences to local state when loaded
  useEffect(() => {
    if (supabasePreferences) {
      setLocalThemeState(supabasePreferences.theme);
      setLocalTheme(supabasePreferences.theme);

      const terminalConfig = (supabasePreferences.terminal_config || DEFAULT_TERMINAL_CONFIG) as TerminalConfig;
      setLocalTerminalConfig(terminalConfig);
      localStorage.setItem('eliza_terminal_config', JSON.stringify(terminalConfig));
    }
  }, [supabasePreferences]);

  // Current values - use Supabase if available, otherwise local
  const theme = supabasePreferences?.theme || localTheme;
  const terminalConfig = supabasePreferences
    ? (supabasePreferences.terminal_config as TerminalConfig) || DEFAULT_TERMINAL_CONFIG
    : localTerminalConfig;

  const setTheme = useCallback(
    async (newTheme: 'dark' | 'light') => {
      await themeMutation.mutateAsync(newTheme);
    },
    [themeMutation]
  );

  const setTerminalConfig = useCallback(
    async (config: TerminalConfig) => {
      await terminalConfigMutation.mutateAsync(config);
    },
    [terminalConfigMutation]
  );

  const updateTerminalSetting = useCallback(
    async <K extends keyof TerminalConfig>(key: K, value: TerminalConfig[K]) => {
      const newConfig = { ...terminalConfig, [key]: value };
      await setTerminalConfig(newConfig);
    },
    [terminalConfig, setTerminalConfig]
  );

  return {
    theme,
    terminalConfig,
    isLoading,
    setTheme,
    setTerminalConfig,
    updateTerminalSetting,
  };
}

/**
 * Hook for just the theme
 */
export function useTheme(): {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => Promise<void>;
  toggleTheme: () => Promise<void>;
} {
  const { theme, setTheme } = useUserPreferences();

  const toggleTheme = useCallback(async () => {
    await setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}

/**
 * Hook for just terminal config
 */
export function useTerminalConfig(): {
  config: TerminalConfig;
  setConfig: (config: TerminalConfig) => Promise<void>;
  updateSetting: <K extends keyof TerminalConfig>(
    key: K,
    value: TerminalConfig[K]
  ) => Promise<void>;
} {
  const { terminalConfig, setTerminalConfig, updateTerminalSetting } = useUserPreferences();

  return {
    config: terminalConfig,
    setConfig: setTerminalConfig,
    updateSetting: updateTerminalSetting,
  };
}
