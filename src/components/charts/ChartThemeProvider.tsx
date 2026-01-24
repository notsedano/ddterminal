/**
 * MUI Chart Theme Provider
 * Provides dark/light mode theming for MUI X Charts that integrates with existing Tailwind theme
 */

import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Chart color palette - consistent across all charts
 */
export const chartColors = {
  // Primary series colors - Blue theme
  primary: '#60a5fa', // blue-400 (brighter for HUD)
  secondary: '#3b82f6', // blue-500
  tertiary: '#93c5fd', // blue-300
  quaternary: '#2563eb', // blue-600
  quinary: '#1d4ed8', // blue-700
  
  // Semantic colors
  success: '#22c55e', // green-500
  danger: '#ef4444', // red-500
  warning: '#f59e0b', // amber-500
  info: '#60a5fa', // blue-400 (HUD blue)
  
  // Orderbook colors
  bid: '#22c55e', // green-500
  ask: '#ef4444', // red-500
  bidLight: 'rgba(34, 197, 94, 0.2)',
  askLight: 'rgba(239, 68, 68, 0.2)',
  
  // Neutral colors
  muted: '#6b7280', // gray-500
  mutedLight: 'rgba(107, 114, 128, 0.3)',
  
  // Series palette for multi-series charts - Blue-focused
  series: [
    '#60a5fa', // blue-400 (primary HUD blue)
    '#3b82f6', // blue-500
    '#22c55e', // green-500
    '#93c5fd', // blue-300
    '#2563eb', // blue-600
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
    '#8b5cf6', // violet-500
  ],
} as const;

/**
 * Dark theme configuration for MUI charts
 */
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: 'hsl(0, 0%, 4%)',
      paper: 'hsl(0, 0%, 6%)',
    },
    text: {
      primary: 'hsl(217, 91%, 85%)',
      secondary: 'hsl(217, 30%, 65%)',
    },
    divider: 'hsl(217, 91%, 50%)',
  },
  typography: {
    fontFamily: "'Consolas', 'Courier New', monospace",
    fontSize: 12,
  },
});

/**
 * Light theme configuration for MUI charts
 */
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: 'hsl(0, 0%, 100%)',
      paper: 'hsl(0, 0%, 100%)',
    },
    text: {
      primary: 'hsl(222.2, 84%, 4.9%)',
      secondary: 'hsl(215.4, 16.3%, 46.9%)',
    },
    divider: 'hsl(214.3, 31.8%, 91.4%)',
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 12,
  },
});

interface ChartThemeProviderProps {
  children: ReactNode;
}

/**
 * Provider component that syncs MUI theme with the app's dark/light mode
 */
export function ChartThemeProvider({ children }: ChartThemeProviderProps) {
  const [isDark, setIsDark] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    // Watch for theme changes on the document
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      {children}
    </ThemeProvider>
  );
}

/**
 * Hook to get current theme mode for charts
 */
export function useChartTheme(): 'dark' | 'light' {
  const [mode, setMode] = useState<'dark' | 'light'>(() => 
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return mode;
}
