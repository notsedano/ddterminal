/**
 * HUD Chart Wrapper Component
 * Wraps chart components with console HUD styling while preserving chart functionality
 */

import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { ChartThemeProvider } from '@/components/charts/ChartThemeProvider';

export interface HudChartWrapperProps {
  children: ReactNode;
  className?: string;
  showScanlines?: boolean;
  variant?: 'default' | 'minimal' | 'strong';
}

/**
 * Wraps chart components with HUD styling
 * Preserves all chart functionality while adding console HUD aesthetic
 */
export function HudChartWrapper({
  children,
  className,
  showScanlines = false,
  variant = 'default',
}: HudChartWrapperProps) {
  const wrapperClasses = cn(
    'hud-chart-wrapper',
    showScanlines && 'hud-scanlines',
    variant === 'strong' && 'hud-glow-blue-strong',
    variant === 'minimal' && 'border-opacity-30',
    className
  );

  return (
    <ChartThemeProvider>
      <div className={wrapperClasses}>
        {children}
      </div>
    </ChartThemeProvider>
  );
}
