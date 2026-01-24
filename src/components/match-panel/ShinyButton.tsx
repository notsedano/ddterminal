import React from 'react';
import { cn } from '@/utils/cn';

interface ShinyButtonProps {
  name: string;
  percentage: string;
  odds: string;
  className?: string;
  onClick?: () => void;
}

export function ShinyButton({ 
  name, 
  percentage, 
  odds, 
  className,
  onClick 
}: ShinyButtonProps) {
  return (
    <div className={cn('relative', className)}>
      <button className="shiny-cta" onClick={onClick}>
        <span className="flex flex-col items-center justify-center gap-1 w-full">
          <span className="text-xs text-muted-foreground truncate max-w-full">
            {name}
          </span>
          <span className="text-xl font-bold hud-data text-red-400">
            {percentage}
          </span>
          <span className="text-xs text-muted-foreground hud-data">
            {odds}
          </span>
        </span>
      </button>
    </div>
  );
}
